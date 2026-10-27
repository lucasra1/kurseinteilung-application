import "server-only";
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import {
  type StaffingAction,
  type StaffingTermin,
  staffingEvents,
  type TerminState,
} from "@/lib/audit";
import { logEvents } from "@/lib/dal/audit";
import { isPastDate } from "@/lib/dates";
import { db, type Tx } from "@/lib/db/client";
import { kurse, profiles, signups, termine } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import {
  type StaffingChange,
  sendStaffingNotifications,
} from "@/lib/notifications";
import {
  diffRoles,
  hasQualification,
  KINDS,
  type Kind,
  needed,
  type RoleSnapshot,
  rankSignups,
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

/**
 * Runs a change to the signups of some Termine in one transaction: locks the Termin rows
 * first (in id order, so concurrent changes queue up instead of deadlocking), diffs roles
 * before and after, writes the Verlauf for `action` (see lib/audit.ts) and sends
 * notifications after the commit.
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

    const after = await loadTermine(tx, ids, false);
    const signupsAfter = await loadSignups(tx, ids);
    const rankedBefore = rankedByTermin(before, signupsBefore);
    const rankedAfter = rankedByTermin(after, signupsAfter);
    const changes = diffRoles(snapshot(rankedBefore), snapshot(rankedAfter));

    await logEvents(
      tx,
      action.actor,
      staffingEvents({
        action,
        before: states(before, rankedBefore),
        after: states(after, rankedAfter),
        ...names,
      }),
    );

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
      before,
      after,
      rankedAfter,
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

  const terminStateAfter = new Map(
    [...out.rankedAfter].map(([terminId, list]) => [
      terminId,
      {
        instruktor: list.filter((s) => s.role === "instruktor").length,
        praxisanleiter: list.filter((s) => s.role === "praxisanleiter").length,
        backups: list.filter((s) => !KINDS.includes(s.role as Kind)).length,
      },
    ]),
  );

  await sendStaffingNotifications(enriched, {
    actorId: action.actor.id,
    terminStateAfter,
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
 * Appends a person at the end of the list for `kind`: a fixed place if one is free,
 * otherwise a backup. Call only inside `mutateStaffing.run`.
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
