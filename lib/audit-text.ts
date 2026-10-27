// German sentences for Verlauf entries (and later the mails built from them). Pure.
import {
  type AuditEvent,
  type RoleShift,
  TERMIN_FIELDS,
  type TerminField,
  type TerminSnapshot,
} from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/dates";
import {
  hasQualification,
  isBackup,
  KIND_LABEL,
  KINDS,
  kindOf,
  type Role,
} from "@/lib/staffing";
import { COORDINATOR } from "@/lib/wording";

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
    case "kurs.created":
      return `${actor} hat den Kurs „${event.data.kursTitle}“ angelegt`;
    // The Termin panel, or the Termin label on the Kurs page, says which Termin.
    case "termin.created":
      return `${actor} hat den Termin angelegt`;
    case "kurs.updated": {
      const { title, description } = event.data.changes;
      const changes = [
        title && `Titel ${title.map(quoted).join(" → ")}`,
        description && `Beschreibung ${description.map(quoted).join(" → ")}`,
      ].filter(Boolean);
      return `${actor} hat den Kurs „${event.data.kursTitle}“ geändert (${changes.join(", ")})`;
    }
    case "person.registered": {
      const { personName, via } = event.data;
      if (via === "admin-emails") {
        return `${personName} hat sich registriert (fix als ${COORDINATOR.one} eingetragen)`;
      }
      const kinds = KINDS.filter((kind) => hasQualification(event.data, kind));
      const suffix = kinds.length
        ? ` (${kinds.map((kind) => KIND_LABEL[kind].one).join(", ")})`
        : "";
      return `${personName} hat sich mit dem Einladungslink registriert${suffix}`;
    }
    case "person.updated": {
      const { fullName, phone } = event.data.changes;
      const changes = [
        fullName && `Name ${fullName.join(" → ")}`,
        phone && "Telefon geändert",
      ].filter(Boolean);
      return `${actor} hat das Profil geändert (${changes.join(", ")})`;
    }
    case "person.qualification_changed": {
      const { personName, kind, granted } = event.data;
      return `${actor} hat ${whom(event, personName)} die Qualifikation ${KIND_LABEL[kind].one} ${granted ? "gegeben" : "entzogen"}`;
    }
    case "person.koordination_changed": {
      const { personName, granted } = event.data;
      return `${actor} hat ${whom(event, personName)} die Rolle ${COORDINATOR.one} ${granted ? "gegeben" : "entzogen"}`;
    }
  }
}

const EXCERPT_LENGTH = 50;

/** „text“, cut at a word after about 50 characters; "–" for empty text. */
function quoted(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (!flat) return "–";
  if (flat.length <= EXCERPT_LENGTH) return `„${flat}“`;
  const cut = flat.slice(0, EXCERPT_LENGTH + 1);
  const end = cut.lastIndexOf(" ");
  return `„${cut.slice(0, end > 0 ? end : EXCERPT_LENGTH).trimEnd()}…“`;
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

/**
 * One action in the Verlauf: its main entry and, indented below, what followed from it.
 * Outside the Termin panel, one group per Termin of the action.
 */
export type HistoryGroup = {
  actionId: string;
  /** Outside the Termin panel: the Termin this part of the action is about. */
  termin?: { id: string; label: string };
  time: string;
  text: string;
  consequences: string[];
};

/** Where a Verlauf is shown: a Termin's panel, a Kurs page, or a person's sheet. */
export type HistoryScope = "termin" | "kurs" | "person";

function groupBy<K, T>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function terminOf(event: AuditEvent): TerminSnapshot | undefined {
  return "termin" in event.data ? event.data.termin : undefined;
}

/** "Tag 1, Sa., 07.11.2026"; for a person also the Kurs: "Erste Hilfe – Tag 1, …" */
function terminLabel(termin: TerminSnapshot, scope: HistoryScope): string {
  const name =
    scope === "person" ? `${termin.kursTitle} – ${termin.topic}` : termin.topic;
  return `${name}, ${formatDate(termin.date)}`;
}

function group(actionId: string, entries: AuditEvent[]): HistoryGroup {
  const main =
    entries.find((e) => e.type !== "signup.role_changed") ?? entries[0];
  return {
    actionId,
    time: formatAuditTime(main.createdAt),
    text: auditSentence(main),
    consequences: entries.filter((e) => e !== main).map(auditSentence),
  };
}

/** An action's entries per Termin: those without a Termin first, then by date and time. */
function perTermin(entries: AuditEvent[]): AuditEvent[][] {
  const when = (part: AuditEvent[]) => {
    const termin = part.map(terminOf).find(Boolean);
    return termin ? `${termin.date} ${termin.startTime}` : "";
  };
  return [...groupBy(entries, (e) => e.terminId).values()].sort((a, b) =>
    when(a).localeCompare(when(b)),
  );
}

/**
 * Entries (newest first) grouped by action, in the order the actions first appear. Outside
 * the Termin panel each action is split per Termin, and each part names its Termin.
 */
export function historyGroups(
  events: AuditEvent[],
  scope: HistoryScope = "termin",
): HistoryGroup[] {
  return [...groupBy(events, (e) => e.actionId)].flatMap(
    ([actionId, entries]) => {
      if (scope === "termin") return [group(actionId, entries)];
      return perTermin(entries).map((part) => {
        const terminId = part[0].terminId;
        const termin = part.map(terminOf).find(Boolean);
        return terminId && termin
          ? {
              ...group(actionId, part),
              termin: { id: terminId, label: terminLabel(termin, scope) },
            }
          : group(actionId, part);
      });
    },
  );
}
