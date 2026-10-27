import "server-only";
import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";
import {
  explicitlyPlaced,
  type StaffingAction,
  type StaffingTermin,
  staffingEvents,
  type TerminState,
} from "@/lib/audit";
import { logEvents } from "@/lib/dal/audit";
import { todayInVienna } from "@/lib/dates";
import { db, type Tx } from "@/lib/db/client";
import { kurse, profiles, signups, termine } from "@/lib/db/schema";
import { ConfirmationRequired, DomainError } from "@/lib/errors";
import { sendStaffingNotifications } from "@/lib/notifications";
import {
  type Aufruf,
  type AusschreibungPlan,
  ausgeschrieben,
  hasQualification,
  isBackup,
  isFestgeschrieben,
  type Kind,
  needed,
  planAufrufe,
  planAusschreibung,
  rankSignups,
  STAFFING_FIELDS,
  sortByPosition,
  type Triggered,
  triggered,
} from "@/lib/staffing";
import { type Warning, warningText } from "@/lib/warning-text";

type SignupRow = {
  terminId: string;
  profileId: string;
  kind: Kind;
  position: number;
  createdAt: Date;
  fullName: string;
};

async function loadTermine(
  tx: Tx,
  ids: string[],
  lock: boolean,
): Promise<Map<string, StaffingTermin>> {
  if (ids.length === 0) return new Map();
  if (lock) {
    // Lock in a single-table query: Drizzle renders `FOR UPDATE OF` schema-qualified
    // ("app"."termine"), which Postgres rejects.
    await tx
      .select({ id: termine.id })
      .from(termine)
      .where(inArray(termine.id, ids))
      .orderBy(asc(termine.id))
      .for("update");
  }
  const rows = await tx
    .select({
      id: termine.id,
      kursId: termine.kursId,
      kursTitle: kurse.title,
      date: termine.date,
      startTime: termine.startTime,
      endTime: termine.endTime,
      topic: termine.topic,
      location: termine.location,
      instruktorenNeeded: termine.instruktorenNeeded,
      praxisanleiterNeeded: termine.praxisanleiterNeeded,
      instruktorenAusgeschrieben: termine.instruktorenAusgeschrieben,
      praxisanleiterAusgeschrieben: termine.praxisanleiterAusgeschrieben,
      festgeschrieben: termine.festgeschrieben,
    })
    .from(termine)
    .innerJoin(kurse, eq(termine.kursId, kurse.id))
    .where(inArray(termine.id, ids))
    .orderBy(asc(termine.id));
  return new Map(rows.map((row) => [row.id, row]));
}

async function loadSignups(tx: Tx, ids: string[]): Promise<SignupRow[]> {
  if (ids.length === 0) return [];
  return tx
    .select({
      terminId: signups.terminId,
      profileId: signups.profileId,
      kind: signups.kind,
      position: signups.position,
      createdAt: signups.createdAt,
      fullName: profiles.fullName,
    })
    .from(signups)
    .innerJoin(profiles, eq(signups.profileId, profiles.id))
    .where(inArray(signups.terminId, ids));
}

function rankedByTermin(
  termineById: Map<string, StaffingTermin>,
  rows: SignupRow[],
) {
  return new Map(
    [...termineById.values()].map((termin) => [
      termin.id,
      rankSignups(
        rows.filter((row) => row.terminId === termin.id),
        termin,
      ),
    ]),
  );
}

function states(
  termineById: Map<string, StaffingTermin>,
  ranked: ReturnType<typeof rankedByTermin>,
): TerminState[] {
  return [...termineById.values()].map((termin) => ({
    termin,
    signups: ranked.get(termin.id) ?? [],
  }));
}

