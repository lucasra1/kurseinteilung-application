import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import type { Actor } from "@/lib/audit";
import { todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { type EmailMessage, sendEmails } from "@/lib/email";
import { env } from "@/lib/env";
import {
  type ActionMailInput,
  MAIL_GROUPS,
  type StaffingMail,
  staffingMails,
} from "@/lib/mail-text";

/** What one staffing action did, as `mutateStaffing` hands it over after the commit. */
export type StaffingOutcome = Pick<
  ActionMailInput,
  "actor" | "entries" | "after"
>;

/** Addresses by profile ID; a removed account has none. */
async function addresses(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(inArray(profiles.id, ids));
  return new Map(rows.map((row) => [row.id, row.email]));
}

/** Every admin's address but the actor's. */
async function adminAddresses(actor: Actor): Promise<string[]> {
  const admins = await db
    .select({ id: profiles.id, email: profiles.email })
    .from(profiles)
    .where(
      env.ADMIN_EMAILS.length > 0
        ? or(
            eq(profiles.isAdmin, true),
            inArray(profiles.email, env.ADMIN_EMAILS),
          )
        : eq(profiles.isAdmin, true),
    );
  return admins
    .filter((admin) => admin.id !== actor.id)
    .map((admin) => admin.email);
}

/** The mails with their recipients' addresses, looked up only now: the Verlauf has none. */
async function addressed(
  mails: StaffingMail[],
  actor: Actor,
): Promise<EmailMessage[]> {
  const people = await addresses(
    mails.flatMap((mail) => ("profileId" in mail ? [mail.profileId] : [])),
  );
  const admins = mails.some((mail) => mail.group === "admins")
    ? await adminAddresses(actor)
    : [];
  return mails.flatMap(({ subject, text, ...mail }) => {
    if (!("profileId" in mail)) {
      return admins.map((to) => ({ to, subject, text }));
    }
    const to = people.get(mail.profileId);
    return to ? [{ to, subject, text }] : [];
  });
}

/**
 * Sends the mails of one staffing action, group by group: should the daily Resend quota run
 * out, the more urgent ones are out already (spec 4, Kontingent). Never throws: a failed
 * group is logged, the next one is still sent, and the action succeeds.
 */
export async function sendStaffingNotifications(
  outcome: StaffingOutcome,
): Promise<void> {
  let mails: StaffingMail[];
  try {
    mails = staffingMails({
      ...outcome,
      today: todayInVienna(),
      appUrl: env.APP_URL,
    });
  } catch (error) {
    console.error("[email] Mails nicht gebaut", error);
    return;
  }
  for (const group of MAIL_GROUPS) {
    try {
      const inGroup = mails.filter((mail) => mail.group === group);
      await sendEmails(await addressed(inGroup, outcome.actor));
    } catch (error) {
      console.error(`[email] ${group} fehlgeschlagen`, error);
    }
  }
}
