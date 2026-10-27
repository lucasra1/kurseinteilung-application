import "server-only";
import { eq, inArray, or } from "drizzle-orm";
import type {
  Actor,
  AuditEntry,
  StaffingTermin,
  TerminState,
} from "@/lib/audit";
import { formatDate, formatTerminWhen, todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { type EmailMessage, sendEmails } from "@/lib/email";
import { env } from "@/lib/env";
import {
  adminMail,
  gebrauchtMail,
  type MailText,
  type PlaceMailInput,
  platzFreiMail,
  SIGNATURE,
} from "@/lib/mail-text";
import { type Kind, ROLE_LABEL, type RoleChange } from "@/lib/staffing";

export type StaffingChange = RoleChange & {
  termin: StaffingTermin;
  person: { fullName: string; email: string };
};

function describe(termin: StaffingTermin) {
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

/**
 * Places of one role and whom to write about them, without the actor: the backups
 * ("Platz frei"), or without a backup the qualified not on the Termin ("Du wirst gebraucht").
 */
export type PlaceMail = {
  termin: StaffingTermin;
  kind: Kind;
  places: number;
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
  platzFrei: PlaceMail[];
  gebraucht: PlaceMail[];
};

/** One mail per recipient of each `PlaceMail`, worded by `text`. */
function placeEmails(
  list: PlaceMail[],
  text: (input: PlaceMailInput) => MailText,
): EmailMessage[] {
  return list.flatMap(({ termin, kind, places, recipients }) =>
    recipients.map((person) => ({
      to: person.email,
      ...text({
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

/** One mail about the whole action to every admin but the actor. */
async function adminEmails(outcome: StaffingOutcome) {
  const mail = adminMail({
    actor: outcome.actor,
    entries: outcome.entries,
    after: outcome.after,
    today: todayInVienna(),
    appUrl: env.APP_URL,
  });
  if (!mail) return [];
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
    .filter((admin) => admin.id !== outcome.actor.id)
    .map((admin) => ({ to: admin.email, ...mail }));
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
  {
    name: "platz-frei",
    build: async (outcome) => placeEmails(outcome.platzFrei, platzFreiMail),
  },
  {
    name: "gebraucht",
    build: async (outcome) => placeEmails(outcome.gebraucht, gebrauchtMail),
  },
  { name: "betroffene", build: betroffeneEmails },
  { name: "admins", build: adminEmails },
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
