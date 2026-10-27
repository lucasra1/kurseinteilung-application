/** The two qualifications; every signup is for one of them. */
export type Kind = "instruktor" | "praxisanleiter";

export const KINDS: Kind[] = ["instruktor", "praxisanleiter"];

/** A signup's role: a fixed place of its kind, or a backup for that kind. */
export type Role = Kind | "backup-instruktor" | "backup-praxisanleiter";

export const KIND_LABEL: Record<Kind, { one: string; many: string }> = {
  instruktor: { one: "Instruktor", many: "Instruktoren" },
  praxisanleiter: { one: "Praxisanleiter", many: "Praxisanleiter" },
};

export const ROLE_LABEL: Record<Role, string> = {
  instruktor: "Instruktor",
  praxisanleiter: "Praxisanleiter",
  "backup-instruktor": "Backup (Instruktor)",
  "backup-praxisanleiter": "Backup (Praxisanleiter)",
};

export type Staffing = {
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
};

export type Qualifications = {
  isInstruktor: boolean;
  isPraxisanleiter: boolean;
};

export function needed(s: Staffing, kind: Kind): number {
  return kind === "instruktor" ? s.instruktorenNeeded : s.praxisanleiterNeeded;
}

export function hasQualification(q: Qualifications, kind: Kind): boolean {
  return kind === "instruktor" ? q.isInstruktor : q.isPraxisanleiter;
}

export function kindOf(role: Role): Kind {
  return role === "instruktor" || role === "backup-instruktor"
    ? "instruktor"
    : "praxisanleiter";
}

export function isBackup(role: Role): boolean {
  return role.startsWith("backup-");
}

/** Signup order: by position, then createdAt. */
export function sortByPosition<T extends { position: number; createdAt: Date }>(
  signups: T[],
): T[] {
  return [...signups].sort(
    (a, b) =>
      a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

/**
 * Derives roles: within each kind, the first N in signup order hold the fixed places,
 * everyone after them is a backup for that kind. `rank` is 1-based within the kind.
 */
export function rankSignups<
  T extends { position: number; createdAt: Date; kind: Kind },
>(signups: T[], s: Staffing): Array<T & { role: Role; rank: number }> {
  const seen: Record<Kind, number> = { instruktor: 0, praxisanleiter: 0 };
  return sortByPosition(signups).map((signup) => {
    const rank = ++seen[signup.kind];
    const role: Role =
      rank <= needed(s, signup.kind) ? signup.kind : `backup-${signup.kind}`;
    return { ...signup, rank, role };
  });
}

/** The role the next person signing up for `kind` gets. */
export function nextRole(
  signups: { role: Role }[],
  s: Staffing,
  kind: Kind,
): Role {
  const taken = signups.filter((signup) => signup.role === kind).length;
  return taken < needed(s, kind) ? kind : `backup-${kind}`;
}

/** Free fixed places per kind. */
export type Missing = Record<Kind, number>;

export function missingPlaces(signups: { role: Role }[], s: Staffing): Missing {
  const free = (kind: Kind) =>
    Math.max(
      needed(s, kind) - signups.filter((x) => x.role === kind).length,
      0,
    );
  return {
    instruktor: free("instruktor"),
    praxisanleiter: free("praxisanleiter"),
  };
}

/** "2 Instruktoren fehlen", "1 Instruktor, 1 Praxisanleiter fehlen" or "Voll besetzt". */
export function staffingLabel(missing: Missing): string {
  const parts = KINDS.filter((kind) => missing[kind] > 0).map(
    (kind) =>
      `${missing[kind]} ${missing[kind] === 1 ? KIND_LABEL[kind].one : KIND_LABEL[kind].many}`,
  );
  if (parts.length === 0) return "Voll besetzt";
  const verb =
    parts.length === 1 && missing.instruktor + missing.praxisanleiter === 1
      ? "fehlt"
      : "fehlen";
  return `${parts.join(", ")} ${verb}`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Today's day 3 calendar months on, as YYYY-MM-DD. It may not exist (30.11. → "02-30"):
 * compared as a string it still lies after every day of that month and before the next
 * month, so it acts as the month's last day.
 */
function autoFestgeschriebenBis(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const target = month - 1 + 3;
  const y = year + Math.floor(target / 12);
  const m = (target % 12) + 1;
  return `${y}-${pad(m)}-${pad(day)}`;
}

/**
 * Whether a Termin's staffing is binding: set manually, or at most 3 calendar months after
 * `today` (Vienna, YYYY-MM-DD). Past Termine count as festgeschrieben too.
 */
export function isFestgeschrieben(
  termin: { date: string; festgeschrieben: boolean },
  today: string,
): boolean {
  return termin.festgeschrieben || termin.date <= autoFestgeschriebenBis(today);
}

/** What setting or lifting the manual Festschreibung of a selection did. */
export type FestschreibungResult = {
  /** Selected Termine whose flag changed. */
  changed: number;
  /** After lifting: selected Termine still festgeschrieben by date. */
  automatisch: number;
};

const termineCount = (n: number) => `${n} ${n === 1 ? "Termin" : "Termine"}`;

/** The feedback after Festschreiben (`value` true) or Aufheben. */
export function festschreibungMessage(
  value: boolean,
  { changed, automatisch }: FestschreibungResult,
): string {
  if (value) {
    return changed === 0
      ? "Die Auswahl war schon festgeschrieben."
      : `${termineCount(changed)} festgeschrieben.`;
  }
  const lifted =
    changed === 0
      ? "In der Auswahl war nichts manuell festgeschrieben."
      : `Festschreibung bei ${changed} ${changed === 1 ? "Termin" : "Terminen"} aufgehoben.`;
  if (automatisch === 0) return lifted;
  return `${lifted} ${termineCount(automatisch)} ${automatisch === 1 ? "bleibt" : "bleiben"} automatisch festgeschrieben (weniger als 3 Monate).`;
}

/** terminId → profileId → role */
export type RoleSnapshot = Map<string, Map<string, Role>>;

export type RoleChange = {
  terminId: string;
  profileId: string;
  from: Role | null;
  to: Role | null;
};

export function diffRoles(
  before: RoleSnapshot,
  after: RoleSnapshot,
): RoleChange[] {
  const changes: RoleChange[] = [];
  const terminIds = new Set([...before.keys(), ...after.keys()]);
  for (const terminId of terminIds) {
    const rolesBefore = before.get(terminId) ?? new Map<string, Role>();
    const rolesAfter = after.get(terminId) ?? new Map<string, Role>();
    const profileIds = new Set([...rolesBefore.keys(), ...rolesAfter.keys()]);
    for (const profileId of profileIds) {
      const from = rolesBefore.get(profileId) ?? null;
      const to = rolesAfter.get(profileId) ?? null;
      if (from !== to) changes.push({ terminId, profileId, from, to });
    }
  }
  return changes;
}