/** The target names the Verlauf needs when no signup or Termin carries them. */
async function targetNames(
  tx: Tx,
  action: StaffingAction,
  ids: string[],
  signupsBefore: SignupRow[],
): Promise<{ targetName?: string; kursTitle?: string }> {
  const { target } = action;
  const names: { targetName?: string; kursTitle?: string } = {};
  if (
    "profileId" in target &&
    !signupsBefore.some((s) => s.profileId === target.profileId)
  ) {
    const [person] = await tx
      .select({ fullName: profiles.fullName })
      .from(profiles)
      .where(eq(profiles.id, target.profileId));
    names.targetName = person?.fullName;
  }
  if ("kursId" in target && ids.length === 0) {
    const [kurs] = await tx
      .select({ title: kurse.title })
      .from(kurse)
      .where(eq(kurse.id, target.kursId));
    names.kursTitle = kurs?.title;
  }
  return names;
}

/** `planAusschreibung` for every Termin still there after `run`. */
function planTermine(
  action: StaffingAction,
  before: Map<string, StaffingTermin>,
  afterRun: Map<string, StaffingTermin>,
  signupsBefore: SignupRow[],
  signupsAfter: SignupRow[],
): AusschreibungPlan[] {
  const today = todayInVienna();
  return [...afterRun.values()].map((termin) => {
    const onTermin = signupsAfter.filter((s) => s.terminId === termin.id);
    return planAusschreibung({
      terminId: termin.id,
      before: {
        staffing: before.get(termin.id) ?? termin,
        signups: signupsBefore.filter((s) => s.terminId === termin.id),
      },
      after: { staffing: termin, signups: onTermin },
      festgeschrieben: isFestgeschrieben(termin, today),
      isPast: termin.date < today,
      explicit: explicitlyPlaced(
        action,
        onTermin.map((s) => s.profileId),
      ),
      actorId: action.actor.id,
    });
  });
}

/** Someone an Aufruf writes to; the address is looked up when sending. */
type AufrufRecipient = { id: string; fullName: string };

/** The plans' Aufrufe with their recipients; writes nothing, so the Warndialog can count them. */
async function resolveAufrufe(
  tx: Tx,
  action: StaffingAction,
  plans: AusschreibungPlan[],
  signupsBefore: SignupRow[],
  signupsAfter: SignupRow[],
): Promise<Aufruf<AufrufRecipient>[]> {
  const kinds = new Set(
    triggered(plans)
      .filter(({ trigger }) => trigger.type === "aufruf")
      .map(({ kind }) => kind),
  );
  if (kinds.size === 0) return [];
  const people = await tx
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      isInstruktor: profiles.isInstruktor,
      isPraxisanleiter: profiles.isPraxisanleiter,
    })
    .from(profiles)
    .where(
      or(
        ...[...kinds].map((kind) =>
          eq(
            kind === "instruktor"
              ? profiles.isInstruktor
              : profiles.isPraxisanleiter,
            true,
          ),
        ),
      ),
    );
  return planAufrufe({
    plans,
    people,
    before: signupsBefore,
    after: signupsAfter,
    actorId: action.actor.id,
  });
}

/** Writes the planned counters; returns the Termine with them. */
async function writeCounters(
  tx: Tx,
  afterRun: Map<string, StaffingTermin>,
  plans: AusschreibungPlan[],
): Promise<Map<string, StaffingTermin>> {
  const after = new Map(afterRun);
  for (const plan of plans) {
    const termin = afterRun.get(plan.terminId);
    if (!termin) continue;
    const counters = {
      instruktorenAusgeschrieben: plan.roles.instruktor.ausgeschrieben,
      praxisanleiterAusgeschrieben: plan.roles.praxisanleiter.ausgeschrieben,
    };
    if (
      counters.instruktorenAusgeschrieben ===
        termin.instruktorenAusgeschrieben &&
      counters.praxisanleiterAusgeschrieben ===
        termin.praxisanleiterAusgeschrieben
    ) {
      continue;
    }
    await tx.update(termine).set(counters).where(eq(termine.id, termin.id));
    after.set(termin.id, { ...termin, ...counters });
  }
  return after;
}

/** Whether the Warndialog was confirmed; `"nie-noetig"`: the rule never asks, so asking fails. */
export type Bestaetigt = boolean | "nie-noetig";

