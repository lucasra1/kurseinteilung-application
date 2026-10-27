import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  explicitlyPlaced,
  type StaffingAction,
  type StaffingTermin,
  staffingEvents,
  type TerminState,
} from "@/lib/audit";
import { logEvents } from "@/lib/dal/audit";
import { isPastDate, todayInVienna } from "@/lib/dates";
import { db, type Tx } from "@/lib/db/client";
import { kurse, profiles, signups, termine } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  type PlatzFrei,
  type StaffingChange,
  sendStaffingNotifications,
} from "@/lib/notifications";
import {
  type AusschreibungPlan,
  ausgeschrieben,
  diffRoles,
  hasQualification,
  isBackup,
  isFestgeschrieben,
  type Kind,
  needed,
  planAusschreibung,
  type RoleSnapshot,
  rankSignups,
  sortByPosition,
  triggered,
} from "@/lib/staffing";

export type LockedTermin = StaffingTermin;

type SignupRow = {
  terminId: string;
  profileId: string;
  kind: Kind;
  position: number;
  createdAt: Date;
  fullName: string;
  email: string;
};

async function loadTermine(
  tx: Tx,
  ids: string[],
  lock: boolean,
): Promise<Map<string, LockedTermin>> {
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
      email: profiles.email,
    })
    .from(signups)
    .innerJoin(profiles, eq(signups.profileId, profiles.id))
    .where(inArray(signups.terminId, ids));
}

function rankedByTermin(
  termineById: Map<string, LockedTermin>,
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
  termineById: Map<string, LockedTermin>,
  ranked: ReturnType<typeof rankedByTermin>,
): TerminState[] {
  return [...termineById.values()].map((termin) => ({
    termin,
    signups: ranked.get(termin.id) ?? [],
  }));
}

/**
 * Names the Verlauf needs that may be gone after `run`: the target person if they're on
 * none of the Termine, the target Kurs if it has none.
 */
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

function snapshot(ranked: ReturnType<typeof rankedByTermin>): RoleSnapshot {
  return new Map(
    [...ranked].map(([terminId, list]) => [
      terminId,
      new Map(list.map((s) => [s.profileId, s.role])),
    ]),
  );
}

