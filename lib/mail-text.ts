// German texts for staffing mails, built from the Verlauf entries of one action, so mail
// and Verlauf say the same. Pure: callers pass APP_URL and today's date.
import type {
  Actor,
  AuditEntry,
  AuditEvent,
  TerminSnapshot,
  TerminState,
} from "@/lib/audit";
import { auditSentence, qualifiedCount } from "@/lib/audit-text";
import { formatDate, formatTerminWhen } from "@/lib/dates";
import {
  isBackup,
  KIND_LABEL,
  KINDS,
  type Kind,
  needed,
  placesLabel,
  ROLE_LABEL,
  type Role,
} from "@/lib/staffing";
import { placesFreedText } from "@/lib/warning-text";

export type MailText = { subject: string; text: string };

/** Ends every staffing mail. */
export const SIGNATURE = "\n\nKurseinteilung";

/** One Termin of the action: its main entry, then the consequences, in the action's order. */
type Block = {
  terminId: string;
  termin: TerminSnapshot;
  main: AuditEntry;
  consequences: AuditEntry[];
};

// auditSentence reads stored entries; id, action and time don't matter for the sentence.
function asEvent(entry: AuditEntry, actor: Actor): AuditEvent {
  return {
    ...entry,
    id: "",
    actionId: "",
    createdAt: new Date(0),
    actorId: actor.id,
    actorName: actor.fullName,
    terminId: entry.terminId ?? null,
    kursId: entry.kursId ?? null,
    profileId: entry.profileId ?? null,
  } as AuditEvent;
}

/**
 * Entries grouped by Termin, in date order; the first entry of a Termin is the action's
 * main entry.
 */
function blocks(entries: AuditEntry[]): Block[] {
  const byTermin = new Map<string, Block>();
  for (const entry of entries) {
    if (!entry.terminId || !("termin" in entry.data) || !entry.data.termin) {
      continue;
    }
    const block = byTermin.get(entry.terminId);
    if (block) block.consequences.push(entry);
    else {
      byTermin.set(entry.terminId, {
        terminId: entry.terminId,
        termin: entry.data.termin,
        main: entry,
        consequences: [],
      });
    }
  }
  const when = (b: Block) => `${b.termin.date} ${b.termin.startTime}`;
  return [...byTermin.values()].sort((a, b) => when(a).localeCompare(when(b)));
}

function shiftsRole(entry: AuditEntry): boolean {
  return "from" in entry.data && entry.data.from !== entry.data.to;
}

/** Whether the block changed a role, the order (↑/↓) or the numbers; else Verlauf only. */
function changesStaffing({ main, consequences }: Block): boolean {
  if ([main, ...consequences].some(shiftsRole)) return true;
  if (main.type === "signup.moved") return true;
  if (main.type === "termin.updated") {
    const { changes } = main.data;
    return "instruktorenNeeded" in changes || "praxisanleiterNeeded" in changes;
  }
  return false;
}

/** "Instruktoren 1/2, Praxisanleiter 1/1, 2 Backups" */
function staffingSummary(state: TerminState): string {
  const parts = KINDS.flatMap((kind) => {
    const places = needed(state.termin, kind);
    const fixed = state.signups.filter((s) => s.role === kind).length;
    return places > 0 ? [`${KIND_LABEL[kind].many} ${fixed}/${places}`] : [];
  });
  const backups = state.signups.filter((s) => isBackup(s.role)).length;
  if (backups > 0)
    parts.push(backups === 1 ? "1 Backup" : `${backups} Backups`);
  return parts.join(", ");
}

/**
 * A consequence as a "– …" line, worded like the Verlauf. Consequences whose mail wording
 * differs (Ausschreibung, Aufruf) switch on `entry.type` here.
 */
function consequenceLine(entry: AuditEntry, actor: Actor): string {
  switch (entry.type) {
    case "place.ausgeschrieben": {
      const { kind, places, angeschrieben } = entry.data;
      const verb = places === 1 ? "ist" : "sind";
      const line = `– Der Termin ist festgeschrieben: ${placesLabel(places, kind)} ${verb} ausgeschrieben.`;
      if (angeschrieben.length === 0) return line;
      const who = angeschrieben.length === 1 ? "Backup" : "Backups";
      return `${line} Angeschrieben: ${angeschrieben.join(", ")} (${who}).`;
    }
    case "place.aufruf": {
      const { angeschrieben } = entry.data;
      return angeschrieben === 0
        ? "– Kein Backup und sonst niemand qualifiziert."
        : `– Kein Backup: ${qualifiedCount(angeschrieben)} angeschrieben.`;
    }
    default:
      return `– ${auditSentence(asEvent(entry, actor))}.`;
  }
}