/** What the triggered roles would do, for the dialog text. */
function warnings(
  triggers: Triggered[],
  afterRun: Map<string, StaffingTermin>,
  aufrufe: Aufruf<AufrufRecipient>[],
): Warning[] {
  return triggers.flatMap(({ terminId, kind, trigger }): Warning[] => {
    const termin = afterRun.get(terminId);
    if (!termin) return [];
    if (trigger.type === "backups") {
      const backups = trigger.recipients.length;
      return [
        { termin, kind, type: "backups", places: trigger.places, backups },
      ];
    }
    const aufruf = aufrufe.find(
      (a) => a.terminId === terminId && a.kind === kind,
    );
    const qualified = aufruf?.recipients.length ?? 0;
    return [
      { termin, kind, type: "aufruf", places: trigger.places, qualified },
    ];
  });
}

/** Throws unless the action may go on; see `Bestaetigt`. */
function confirm(
  action: StaffingAction,
  bestaetigt: Bestaetigt,
  pending: Warning[],
): void {
  if (pending.length === 0 || bestaetigt === true) return;
  if (bestaetigt === "nie-noetig") {
    throw new Error(
      `${action.type} would trigger an Ausschreibung, which the rule never lets it do`,
    );
  }
  throw new ConfirmationRequired(warningText(pending));
}

/**
 * Runs a staffing change in one transaction, Termine locked in id order so concurrent changes
 * queue instead of deadlocking; writes the Verlauf, sends the mails after the commit.
 */
export async function mutateStaffing<T>(opts: {
  action: StaffingAction;
  /** See `Bestaetigt`. */
  bestaetigt: Bestaetigt;
  terminIds: (tx: Tx) => Promise<string[]>;
  run: (tx: Tx, termine: Map<string, StaffingTermin>) => Promise<T>;
}): Promise<T> {
  const { action } = opts;
  const committed = await db.transaction(async (tx) => {
    const ids = [...new Set(await opts.terminIds(tx))].sort();
    const before = await loadTermine(tx, ids, true);
    const signupsBefore = await loadSignups(tx, ids);
    const names = await targetNames(tx, action, ids, signupsBefore);

    const result = await opts.run(tx, before);

    const afterRun = await loadTermine(tx, ids, false);
    const signupsAfter = await loadSignups(tx, ids);
    const plans = planTermine(
      action,
      before,
      afterRun,
      signupsBefore,
      signupsAfter,
    );
    const aufrufe = await resolveAufrufe(
      tx,
      action,
      plans,
      signupsBefore,
      signupsAfter,
    );
    // Nothing of the rule is written yet: throwing here rolls the whole action back.
    confirm(
      action,
      opts.bestaetigt,
      warnings(triggered(plans), afterRun, aufrufe),
    );
    const after = await writeCounters(tx, afterRun, plans);

    const rankedBefore = rankedByTermin(before, signupsBefore);
    const rankedAfter = rankedByTermin(after, signupsAfter);
    const afterStates = states(after, rankedAfter);
    // Kept in memory for the mails: read back, entries of one action have no order.
    const entries = staffingEvents({
      action,
      before: states(before, rankedBefore),
      after: afterStates,
      plans,
      aufrufe,
      ...names,
    });
    await logEvents(tx, action.actor, entries);
    return { result, entries, after: afterStates };
  });

  await sendStaffingNotifications({
    actor: action.actor,
    entries: committed.entries,
    after: committed.after,
  });
  return committed.result;
}

/** The locked Termin for `id`, or `nicht-gefunden`. */
export function lockedTermin(
  termineById: Map<string, StaffingTermin>,
  id: string,
): StaffingTermin {
  const termin = termineById.get(id);
  if (!termin) throw new DomainError("nicht-gefunden");
  return termin;
}

/**
 * Signs a person up for `kind`: onto an ausgeschriebenen place while there is one, else at
 * the end. Call only inside `mutateStaffing.run`.
 */
