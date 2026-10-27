// German sentences for Verlauf entries (and later the mails built from them). Pure.
import {
  type AuditEvent,
  type RoleShift,
  TERMIN_FIELDS,
  type TerminField,
  type TerminSnapshot,
} from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/dates";
import { isBackup, KIND_LABEL, kindOf, type Role } from "@/lib/staffing";

/** "Instruktor", "Backup Praxisanleiter" */
function roleText(role: Role): string {
  const kind = KIND_LABEL[kindOf(role)].one;
  return isBackup(role) ? `Backup ${kind}` : kind;
}

const FIELD_LABEL: Record<TerminField, string> = {
  date: "Datum",
  startTime: "Beginn",
  endTime: "Ende",
  topic: "Thema",
  location: "Ort",
  instruktorenNeeded: KIND_LABEL.instruktor.many,
  praxisanleiterNeeded: KIND_LABEL.praxisanleiter.many,
};

function fieldValue(field: TerminField, value: string | number | null): string {
  if (value === null || value === "") return "–";
  if (field === "date") return formatDate(String(value));
  if (field === "startTime" || field === "endTime") {
    return formatTime(String(value));
  }
  return String(value);
}

/** "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026" */
function terminText(termin: TerminSnapshot): string {
  return `„${termin.kursTitle} – ${termin.topic}“ am ${formatDate(termin.date)}`;
}

/**
 * " (Instruktor)" for one role or an unchanged one, " (Backup → Instruktor)" for a change
 * (the kind never changes), "" for none.
 */
function roleSuffix(from: Role | null, to: Role | null): string {
  if (!from || !to || from === to) {
    const role = from ?? to;
    return role ? ` (${roleText(role)})` : "";
  }
  const short = (role: Role) => (isBackup(role) ? "Backup" : roleText(role));
  return ` (${short(from)} → ${short(to)})`;
}

/** The person the entry is about, as object of the actor's sentence: "Anna Huber" or "sich". */
function whom(event: AuditEvent, personName: string): string {
  return event.profileId !== null && event.profileId === event.actorId
    ? "sich"
    : personName;
}

/** The sentence for one entry, e.g. "Lea Berger hat Anna Huber ausgetragen (Instruktor)". */
export function auditSentence(event: AuditEvent): string {
  const actor = event.actorName;
  switch (event.type) {
    case "signup.created": {
      const { personName, from, to } = event.data;
      return `${actor} hat ${whom(event, personName)} eingetragen${roleSuffix(from, to)}`;
    }
    case "signup.removed": {
      const { personName, from, to } = event.data;
      return `${actor} hat ${whom(event, personName)} ausgetragen${roleSuffix(from, to)}`;
    }
    case "signup.moved": {
      const { personName, direction, from, to } = event.data;
      const where = direction === "up" ? "nach oben" : "nach unten";
      return `${actor} hat ${whom(event, personName)} ${where} verschoben${roleSuffix(from, to)}`;
    }
    case "termin.updated": {
      const changes = TERMIN_FIELDS.flatMap((field) => {
        const change = event.data.changes[field];
        if (!change) return [];
        const [from, to] = change.map((value) => fieldValue(field, value));
        return [`${FIELD_LABEL[field]} ${from} → ${to}`];
      });
      return `${actor} hat den Termin geändert (${changes.join(", ")})`;
    }
    case "termin.deleted":
      return `${actor} hat den Termin ${terminText(event.data.termin)} gelöscht`;
    case "kurs.deleted":
      return `${actor} hat den Kurs „${event.data.kursTitle}“ gelöscht`;
    case "person.removed": {
      const { personName, from, to } = event.data;
      return `${actor} hat ${personName} entfernt${roleSuffix(from, to)}`;
    }
    case "signup.role_changed":
      return consequence(event.data);
  }
}

/** What an action did to someone it didn't target, e.g. "Ben Maier rückt als Instruktor nach". */
function consequence({ personName, from, to }: RoleShift): string {
  if (!to)
    return `${personName} ist nicht mehr eingetragen${roleSuffix(from, to)}`;
  if (!from)
    return `${personName} ist jetzt eingetragen${roleSuffix(from, to)}`;
  if (isBackup(from) && !isBackup(to)) {
    return `${personName} rückt als ${roleText(to)} nach`;
  }
  if (!isBackup(from) && isBackup(to)) {
    return `${personName} wird Backup (${roleText(from)})`;
  }
  return `${personName}${roleSuffix(from, to)}`;
}

const viennaParts = new Intl.DateTimeFormat("de-AT", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/Vienna",
});

/** "Sa., 31.10., 14:05" in Vienna time. */
export function formatAuditTime(at: Date): string {
  const part = Object.fromEntries(
    viennaParts.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return `${part.weekday}, ${part.day}.${part.month}., ${part.hour}:${part.minute}`;
}

/** One action in the Verlauf: its main entry and, indented below, what followed from it. */
export type HistoryGroup = {
  actionId: string;
  time: string;
  text: string;
  consequences: string[];
};

/** Entries (newest first) grouped by action, in the order the actions first appear. */
export function historyGroups(events: AuditEvent[]): HistoryGroup[] {
  const byAction = new Map<string, AuditEvent[]>();
  for (const event of events) {
    byAction.set(event.actionId, [
      ...(byAction.get(event.actionId) ?? []),
      event,
    ]);
  }
  return [...byAction].map(([actionId, entries]) => {
    const main =
      entries.find((e) => e.type !== "signup.role_changed") ?? entries[0];
    return {
      actionId,
      time: formatAuditTime(main.createdAt),
      text: auditSentence(main),
      consequences: entries.filter((e) => e !== main).map(auditSentence),
    };
  });
}
