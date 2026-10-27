import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import type { Actor, AuditEntry, TerminState } from "@/lib/audit";
import type { LockedTermin } from "@/lib/dal/staffing-tx";
import { formatDate, formatTerminWhen, todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { type EmailMessage, sendEmails } from "@/lib/email";
import { env } from "@/lib/env";
import { coordinatorMail, gebrauchtMail, platzFreiMail } from "@/lib/mail-text";
import { type Kind, ROLE_LABEL, type RoleChange } from "@/lib/staffing";

export type StaffingChange = RoleChange & {
  termin: LockedTermin;
  person: { fullName: string; email: string };
};

const SIGNATURE = "\n\nKurseinteilung";

function describe(termin: LockedTermin) {
  return {
    what: `„${termin.kursTitle} – ${termin.topic}“`,
    when: formatTerminWhen(termin),
    day: formatDate(termin.date),
  };
}

function personEmail(change: StaffingChange): EmailMessage {
  const { termin, person, from, to } = change;
  const { what, when, day } = describe(termin);
  const greeting = `Hallo ${person.fullName},\n\n`;
  const link = `\n\n${env.APP_URL}/meine${SIGNATURE}`;

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

/** Places of one role the action ausgeschrieben, and the backups to offer them to. */
export type PlatzFrei = {
  termin: LockedTermin;
  kind: Kind;
  places: number;
  /** Without the actor. */
  recipients: { fullName: string; email: string }[];
};

/** A role lacking places without a backup, and the qualified to call ("Du wirst gebraucht"). */
export type Gebraucht = {
  termin: LockedTermin;
  kind: Kind;
  places: number;
  /** Qualified, on the Termin in no role, without the actor. */
  recipients: { fullName: string; email: string }[];
};

/** What one staffing action did, as `mutateStaffing` hands it over after the commit. */
export type StaffingOutcome = {
  actor: Actor;
  /** The action's Verlauf entries, in the order `staffingEvents` built them. */
  entries: AuditEntry[];
  /** The Termine afterwards; deleted ones are missing. */
  after: TerminState[];
  /** Role changes of people who still have an account, on Termine that aren't past. */
  changes: StaffingChange[];
  platzFrei: PlatzFrei[];
  gebraucht: Gebraucht[];
};

/** "Platz frei" to the backups of every role whose places the action ausgeschrieben. */
async function platzFreiEmails(outcome: StaffingOutcome) {
  return outcome.platzFrei.flatMap(({ termin, kind, places, recipients }) =>
    recipients.map((person) => ({
      to: person.email,
      ...platzFreiMail({
        termin,
        kind,
        places,
        name: person.fullName,
        appUrl: env.APP_URL,
      }),
    })),
  );
}

/** "Du wirst gebraucht" to the qualified for every role lacking places without a backup. */
async function gebrauchtEmails(outcome: StaffingOutcome) {
  return outcome.gebraucht.flatMap(({ termin, kind, places, recipients }) =>
    recipients.map((person) => ({
      to: person.email,
      ...gebrauchtMail({
        termin,
        kind,
        places,
        name: person.fullName,
        appUrl: env.APP_URL,
      }),
    })),
  );
}

/** Everyone whose role someone else changed. */
async function betroffeneEmails(outcome: StaffingOutcome) {
  return outcome.changes
    .filter((change) => change.profileId !== outcome.actor.id)
    .map(personEmail);
}

/** One mail about the whole action to every Praxisanleiterkoordinator:in but the actor. */
async function koordinationEmails(outcome: StaffingOutcome) {
  const mail = coordinatorMail({
    actor: outcome.actor,
    entries: outcome.entries,
    after: outcome.after,
    today: todayInVienna(),
    appUrl: env.APP_URL,
  });
  if (!mail) return [];
  const recipients = await adminEmails(outcome.actor.id);
  return recipients.map((to) => ({ to, ...mail }));
}

type MailGroup = {
  name: string;
  build: (outcome: StaffingOutcome) => Promise<EmailMessage[]>;
};

/**
 * The mails of an action, in sending order: should the daily Resend quota run out, the
 * more urgent ones are out already (spec 4, Kontingent).
 */
const MAIL_GROUPS: MailGroup[] = [
  { name: "platz-frei", build: platzFreiEmails },
  { name: "gebraucht", build: gebrauchtEmails },
  { name: "betroffene", build: betroffeneEmails },
  { name: "koordination", build: koordinationEmails },
];

/**
 * Sends the mails of one staffing action, group by group. Never throws: a failed group is
 * logged, the next one is still sent, and the action succeeds.
 */
export async function sendStaffingNotifications(
  outcome: StaffingOutcome,
): Promise<void> {
  for (const group of MAIL_GROUPS) {
    try {
      await sendEmails(await group.build(outcome));
    } catch (error) {
      console.error(`[email] ${group.name} fehlgeschlagen`, error);
    }
  }
}