export async function appendSignup(
  tx: Tx,
  termin: StaffingTermin,
  profileId: string,
  kind: Kind,
): Promise<void> {
  if (needed(termin, kind) === 0) {
    throw new DomainError("rolle-nicht-gebraucht");
  }
  const [person] = await tx
    .select({
      isInstruktor: profiles.isInstruktor,
      isPraxisanleiter: profiles.isPraxisanleiter,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  if (!person) throw new DomainError("nicht-gefunden");
  if (!hasQualification(person, kind)) {
    throw new DomainError("nicht-qualifiziert");
  }

  const rows = await tx
    .select({ profileId: signups.profileId, position: signups.position })
    .from(signups)
    .where(eq(signups.terminId, termin.id));
  if (rows.some((row) => row.profileId === profileId)) {
    throw new DomainError("bereits-eingetragen");
  }

  const nextPosition = Math.max(0, ...rows.map((row) => row.position)) + 1;
  await tx
    .insert(signups)
    .values({ terminId: termin.id, profileId, kind, position: nextPosition });
  if (ausgeschrieben(termin, kind) > 0) {
    await takeAusgeschriebenPlace(tx, termin, profileId, kind);
  }
}

async function signupsInOrder(tx: Tx, terminId: string) {
  return sortByPosition(
    await tx
      .select({
        id: signups.id,
        profileId: signups.profileId,
        kind: signups.kind,
        position: signups.position,
        createdAt: signups.createdAt,
      })
      .from(signups)
      .where(eq(signups.terminId, terminId)),
  );
}

/** Puts a signed-up person ahead of the backups of `kind` and lowers its counter by one. */
async function takeAusgeschriebenPlace(
  tx: Tx,
  termin: StaffingTermin,
  profileId: string,
  kind: Kind,
): Promise<void> {
  const rows = await signupsInOrder(tx, termin.id);
  const person = rows.find((row) => row.profileId === profileId);
  if (!person) throw new DomainError("nicht-eingetragen");
  const others = rows.filter((row) => row !== person);
  const firstBackup = rankSignups(others, termin).find(
    (row) => row.role === `backup-${kind}`,
  );
  const at = firstBackup
    ? others.findIndex((row) => row.id === firstBackup.id)
    : others.length;
  const order = [...others.slice(0, at), person, ...others.slice(at)];
  for (const [index, row] of order.entries()) {
    if (row.position === index + 1) continue;
    await tx
      .update(signups)
      .set({ position: index + 1 })
      .where(eq(signups.id, row.id));
  }
  const counter = STAFFING_FIELDS[kind].ausgeschrieben;
  await tx
    .update(termine)
    .set({ [counter]: sql`${termine[counter]} - 1` })
    .where(eq(termine.id, termin.id));
}

/**
 * Gives a backup an ausgeschriebenen place (übernehmen, Platz geben); the Termin lock lets
 * exactly one of concurrent claims win. Call only inside `mutateStaffing.run`.
 */
export async function claimAusgeschriebenPlace(
  tx: Tx,
  termin: StaffingTermin,
  profileId: string,
): Promise<void> {
  const ranked = rankSignups(await signupsInOrder(tx, termin.id), termin);
  const signup = ranked.find((row) => row.profileId === profileId);
  if (!signup) throw new DomainError("kein-backup");
  if (ausgeschrieben(termin, signup.kind) === 0) {
    throw new DomainError("platz-vergeben");
  }
  if (!isBackup(signup.role)) throw new DomainError("kein-backup");
  await takeAusgeschriebenPlace(tx, termin, profileId, signup.kind);
}

/** Removes a person and moves everyone behind them up. Call only inside `mutateStaffing.run`. */
export async function removeSignup(
  tx: Tx,
  terminId: string,
  profileId: string,
): Promise<void> {
  const [removed] = await tx
    .delete(signups)
    .where(
      and(eq(signups.terminId, terminId), eq(signups.profileId, profileId)),
    )
    .returning({ position: signups.position });
  if (!removed) throw new DomainError("nicht-eingetragen");

  await tx
    .update(signups)
    .set({ position: sql`${signups.position} - 1` })
    .where(
      and(
        eq(signups.terminId, terminId),
        gt(signups.position, removed.position),
      ),
    );
}
