import "server-only";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/dal/auth";
import { addDays, todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import {
  appSettings,
  auditEvents,
  demoMails,
  kurse,
  profiles,
  signups,
  termine,
} from "@/lib/db/schema";
import { DEMO_COOKIE, DEMO_INVITE_TOKEN } from "@/lib/demo";
import {
  DEMO_KURSE,
  DEMO_PEOPLE,
  demoSignups,
  demoTermine,
} from "@/lib/demo-data";
import type { EmailMessage } from "@/lib/email";
import { env } from "@/lib/env";

// Demo mode only. Every function refuses to run on a normal deployment, because
// resetDemo() deletes everyone and everything.

function assertDemoMode(): void {
  if (!env.DEMO_MODE) throw new Error("Nur im Demo-Modus verfügbar.");
}

/**
 * Puts the demo back to its starting point: the made-up people, Kurse and Termine from
 * lib/demo-data.ts (dates counted from today), no mails, an empty Verlauf. People who
 * registered during the demo are deleted.
 */
export async function resetDemo(): Promise<void> {
  assertDemoMode();
  const seedIds = DEMO_PEOPLE.map((p) => p.id);
  const today = todayInVienna();

  await db.transaction(async (tx) => {
    await tx.delete(kurse);
    await tx.delete(demoMails);
    await tx.delete(auditEvents);
    // Deleting the auth user removes the profile and its signups (ON DELETE CASCADE).
    await tx
      .delete(authUsers)
      .where(
        and(
          inArray(authUsers.id, tx.select({ id: profiles.id }).from(profiles)),
          notInArray(authUsers.id, seedIds),
        ),
      );

    await tx
      .insert(authUsers)
      .values(DEMO_PEOPLE.map(({ id, email }) => ({ id, email })))
      .onConflictDoUpdate({
        target: authUsers.id,
        set: { email: sql`excluded.email` },
      });
    await tx
      .insert(profiles)
      .values(DEMO_PEOPLE)
      .onConflictDoUpdate({
        target: profiles.id,
        set: {
          fullName: sql`excluded.full_name`,
          email: sql`excluded.email`,
          phone: sql`excluded.phone`,
          isAdmin: sql`excluded.is_admin`,
          isInstruktor: sql`excluded.is_instruktor`,
          isPraxisanleiter: sql`excluded.is_praxisanleiter`,
        },
      });

    await tx
      .insert(appSettings)
      .values({ id: 1, inviteToken: DEMO_INVITE_TOKEN })
      .onConflictDoUpdate({
        target: appSettings.id,
        set: { inviteToken: DEMO_INVITE_TOKEN },
      });

    await tx.insert(kurse).values(DEMO_KURSE);
    await tx
      .insert(termine)
      .values(demoTermine((days) => addDays(today, days)));
    await tx.insert(signups).values(demoSignups());
  });
}

/** A fresh demo instance has no data until its first reset. */
export async function ensureDemoData(): Promise<void> {
  assertDemoMode();
  const [anyone] = await db.select({ id: profiles.id }).from(profiles).limit(1);
  if (!anyone) await resetDemo();
}

/** Shows the app as this person from now on (in this browser); null logs out. */
export async function setDemoPersona(profileId: string | null): Promise<void> {
  assertDemoMode();
  const store = await cookies();
  if (!profileId) {
    store.delete(DEMO_COOKIE);
    return;
  }
  store.set(DEMO_COOKIE, profileId, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.APP_URL.startsWith("https://"),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

/** Unguarded like createAccount: the demo has no real auth users, only these rows. */
export async function createDemoAuthUser(email: string): Promise<string> {
  assertDemoMode();
  const [row] = await db
    .insert(authUsers)
    .values({ id: crypto.randomUUID(), email })
    .returning({ id: authUsers.id });
  return row.id;
}

export async function deleteDemoAuthUser(id: string): Promise<void> {
  assertDemoMode();
  await db.delete(authUsers).where(eq(authUsers.id, id));
}

/** Instead of sending: the demo mailbox shows them to whoever they're addressed to. */
export async function storeDemoMails(messages: EmailMessage[]): Promise<void> {
  assertDemoMode();
  if (messages.length === 0) return;
  await db.insert(demoMails).values(
    messages.map((m) => ({
      toEmail: m.to,
      subject: m.subject,
      body: m.text,
    })),
  );
}

export type DemoMail = {
  id: string;
  subject: string;
  body: string;
  createdAt: Date;
  isRead: boolean;
};

/** The current person's demo mails, newest first. */
export async function listOwnDemoMails(): Promise<DemoMail[]> {
  assertDemoMode();
  const user = await getCurrentUser();
  if (!user) return [];
  const rows = await db
    .select()
    .from(demoMails)
    .where(eq(demoMails.toEmail, user.email))
    .orderBy(desc(demoMails.createdAt))
    .limit(30);
  return rows.map((row) => ({
    id: row.id,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt,
    isRead: row.readAt !== null,
  }));
}

export async function markOwnDemoMailsRead(): Promise<void> {
  assertDemoMode();
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(demoMails)
    .set({ readAt: new Date() })
    .where(and(eq(demoMails.toEmail, user.email), isNull(demoMails.readAt)));
}

/** Everyone the demo can show the app as, for the persona switcher. */
export async function listDemoPeople(): Promise<
  { id: string; fullName: string }[]
> {
  assertDemoMode();
  return db
    .select({ id: profiles.id, fullName: profiles.fullName })
    .from(profiles)
    .orderBy(asc(profiles.fullName));
}
