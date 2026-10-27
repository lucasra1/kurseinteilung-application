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

/** Places needed per kind, and how many of them are ausgeschrieben (held for the backups). */
export type Staffing = {
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
  instruktorenAusgeschrieben: number;
  praxisanleiterAusgeschrieben: number;
};

/** Just the places needed, for what doesn't depend on held places. */
export type Needed = Pick<
  Staffing,
  "instruktorenNeeded" | "praxisanleiterNeeded"
>;

export type Qualifications = {
  isInstruktor: boolean;
  isPraxisanleiter: boolean;
};

export function needed(s: Needed, kind: Kind): number {
  return kind === "instruktor" ? s.instruktorenNeeded : s.praxisanleiterNeeded;
}

export function ausgeschrieben(s: Staffing, kind: Kind): number {
  return kind === "instruktor"
    ? s.instruktorenAusgeschrieben
    : s.praxisanleiterAusgeschrieben;
}

/** How many signups of a kind hold a fixed place at most: the places not ausgeschrieben. */
export function fixedPlaces(s: Staffing, kind: Kind): number {
  return Math.max(0, needed(s, kind) - ausgeschrieben(s, kind));
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
 * Derives roles: within each kind, the first N − A in signup order hold the fixed places
 * (N needed, A ausgeschrieben), everyone after them is a backup for that kind. `rank` is
 * 1-based within the kind.
 */
export function rankSignups<
  T extends { position: number; createdAt: Date; kind: Kind },
>(signups: T[], s: Staffing): Array<T & { role: Role; rank: number }> {
  const seen: Record<Kind, number> = { instruktor: 0, praxisanleiter: 0 };
  return sortByPosition(signups).map((signup) => {
    const rank = ++seen[signup.kind];
    const role: Role =
      rank <= fixedPlaces(s, signup.kind)
        ? signup.kind
        : `backup-${signup.kind}`;
    return { ...signup, rank, role };
  });
}

/**
 * The role the next person signing up for `kind` gets, given ranked `signups`: a fixed
 * place while one is free, ausgeschriebene ones included.
 */
export function nextRole(
  signups: { role: Role }[],
  s: Needed,
  kind: Kind,
): Role {
  const taken = signups.filter((signup) => signup.role === kind).length;
  return taken < needed(s, kind) ? kind : `backup-${kind}`;
}

/**
 * Whether `profileId` is a backup of a role with an ausgeschriebenen place on the Termin,
 * so they can take it (Platz übernehmen, or a coordinator's Platz geben).
 */
export function canClaimPlace(
  termin: Staffing & { signups: { profileId: string; role: Role }[] },
  profileId: string,
): boolean {
  const signup = termin.signups.find((s) => s.profileId === profileId);
  return (
    !!signup &&
    isBackup(signup.role) &&
    ausgeschrieben(termin, kindOf(signup.role)) > 0
  );
}

/** Free fixed places per kind. */
export type Missing = Record<Kind, number>;

/** Per kind `needed − fixed`, given ranked `signups`: ausgeschriebene places are missing. */
export function missingPlaces(signups: { role: Role }[], s: Needed): Missing {
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

/**
 * Whether a Termin belongs under "Wo du gebraucht wirst" for `viewer`, given ranked
 * signups: a free fixed place of a role they're qualified for while they aren't on it yet,
 * or an ausgeschriebener place of the role they're backup for.
 */
export function needsViewer(
  termin: Staffing & { signups: { profileId: string; role: Role }[] },
  viewer: Qualifications & { id: string },
): boolean {
  if (termin.signups.some((s) => s.profileId === viewer.id)) {
    return canClaimPlace(termin, viewer.id);
  }
  const missing = missingPlaces(termin.signups, termin);
  return KINDS.some(
    (kind) => missing[kind] > 0 && hasQualification(viewer, kind),
  );
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

/** "1 Instruktor-Platz", "2 Praxisanleiter-Plätze" */
export function placesLabel(places: number, kind: Kind): string {
  return `${places} ${KIND_LABEL[kind].one}-${places === 1 ? "Platz" : "Plätze"}`;
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

/** What a change does to one role of a Termin besides the roles themselves. */
export type Trigger =
  | { type: "none" }
  /**
   * `places` newly ausgeschrieben; `recipients` are the role's backups (profile ids, in
   * backup order) without the actor: they get "Platz frei".
   */
  | { type: "backups"; places: number; recipients: string[] }
  /** No backup for the role: `places` more fixed places are missing than before. */
  | { type: "aufruf"; places: number };

export type RolePlan = {
  /** The counter of ausgeschriebene places after the change. */
  ausgeschrieben: number;
  trigger: Trigger;
};

/** One Termin's result of `planAusschreibung`. */
export type AusschreibungPlan = {
  terminId: string;
  roles: Record<Kind, RolePlan>;
};

type PlanSignup = {
  profileId: string;
  kind: Kind;
  position: number;
  createdAt: Date;
};

/** A Termin's numbers, counters and signups at one point of a change. */
type PlanSide = { staffing: Staffing; signups: PlanSignup[] };

export type AusschreibungInput = {
  terminId: string;
  /** As locked before the change. */
  before: PlanSide;
  /** After the change ran, with the counters as it left them (claiming lowers them). */
  after: PlanSide;
  /** After the change (`isFestgeschrieben`). */
  festgeschrieben: boolean;
  isPast: boolean;
  /**
   * People the change put on a fixed place on purpose (Platz übernehmen, Platz geben, ↑/↓):
   * they never count as moving up.
   */
  explicit: ReadonlySet<string>;
  /** Never a recipient. */
  actorId: string;
};

function withAusgeschrieben(s: Staffing, kind: Kind, count: number): Staffing {
  return kind === "instruktor"
    ? { ...s, instruktorenAusgeschrieben: count }
    : { ...s, praxisanleiterAusgeschrieben: count };
}

function planRole(
  kind: Kind,
  input: AusschreibungInput,
  rankedBefore: Array<PlanSignup & { role: Role }>,
): RolePlan {
  const { before, after } = input;
  const backup: Role = `backup-${kind}`;
  // 1. A lower number takes ausgeschriebene places away first, fixed ones only after.
  const cut = Math.max(
    0,
    needed(before.staffing, kind) - needed(after.staffing, kind),
  );
  let count = Math.max(0, ausgeschrieben(after.staffing, kind) - cut);
  const none: Trigger = { type: "none" };
  // 2. Past: the counter stays, so the staffing reads right in hindsight.
  if (input.isPast) return { ausgeschrieben: count, trigger: none };
  // 3. Not binding: backups move up as they always did.
  if (!input.festgeschrieben) return { ausgeschrieben: 0, trigger: none };
  const counted = count;

  // 4. Backups who would move up stay backups: their places are held instead.
  const wasBackup = new Set(
    rankedBefore.filter((s) => s.role === backup).map((s) => s.profileId),
  );
  const rankWith = (n: number) =>
    rankSignups(after.signups, withAusgeschrieben(after.staffing, kind, n));
  count += rankWith(count).filter(
    (s) =>
      s.role === kind &&
      wasBackup.has(s.profileId) &&
      !input.explicit.has(s.profileId),
  ).length;
  const rankedAfter = rankWith(count);

  // 5. More fixed places missing than before: offer them to the backups, else call out.
  const more =
    missingPlaces(rankedAfter, after.staffing)[kind] -
    missingPlaces(rankedBefore, before.staffing)[kind];
  if (more <= 0) return { ausgeschrieben: count, trigger: none };
  const backups = rankedAfter.filter((s) => s.role === backup);
  if (backups.length === 0) {
    return { ausgeschrieben: count, trigger: { type: "aufruf", places: more } };
  }
  return {
    ausgeschrieben: count,
    trigger: {
      type: "backups",
      places: count - counted,
      recipients: backups
        .map((s) => s.profileId)
        .filter((id) => id !== input.actorId),
    },
  };
}

/**
 * The Ausschreibung rule (spec 3): per role the counter of ausgeschriebene places after a
 * change and what it triggers. Pure, so a confirmation can ask before anything is written.
 */
export function planAusschreibung(
  input: AusschreibungInput,
): AusschreibungPlan {
  const rankedBefore = rankSignups(input.before.signups, input.before.staffing);
  return {
    terminId: input.terminId,
    roles: {
      instruktor: planRole("instruktor", input, rankedBefore),
      praxisanleiter: planRole("praxisanleiter", input, rankedBefore),
    },
  };
}

export type Triggered = {
  terminId: string;
  kind: Kind;
  trigger: Exclude<Trigger, { type: "none" }>;
};

/** The roles where a change triggers an Ausschreibung or an Aufruf, Termin by Termin. */
export function triggered(plans: AusschreibungPlan[]): Triggered[] {
  return plans.flatMap((plan) =>
    KINDS.flatMap((kind) => {
      const { trigger } = plan.roles[kind];
      return trigger.type === "none"
        ? []
        : [{ terminId: plan.terminId, kind, trigger }];
    }),
  );
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
