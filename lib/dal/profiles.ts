import "server-only";
import { and, asc, eq, gte, inArray, ne, or, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { connection } from "next/server";
import {
  type AuditData,
  type PersonFields,
  personUpdatedEvents,
} from "@/lib/audit";
import { logEvents } from "@/lib/dal/audit";
import { isEnvAdmin, requireAdmin, requireUser } from "@/lib/dal/auth";
import { mutateStaffing, removeSignup } from "@/lib/dal/staffing-tx";
import { todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles, signups, termine } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { DomainError } from "@/lib/errors";
import type { Kind, Qualifications } from "@/lib/staffing";
import { supabaseService } from "@/lib/supabase/service";

/**
 * Unguarded, internal: creates the Supabase auth user (unless one exists) and the profile.
 * Only called from the auth flows after they checked the invite token or ADMIN_EMAILS.
 */
export async function createAccount(
  input: {
    email: string;
    fullName: string;
    phone: string | null;
  } & Qualifications,
  via: AuditData["person.registered"]["via"],
): Promise<string> {
  const [existing] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, input.email));

  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await supabaseService.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  const id = userId; // a const stays narrowed to string inside the callback
  await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(profiles)
      .values({
        id,
        fullName: input.fullName,
        email: input.email,
        phone: input.phone,
        isInstruktor: input.isInstruktor,
        isPraxisanleiter: input.isPraxisanleiter,
      })
      .onConflictDoNothing()
      .returning({ id: profiles.id });
    if (!created) return;
    const { fullName, isInstruktor, isPraxisanleiter } = input;
    await logEvents(tx, { id, fullName }, [
      {
        type: "person.registered",
        profileId: id,
        data: { personName: fullName, via, isInstruktor, isPraxisanleiter },
      },
    ]);
  });
  return id;
}

/** Name and phone of the current user; unchanged, it writes nothing. */
export async function updateOwnProfile(input: PersonFields): Promise<void> {
  const user = await requireUser();
  await db.transaction(async (tx) => {
    const [was] = await tx
      .select({ fullName: profiles.fullName, phone: profiles.phone })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .for("update");
    if (!was) throw new DomainError("nicht-gefunden");
    const entries = personUpdatedEvents(user.id, was, input);
    if (entries.length === 0) return;
    await tx
      .update(profiles)
      .set({ fullName: input.fullName, phone: input.phone })
      .where(eq(profiles.id, user.id));
    await logEvents(tx, user, entries);
  });
}

export type PersonView = Qualifications & {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  isEnvAdmin: boolean;
  upcomingSignups: number;
};

export async function listPeople(): Promise<PersonView[]> {
  await requireAdmin();
  await connection();
  const rows = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      phone: profiles.phone,
      isAdmin: profiles.isAdmin,
      isInstruktor: profiles.isInstruktor,
      isPraxisanleiter: profiles.isPraxisanleiter,
      upcomingSignups: sql<number>`count(${termine.id})::int`,
    })
    .from(profiles)
    .leftJoin(signups, eq(signups.profileId, profiles.id))
    .leftJoin(
      termine,
      and(eq(termine.id, signups.terminId), gte(termine.date, todayInVienna())),
    )
    .groupBy(profiles.id)
    .orderBy(asc(profiles.fullName));
  return rows.map((row) => {
    const envAdmin = isEnvAdmin(row.email);
    return { ...row, isAdmin: row.isAdmin || envAdmin, isEnvAdmin: envAdmin };
  });
}

async function findProfile(profileId: string) {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId));
  if (!profile) throw new DomainError("nicht-gefunden");
  return profile;
}

/** Unchanged, it writes nothing. */
export async function setAdmin(
  profileId: string,
  isAdmin: boolean,
): Promise<void> {
  const admin = await requireAdmin();
  const target = await findProfile(profileId);
  if (isEnvAdmin(target.email)) throw new DomainError("admin-aus-env");
  if (target.isAdmin === isAdmin) return;

  if (!isAdmin) {
    const isAnyAdmin =
      env.ADMIN_EMAILS.length > 0
        ? or(
            eq(profiles.isAdmin, true),
            inArray(profiles.email, env.ADMIN_EMAILS),
          )
        : eq(profiles.isAdmin, true);
    const others = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(and(isAnyAdmin, ne(profiles.id, profileId)));
    if (others.length === 0) throw new DomainError("letzter-admin");
  }

  await db.transaction(async (tx) => {
    // Only a real change counts: someone else may have just set the same value.
    const [changed] = await tx
      .update(profiles)
      .set({ isAdmin })
      .where(and(eq(profiles.id, profileId), ne(profiles.isAdmin, isAdmin)))
      .returning({ fullName: profiles.fullName });
    if (!changed) return;
    await logEvents(tx, admin, [
      {
        type: "person.koordination_changed",
        profileId,
        data: { personName: changed.fullName, granted: isAdmin },
      },
    ]);
  });
}

/**
 * Existing signups stay as they are; the admin decides about them separately. Unchanged,
 * it writes nothing.
 */
export async function setQualification(
  profileId: string,
  kind: Kind,
  value: boolean,
): Promise<void> {
  const admin = await requireAdmin();
  await findProfile(profileId);
  const column =
    kind === "instruktor" ? profiles.isInstruktor : profiles.isPraxisanleiter;
  await db.transaction(async (tx) => {
    const [changed] = await tx
      .update(profiles)
      .set(
        kind === "instruktor"
          ? { isInstruktor: value }
          : { isPraxisanleiter: value },
      )
      .where(and(eq(profiles.id, profileId), ne(column, value)))
      .returning({ fullName: profiles.fullName });
    if (!changed) return;
    await logEvents(tx, admin, [
      {
        type: "person.qualification_changed",
        profileId,
        data: { personName: changed.fullName, kind, granted: value },
      },
    ]);
  });
}

/** Removes the person from all Termine (others move up and get notified), then deletes the account. */
export async function removePerson(profileId: string): Promise<void> {
  const admin = await requireAdmin();
  if (profileId === admin.id) throw new DomainError("selbst-entfernen");
  const target = await findProfile(profileId);
  if (isEnvAdmin(target.email)) throw new DomainError("admin-aus-env");

  await mutateStaffing({
    action: {
      type: "person.removed",
      actor: admin,
      target: { profileId },
    },
    terminIds: async (tx) => {
      const rows = await tx
        .select({ terminId: signups.terminId })
        .from(signups)
        .where(eq(signups.profileId, profileId));
      return rows.map((row) => row.terminId);
    },
    run: async (tx, locked) => {
      for (const terminId of locked.keys()) {
        await removeSignup(tx, terminId, profileId);
      }
      await tx.delete(profiles).where(eq(profiles.id, profileId));
    },
  });

  const { error } = await supabaseService.auth.admin.deleteUser(profileId);
  if (error) {
    console.error(`Auth-User ${profileId} konnte nicht gelöscht werden`, error);
  }
}
