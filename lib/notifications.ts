import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import type { LockedTermin } from "@/lib/dal/staffing-tx";
import { formatDate, formatTerminWhen } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { type EmailMessage, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { ROLE_LABEL, type RoleChange } from "@/lib/staffing";

export type StaffingChange = RoleChange & {
  termin: LockedTermin;
  person: { fullName: string; email: string };
};

type TerminCounts = { trainers: number; backups: number };

const SIGNATURE = "\n\nKurseinteilung";

function describe(termin: LockedTermin) {
  return {
    what: `„${termin.kursTitle} – ${termin.topic}“`,
    when: formatTerminWhen(termin),
    day: formatDate(termin.date),
  };
}

function withdrawalEmail(
  change: StaffingChange,
  to: string,
  counts: TerminCounts,
): EmailMessage {
  const { termin } = change;
  const { what, when, day } = describe(termin);
  return {
    to,
    subject: `Abmeldung: ${termin.kursTitle}, ${day}`,
    text:
      `${change.person.fullName} hat sich von ${what} am ${when} abgemeldet.\n\n` +
      `Aktueller Stand: Trainer ${counts.trainers}/${termin.trainersNeeded}, ` +
      `Backup ${counts.backups}/${termin.backupsNeeded}.\n\n` +
      `${env.APP_URL}/admin/termine/${termin.id}${SIGNATURE}`,
  };
}

function personEmail(change: StaffingChange): EmailMessage {
  const { termin, person, from, to } = change;
  const { what, when, day } = describe(termin);
  const greeting = `Hallo ${person.fullName},\n\n`;
  const link = `\n\n${env.APP_URL}/termine${SIGNATURE}`;

  if (from && to) {
    return {
      to: person.email,
      subject: `Neue Rolle: ${termin.kursTitle}, ${day}`,
      text: `${greeting}deine Rolle für ${what} am ${when} hat sich geändert: ${ROLE_LABEL[from]} → ${ROLE_LABEL[to]}.${link}`,
    };
  }
  if (to) {
    return {
      to: person.email,
      subject: `Eingetragen: ${termin.kursTitle}, ${day}`,
      text: `${greeting}du wurdest für ${what} am ${when} als ${ROLE_LABEL[to]} eingetragen.${link}`,
    };
  }
  return {
    to: person.email,
    subject: `Ausgetragen: ${termin.kursTitle}, ${day}`,
    text: `${greeting}du wurdest von ${what} am ${when} ausgetragen.${link}`,
  };
}

async function adminEmails(excludeProfileId: string): Promise<string[]> {
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
  return admins.filter((a) => a.id !== excludeProfileId).map((a) => a.email);
}

/**
 * Self-withdrawals notify all other admins; changes caused by someone else notify the
 * affected person. Never throws: a failed email is logged and the action still succeeds.
 */
export async function sendStaffingNotifications(
  changes: StaffingChange[],
  ctx: { actorId: string; terminStateAfter: Map<string, TerminCounts> },
): Promise<void> {
  try {
    const messages: EmailMessage[] = [];

    const withdrawals = changes.filter(
      (c) => c.profileId === ctx.actorId && c.to === null,
    );
    if (withdrawals.length > 0) {
      const recipients = await adminEmails(ctx.actorId);
      for (const change of withdrawals) {
        const counts = ctx.terminStateAfter.get(change.terminId) ?? {
          trainers: 0,
          backups: 0,
        };
        for (const to of recipients) {
          messages.push(withdrawalEmail(change, to, counts));
        }
      }
    }

    for (const change of changes) {
      if (change.profileId !== ctx.actorId) messages.push(personEmail(change));
    }

    await Promise.all(
      messages.map(async (message) => {
        try {
          await sendEmail(message);
        } catch (error) {
          console.error(
            `[email] Versand an ${message.to} fehlgeschlagen`,
            error,
          );
        }
      }),
    );
  } catch (error) {
    console.error("[email] Benachrichtigungen fehlgeschlagen", error);
  }
}