/** Names the kind of action; anything without its own subject is "Besetzung geändert". */
function subject(main: AuditEntry, termin: TerminSnapshot, actor: Actor) {
  const at = `${termin.kursTitle}, ${formatDate(termin.date)}`;
  switch (main.type) {
    case "signup.created":
      return `Eintragung: ${at}`;
    case "signup.claimed":
      return `Platz übernommen: ${at}`;
    case "signup.place_given":
      return `Platz gegeben: ${at}`;
    case "signup.removed":
      return main.profileId === actor.id
        ? `Abmeldung: ${at}`
        : `Ausgetragen: ${at}`;
    case "termin.deleted":
      return `Termin gelöscht: ${at}`;
    case "kurs.deleted":
      return `Kurs gelöscht: ${main.data.kursTitle}`;
    case "person.removed":
      return `Person entfernt: ${main.data.personName}`;
    default:
      return `Besetzung geändert: ${at}`;
  }
}

/** One staffing action, as `mutateStaffing` hands it over after the commit. */
export type ActionMailInput = {
  actor: Actor;
  /** The action's entries in the order `staffingEvents` built them. */
  entries: AuditEntry[];
  /** The Termine afterwards; deleted ones are missing. */
  after: TerminState[];
  /** YYYY-MM-DD in Vienna */
  today: string;
  appUrl: string;
};

/**
 * The mail to the Praxisanleiterkoordinator:innen about one staffing action: per Termin the
 * action, its consequences as "– …" lines, the Stand afterwards and a link.
 */
export function adminMail(input: ActionMailInput): MailText | null {
  const { actor } = input;
  const list = blocks(input.entries).filter(
    (block) => block.termin.date >= input.today && changesStaffing(block),
  );
  const [first] = list;
  if (!first) return null;

  const text = list.map((block) => {
    const now = input.after.find((s) => s.termin.id === block.terminId);
    const paragraphs = [
      `„${block.termin.kursTitle} – ${block.termin.topic}“ am ${formatTerminWhen(block.termin)}\n` +
        `${auditSentence(asEvent(block.main, actor))}.`,
    ];
    if (block.consequences.length > 0) {
      paragraphs.push(
        block.consequences
          .map((entry) => consequenceLine(entry, actor))
          .join("\n"),
      );
    }
    if (now) {
      paragraphs.push(
        `Aktueller Stand: ${staffingSummary(now)}.`,
        `${input.appUrl}/termine?termin=${block.terminId}`,
      );
    }
    return paragraphs.join("\n\n");
  });

  return {
    subject: subject(first.main, first.termin, actor),
    text: text.join("\n\n") + SIGNATURE,
  };
}

/** A mail to one person (`name`) about `places` of one role of a Termin. */
export type PlaceMailInput = {
  termin: TerminSnapshot & { id: string };
  kind: Kind;
  places: number;
  name: string;
  appUrl: string;
};

/** "Platz frei" to one backup of the role whose places were just ausgeschrieben. */
export function platzFreiMail(input: PlaceMailInput): MailText {
  const { termin, kind, places } = input;
  return {
    subject: `Platz frei: ${termin.kursTitle}, ${formatDate(termin.date)}`,
    text:
      `Hallo ${input.name},\n\n` +
      `du bist Backup bei „${termin.kursTitle} – ${termin.topic}“ am ${formatTerminWhen(termin)}. ${placesFreedText(kind, places)}\n\n` +
      `${input.appUrl}/termine?termin=${termin.id}${SIGNATURE}`,
  };
}

/** "Du wirst gebraucht" to someone qualified who isn't on a Termin lacking places without a backup. */
export function gebrauchtMail(input: PlaceMailInput): MailText {
  const { termin, kind, places } = input;
  const missing =
    places === 1
      ? `fehlt ein ${KIND_LABEL[kind].one}`
      : `fehlen ${places} ${KIND_LABEL[kind].many}`;
  return {
    subject: `Du wirst gebraucht: ${termin.kursTitle}, ${formatDate(termin.date)}`,
    text:
      `Hallo ${input.name},\n\n` +
      `bei „${termin.kursTitle} – ${termin.topic}“ am ${formatTerminWhen(termin)} ${missing}. Wenn du Zeit hast, trag dich ein.\n\n` +
      `${input.appUrl}/termine?termin=${termin.id}${SIGNATURE}`,
  };
}

