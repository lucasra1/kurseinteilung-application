// German sentences for Verlauf entries, grouped by action for display; the mails reuse the
// sentences. Pure.
import {
  type AuditEvent,
  aufrufCount,
  ausgeschriebenTo,
  isConsequence,
  type RoleShift,
  TERMIN_FIELDS,
  type TerminField,
  type TerminSnapshot,
} from "@/lib/audit";
import { formatDate, formatTime } from "@/lib/dates";
import {
  type ExistingSubjects,
  type HistoryScope,
  type SubjectKind,
  subjectHref,
} from "@/lib/history-source";
import {
  hasQualification,
  isBackup,
  KIND_LABEL,
  KINDS,
  kindOf,
  placesLabel,
  type Role,
} from "@/lib/staffing";
import { COORDINATOR, countOf } from "@/lib/wording";

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
export function terminText(
  termin: Pick<TerminSnapshot, "kursTitle" | "topic" | "date">,
): string {
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
    case "termin.festgeschrieben":
      return `${actor} hat den Termin festgeschrieben`;
    case "termin.aufgehoben":
      return `${actor} hat die Festschreibung aufgehoben`;
    case "kurs.deleted":
      return `${actor} hat den Kurs „${event.data.kursTitle}“ gelöscht`;
    case "person.removed": {
      const { personName, from, to } = event.data;
      return `${actor} hat ${personName} entfernt${roleSuffix(from, to)}`;
    }
    case "signup.role_changed":
      return consequence(event.data);
    case "signup.claimed": {
      const { from, to } = event.data;
      return `${actor} hat den Platz übernommen${roleSuffix(from, to)}`;
    }
    case "signup.place_given": {
      const { personName, from, to } = event.data;
      return `${actor} hat ${whom(event, personName)} den Platz gegeben${roleSuffix(from, to)}`;
    }
    case "place.ausgeschrieben": {
      const { kind, places } = event.data;
      const names = ausgeschriebenTo(event.data);
      const text = `${placesLabel(places, kind)} ausgeschrieben`;
      return names.length > 0
        ? `${text}, angeschrieben: ${names.join(", ")}`
        : text;
    }
    case "place.aufruf": {
      const { kind, places } = event.data;
      const count = aufrufCount(event.data);
      const missing = `${placesLabel(places, kind)} ${places === 1 ? "fehlt" : "fehlen"}`;
      if (count === 0) {
        return `${missing}, kein Backup und sonst niemand qualifiziert`;
      }
      return `${missing}, kein Backup: ${qualifiedCount(count)} angeschrieben`;
    }
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

/** "14 Qualifizierte", "1 qualifizierte Person" */
export function qualifiedCount(n: number): string {
  return countOf(n, { one: "qualifizierte Person", many: "Qualifizierte" });
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

/** The Termin, Kurs or person a group is about, named as it was at the time. */
export type HistorySubject = {
  kind: SubjectKind;
  id: string;
  label: string;
  /** On the Verlauf page, while it still exists. */
  href?: string;
};

/**
 * One action in the Verlauf: its main entry and, indented below, what followed from it.
 * Outside the Termin panel, one group per Termin of the action.
 */
export type HistoryGroup = {
  actionId: string;
  /**
   * Outside the Termin panel: the Termin this part of the action is about. On the Verlauf
   * page, for a part without a Termin, its Kurs or else its person.
   */
  about?: HistorySubject;
  time: string;
  text: string;
  consequences: string[];
};

/** One page of a Verlauf; `nextCursor` loads the older entries, null if there are none. */
export type HistoryView = { groups: HistoryGroup[]; nextCursor: string | null };

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

/** "Tag 1, Sa., 07.11.2026"; outside the Kurs page also the Kurs: "Erste Hilfe – Tag 1, …" */
function terminLabel(termin: TerminSnapshot, scope: HistoryScope): string {
  const name =
    scope === "kurs" ? termin.topic : `${termin.kursTitle} – ${termin.topic}`;
  return `${name}, ${formatDate(termin.date)}`;
}

function mainOf(entries: AuditEvent[]): AuditEvent {
  return entries.find((e) => !isConsequence(e.type)) ?? entries[0];
}

/** What one part of an action (its entries on one Termin, or those on none) is about. */
function subjectOf(
  part: AuditEvent[],
  scope: HistoryScope,
): HistorySubject | undefined {
  const terminId = part[0].terminId;
  const termin = part.map(terminOf).find(Boolean);
  if (terminId && termin) {
    return { kind: "termin", id: terminId, label: terminLabel(termin, scope) };
  }
  if (scope !== "all") return undefined;
  const { kursId, profileId, data } = mainOf(part);
  if (kursId && "kursTitle" in data) {
    return { kind: "kurs", id: kursId, label: data.kursTitle };
  }
  if (profileId && "personName" in data) {
    return { kind: "person", id: profileId, label: data.personName };
  }
  return undefined;
}

function group(actionId: string, entries: AuditEvent[]): HistoryGroup {
  const main = mainOf(entries);
  const rest = entries.filter((e) => e !== main);
  // Read back, an action's entries have no order: role changes before Ausschreibungen.
  const roleChanges = rest.filter((e) => e.type === "signup.role_changed");
  const others = rest.filter((e) => e.type !== "signup.role_changed");
  return {
    actionId,
    time: formatAuditTime(main.createdAt),
    text: auditSentence(main),
    consequences: [...roleChanges, ...others].map(auditSentence),
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
 * the Termin panel each action is split per Termin, and each part names what it's about;
 * subjects in `existing` get a link.
 */
export function historyGroups(
  events: AuditEvent[],
  scope: HistoryScope = "termin",
  existing?: ExistingSubjects,
): HistoryGroup[] {
  return [...groupBy(events, (e) => e.actionId)].flatMap(
    ([actionId, entries]) => {
      if (scope === "termin") return [group(actionId, entries)];
      return perTermin(entries).map((part) => {
        const about = subjectOf(part, scope);
        if (!about) return group(actionId, part);
        const linked = existing?.[about.kind].has(about.id)
          ? { ...about, href: subjectHref(about.kind, about.id) }
          : about;
        return { ...group(actionId, part), about: linked };
      });
    },
  );
}
