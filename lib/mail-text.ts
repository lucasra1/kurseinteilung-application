// German texts for staffing mails, built from the Verlauf entries of one action, so mail
// and Verlauf say the same. Pure: callers pass APP_URL and today's date.
import type {
  Actor,
  AuditEntry,
  AuditEvent,
  TerminSnapshot,
  TerminState,
} from "@/lib/audit";
import { auditSentence } from "@/lib/audit-text";
import { formatDate, formatTerminWhen } from "@/lib/dates";
import {
  isBackup,
  KIND_LABEL,
  KINDS,
  type Kind,
  needed,
  placesLabel,
} from "@/lib/staffing";

export type MailText = { subject: string; text: string };

const SIGNATURE = "\n\nKurseinteilung";

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

/**
 * Whether the block changed the staffing: someone's role, the order (↑/↓) or the numbers.
 * Other edits (time, place, Festschreiben) and deleting a Termin nobody was on only go
 * into the Verlauf.
 */
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
      const held = `– Der Termin ist festgeschrieben: ${placesLabel(places, kind)} ${verb} ausgeschrieben.`;
      if (angeschrieben.length === 0) return held;
      const who = angeschrieben.length === 1 ? "Backup" : "Backups";
      return `${held} Angeschrieben: ${angeschrieben.join(", ")} (${who}).`;
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

/**
 * The mail to the Praxisanleiterkoordinator:innen about one staffing action: per Termin the
 * action, its consequences as "– …" lines, the Stand afterwards and a link.
 */
export function coordinatorMail(input: {
  actor: Actor;
  /** The action's entries in the order `staffingEvents` built them. */
  entries: AuditEntry[];
  /** The Termine afterwards; deleted ones are missing. */
  after: TerminState[];
  /** YYYY-MM-DD in Vienna */
  today: string;
  appUrl: string;
}): MailText | null {
  const { actor } = input;
  const list = blocks(input.entries).filter(
    (block) => block.termin.date >= input.today && changesStaffing(block),
  );
  const [first] = list;
  if (!first) return null;

  const text = list.map((block) => {
    const now = input.after.find((s) => s.termin.id === block.terminId);
    const lines = [
      `„${block.termin.kursTitle} – ${block.termin.topic}“ am ${formatTerminWhen(block.termin)}`,
      `${auditSentence(asEvent(block.main, actor))}.`,
      ...block.consequences.map((entry) => consequenceLine(entry, actor)),
    ];
    if (now) {
      lines.push(
        `Aktueller Stand: ${staffingSummary(now)}.`,
        `${input.appUrl}/termine?termin=${block.terminId}`,
      );
    }
    return lines.join("\n");
  });

  return {
    subject: subject(first.main, first.termin, actor),
    text: text.join("\n\n") + SIGNATURE,
  };
}

/** "Platz frei" to one backup of the role whose places were just ausgeschrieben. */
export function platzFreiMail(input: {
  termin: TerminSnapshot & { id: string };
  kind: Kind;
  places: number;
  name: string;
  appUrl: string;
}): MailText {
  const { termin, kind, places } = input;
  const freed =
    places === 1
      ? `ist ein ${KIND_LABEL[kind].one}-Platz frei geworden. Du bist dort Backup. Wer zuerst übernimmt, bekommt den Platz.`
      : `sind ${placesLabel(places, kind)} frei geworden. Du bist dort Backup. Wer zuerst übernimmt, bekommt einen davon.`;
  return {
    subject: `Platz frei: ${termin.kursTitle}, ${formatDate(termin.date)}`,
    text:
      `Hallo ${input.name},\n\n` +
      `bei „${termin.kursTitle} – ${termin.topic}“ am ${formatTerminWhen(termin)} ${freed}\n\n` +
      `${input.appUrl}/termine?termin=${termin.id}${SIGNATURE}`,
  };
}