/** "Eingetragen", "Ausgetragen" or "Neue Rolle" to someone whose role another person changed. */
export function betroffeneMail(input: {
  termin: TerminSnapshot;
  name: string;
  from: Role | null;
  to: Role | null;
  appUrl: string;
}): MailText {
  const { termin, from, to } = input;
  const what = `„${termin.kursTitle} – ${termin.topic}“`;
  const when = formatTerminWhen(termin);
  const at = `${termin.kursTitle}, ${formatDate(termin.date)}`;
  const greeting = `Hallo ${input.name},\n\n`;
  const link = `\n\n${input.appUrl}/meine${SIGNATURE}`;
  if (from && to) {
    return {
      subject: `Neue Rolle: ${at}`,
      text: `${greeting}deine Rolle für ${what} am ${when} hat sich geändert: ${ROLE_LABEL[from]} → ${ROLE_LABEL[to]}.${link}`,
    };
  }
  if (to) {
    return {
      subject: `Eingetragen: ${at}`,
      text: `${greeting}du wurdest für ${what} am ${when} als ${ROLE_LABEL[to]} eingetragen.${link}`,
    };
  }
  return {
    subject: `Ausgetragen: ${at}`,
    text: `${greeting}du wurdest von ${what} am ${when} ausgetragen.${link}`,
  };
}

/** The mail groups in sending order (spec 4, Kontingent). */
export const MAIL_GROUPS = [
  "platz-frei",
  "gebraucht",
  "betroffene",
  "admins",
] as const;

export type MailGroup = (typeof MAIL_GROUPS)[number];

/**
 * A staffing mail, to one person by profile ID (the address is looked up when sending) or
 * to every admin but the actor.
 */
export type StaffingMail = MailText &
  (
    | { group: Exclude<MailGroup, "admins">; profileId: string }
    | { group: "admins" }
  );

/** "Platz frei" to each backup an Ausschreibung names, "Du wirst gebraucht" to each Aufruf's. */
function placeMails(entry: AuditEntry, appUrl: string): StaffingMail[] {
  if (
    (entry.type !== "place.ausgeschrieben" && entry.type !== "place.aufruf") ||
    !entry.terminId
  ) {
    return [];
  }
  const [group, text] =
    entry.type === "place.ausgeschrieben"
      ? (["platz-frei", platzFreiMail] as const)
      : (["gebraucht", gebrauchtMail] as const);
  const { termin, kind, places, recipients = [] } = entry.data;
  const id = entry.terminId;
  return recipients.map(({ profileId, personName }) => ({
    group,
    profileId,
    ...text({
      termin: { ...termin, id },
      kind,
      places,
      name: personName,
      appUrl,
    }),
  }));
}

/** A mail to the person whose role the entry changed, unless they're in `skip`. */
function betroffeneMails(
  entry: AuditEntry,
  skip: ReadonlySet<string>,
  appUrl: string,
) {
  const { profileId, data } = entry;
  if (!profileId || skip.has(profileId)) return [];
  if (!("from" in data) || data.from === data.to || !data.termin) return [];
  const { termin, personName, from, to } = data;
  const mail = betroffeneMail({ termin, name: personName, from, to, appUrl });
  return [{ group: "betroffene" as const, profileId, ...mail }];
}

/** Every mail of one staffing action, built from its entries alone, in sending order. */
export function staffingMails(input: ActionMailInput): StaffingMail[] {
  const { actor, entries, appUrl } = input;
  // The actor knows; a removed account has no address any more.
  const skip = new Set([
    actor.id,
    ...entries.flatMap((e) =>
      e.type === "person.removed" && e.profileId ? [e.profileId] : [],
    ),
  ]);
  const upcoming = entries.filter(
    (e) =>
      "termin" in e.data && e.data.termin && e.data.termin.date >= input.today,
  );
  const admins = adminMail(input);
  const mails: StaffingMail[] = [
    ...upcoming.flatMap((entry) => [
      ...placeMails(entry, appUrl),
      ...betroffeneMails(entry, skip, appUrl),
    ]),
    ...(admins ? [{ group: "admins" as const, ...admins }] : []),
  ];
  const rank = (mail: StaffingMail) => MAIL_GROUPS.indexOf(mail.group);
  return mails.sort((a, b) => rank(a) - rank(b));
}