/** `planAusschreibung` for every Termin still there after `run`. */
function planTermine(
  action: StaffingAction,
  before: Map<string, LockedTermin>,
  afterRun: Map<string, LockedTermin>,
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

/** Writes the planned counters; returns the Termine with them. */
async function writeCounters(
  tx: Tx,
  afterRun: Map<string, LockedTermin>,
  plans: AusschreibungPlan[],
): Promise<Map<string, LockedTermin>> {
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

/**
 * Runs a change to the signups of some Termine in one transaction: locks the Termin rows
 * first (in id order, so concurrent changes queue up instead of deadlocking), applies the
 * Ausschreibung rule (`planAusschreibung`), diffs roles before and after, writes the
 * Verlauf for `action` (see lib/audit.ts) and sends the mails built from it after the
 * commit.
 */
export async function mutateStaffing<T>(opts: {
  action: StaffingAction;
  terminIds: (tx: Tx) => Promise<string[]>;
  run: (tx: Tx, termine: Map<string, LockedTermin>) => Promise<T>;
}): Promise<T> {
  const { action } = opts;
  const out = await db.transaction(async (tx) => {
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
    // Nothing of the rule is written yet: a check on `triggered(plans)` that throws here
    // (e.g. a confirmation) rolls the whole action back, without counters, Verlauf or mails.
    const after = await writeCounters(tx, afterRun, plans);

    const rankedBefore = rankedByTermin(before, signupsBefore);
    const rankedAfter = rankedByTermin(after, signupsAfter);
    const changes = diffRoles(snapshot(rankedBefore), snapshot(rankedAfter));

    const afterStates = states(after, rankedAfter);
    // Kept in memory for the mails: read back, entries of one action have no order.
    const entries = staffingEvents({
      action,
      before: states(before, rankedBefore),
      after: afterStates,
      plans,
      ...names,
    });
    await logEvents(tx, action.actor, entries);

    const changedIds = [...new Set(changes.map((c) => c.profileId))];
    const stillExisting =
      changedIds.length > 0
        ? await tx
            .select({ id: profiles.id })
            .from(profiles)
            .where(inArray(profiles.id, changedIds))
        : [];

    return {
      result,
      changes,
      entries,
      plans,
      afterStates,
      before,
      after,
      people: new Map(
        [...signupsBefore, ...signupsAfter].map((s) => [
          s.profileId,
          { fullName: s.fullName, email: s.email },
        ]),
      ),
      existingProfileIds: new Set(stillExisting.map((p) => p.id)),
    };
  });

  const enriched: StaffingChange[] = out.changes.flatMap((change) => {
    const termin =
      out.after.get(change.terminId) ?? out.before.get(change.terminId);
    const person = out.people.get(change.profileId);
    if (!termin || !person) return [];
    if (isPastDate(termin.date)) return [];
    if (!out.existingProfileIds.has(change.profileId)) return [];
    return [{ ...change, termin, person }];
  });

  // The rule never triggers on past Termine, and recipients are on the Termin afterwards.
  const platzFrei: PlatzFrei[] = triggered(out.plans).flatMap(
    ({ terminId, kind, trigger }) => {
      const termin = out.after.get(terminId);
      if (trigger.type !== "backups" || !termin) return [];
      const recipients = trigger.recipients.flatMap((id) => {
        const person = out.people.get(id);
        return person ? [person] : [];
      });
      return [{ termin, kind, places: trigger.places, recipients }];
    },
  );

  await sendStaffingNotifications({
    actor: action.actor,
    entries: out.entries,
    after: out.afterStates,
    changes: enriched,
    platzFrei,
  });
  return out.result;
}

/** The locked Termin for `id`, or `nicht-gefunden`. */
export function lockedTermin(
  termineById: Map<string, LockedTermin>,
  id: string,
): LockedTermin {
  const termin = termineById.get(id);
  if (!termin) throw new DomainError("nicht-gefunden");
  return termin;
}

/**
 * Signs a person up for `kind`: while a place of the kind is ausgeschrieben they take it
 * (first come, first served), otherwise they go to the end of the list, on a free fixed
 * place or as a backup. Call only inside `mutateStaffing.run`.
 */
export async function appendSignup(
  tx: Tx,
  termin: LockedTermin,
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
    await takeHeldPlace(tx, termin, profileId, kind);
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

/**
 * Moves a signed-up person to the first backup slot of `kind` (before every other backup),
 * renumbers the Termin's positions and lowers the counter by one: they now hold the place.
 * `termin` is the locked state, with a place of `kind` ausgeschrieben.
 */
async function takeHeldPlace(
  tx: Tx,
  termin: LockedTermin,
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
  await tx
    .update(termine)
    .set(
      kind === "instruktor"
        ? {
            instruktorenAusgeschrieben: sql`${termine.instruktorenAusgeschrieben} - 1`,
          }
        : {
            praxisanleiterAusgeschrieben: sql`${termine.praxisanleiterAusgeschrieben} - 1`,
          },
    )
    .where(eq(termine.id, termin.id));
}

/**
 * Gives a backup an ausgeschriebenen place of their role (Platz übernehmen, Platz geben):
 * `platz-vergeben` once none is left, `kein-backup` if the person isn't a backup here. The
 * Termin lock of `mutateStaffing` queues concurrent claims, so exactly one wins. Call only
 * inside `mutateStaffing.run`, with the action's target as the person.
 */
export async function claimHeldPlace(
  tx: Tx,
  termin: LockedTermin,
  profileId: string,
): Promise<void> {
  const ranked = rankSignups(await signupsInOrder(tx, termin.id), termin);
  const signup = ranked.find((row) => row.profileId === profileId);
  if (!signup) throw new DomainError("kein-backup");
  if (ausgeschrieben(termin, signup.kind) === 0) {
    throw new DomainError("platz-vergeben");
  }
  if (!isBackup(signup.role)) throw new DomainError("kein-backup");
  await takeHeldPlace(tx, termin, profileId, signup.kind);
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
