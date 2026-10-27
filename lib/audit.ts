/**
 * The Verlauf (audit log): event types and the shape of their `data`, in one place.
 *
 * Every entry of one action shares an `actionId`. A staffing change (through
 * `mutateStaffing`) writes one main entry per Termin it changed, carrying the role change
 * of the person it targets, plus one `signup.role_changed` per other person whose role
 * changed as a consequence (moved up, became backup, lost the place with a deleted
 * Termin). An action that locked no Termin at all (a Kurs without Termine, a person
 * without signups) writes one main entry without a Termin.
 *
 * `data` is a snapshot of what a reader needs later, since the Termin, Kurs or person may
 * be gone by then. It never contains e-mail addresses or phone numbers.
 */
import type { Kind, Qualifications, Role } from "@/lib/staffing";

/** Who did something. `CurrentUser` fits. */
export type Actor = { id: string; fullName: string };

/** What a reader needs to know about a Termin, as it was at the time of the action. */
export type TerminSnapshot = {
  kursTitle: string;
  topic: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM:SS */
  startTime: string;
  endTime: string;
};

/** A person's role on a Termin before and after the action; null means not signed up. */
export type RoleShift = {
  personName: string;
  from: Role | null;
  to: Role | null;
};

/** The Termin fields an admin edits; `termin.updated` lists the changed ones. */
export const TERMIN_FIELDS = [
  "date",
  "startTime",
  "endTime",
  "topic",
  "location",
  "instruktorenNeeded",
  "praxisanleiterNeeded",
] as const;

export type TerminField = (typeof TERMIN_FIELDS)[number];

/** `{ field: [old, new] }` for every changed field. */
export type TerminChanges = Partial<
  Record<TerminField, [string | number | null, string | number | null]>
>;

/** `data` per event type. */
export type AuditData = {
  "signup.created": { termin: TerminSnapshot } & RoleShift;
  "signup.removed": { termin: TerminSnapshot } & RoleShift;
  "signup.moved": {
    termin: TerminSnapshot;
    direction: "up" | "down";
  } & RoleShift;
  /** A consequence for someone the action didn't target. */
  "signup.role_changed": { termin: TerminSnapshot } & RoleShift;
  "termin.updated": { termin: TerminSnapshot; changes: TerminChanges };
  "termin.deleted": { termin: TerminSnapshot };
  /** One per selected Termin whose manual flag was set. */
  "termin.festgeschrieben": { termin: TerminSnapshot };
  /** One per selected Termin whose manual flag was cleared. */
  "termin.aufgehoben": { termin: TerminSnapshot };
  /** One per Termin of the Kurs; without `termin` if the Kurs had none. */
  "kurs.deleted": { kursTitle: string; termin?: TerminSnapshot };
  /** One per Termin the person was on; without `termin` (and roles null) if none. */
  "person.removed": { termin?: TerminSnapshot } & RoleShift;
  /** Shares its action with a `termin.created` per Termin created with the Kurs. */
  "kurs.created": { kursTitle: string };
  /** `kursTitle` is the title after the change. */
  "kurs.updated": { kursTitle: string; changes: KursChanges };
  "termin.created": { termin: TerminSnapshot };
  /** The person registering is the actor. */
  "person.registered": {
    personName: string;
    via: "einladung" | "admin-emails";
  } & Qualifications;
  /** By the person themselves; `personName` is the name after the change. */
  "person.updated": { personName: string; changes: PersonChanges };
  "person.qualification_changed": {
    personName: string;
    kind: Kind;
    granted: boolean;
  };
  /** Praxisanleiterkoordinator:in (`isAdmin`) given or taken. */
  "person.koordination_changed": { personName: string; granted: boolean };
};

/** The profile fields a person edits themselves. */
export type PersonFields = { fullName: string; phone: string | null };

/** The name old → new; for the phone only that it changed, never the number. */
export type PersonChanges = { fullName?: [string, string]; phone?: true };

/** The Kurs fields an admin edits. */
export type KursFields = { title: string; description: string };

/** `{ field: [old, new] }` for every changed Kurs field. */
export type KursChanges = Partial<Record<keyof KursFields, [string, string]>>;

export type AuditType = keyof AuditData;

/** An entry to write; `logEvents` adds id, time, action and actor. */
export type AuditEntry = {
  [T in AuditType]: {
    type: T;
    terminId?: string | null;
    kursId?: string | null;
    /** The person affected. */
    profileId?: string | null;
    data: AuditData[T];
  };
}[AuditType];

/** A stored entry. */
export type AuditEvent = {
  [T in AuditType]: {
    id: string;
    createdAt: Date;
    actionId: string;
    actorId: string | null;
    /** The actor's name at the time of the action. */
    actorName: string;
    type: T;
    terminId: string | null;
    kursId: string | null;
    profileId: string | null;
    data: AuditData[T];
  };
}[AuditType];

/**
 * What a staffing change is: every `mutateStaffing` caller passes one. `target` is whom or
 * what the action is aimed at; a target person's own role change goes into the main entry.
 */
export type StaffingAction = { actor: Actor } & (
  | {
      type: "signup.created" | "signup.removed";
      target: { terminId: string; profileId: string };
    }
  | {
      type: "signup.moved";
      target: { terminId: string; profileId: string };
      direction: "up" | "down";
    }
  | { type: "termin.updated" | "termin.deleted"; target: { terminId: string } }
  | {
      type: "termin.festgeschrieben" | "termin.aufgehoben";
      target: { terminIds: string[] };
    }
  | { type: "kurs.deleted"; target: { kursId: string } }
  | { type: "person.removed"; target: { profileId: string } }
);

/** A Termin as `mutateStaffing` locks it. */
export type StaffingTermin = TerminSnapshot & {
  id: string;
  kursId: string;
  location: string | null;
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
  /** The manual flag; see `isFestgeschrieben` for the rule. */
  festgeschrieben: boolean;
};

export type StaffingSignup = {
  profileId: string;
  fullName: string;
  kind: Kind;
  position: number;
  role: Role;
};

/** A Termin and its ranked signups at one point in time. */
export type TerminState = { termin: StaffingTermin; signups: StaffingSignup[] };

/**
 * The entries a staffing action writes (see the top of this file). `before` holds the
 * locked Termine, `after` the same ones afterwards (deleted ones missing).
 */
export function staffingEvents(input: {
  action: StaffingAction;
  before: TerminState[];
  after: TerminState[];
  /** The target person's name, needed when they're on none of the Termine. */
  targetName?: string;
  /** The target Kurs' title, needed when it has no Termine. */
  kursTitle?: string;
}): AuditEntry[] {
  const { action } = input;
  const targetId =
    "profileId" in action.target ? action.target.profileId : undefined;

  if (input.before.length === 0) {
    if (action.type === "person.removed") {
      return [
        {
          type: action.type,
          terminId: null,
          kursId: null,
          profileId: action.target.profileId,
          data: { personName: input.targetName ?? "", from: null, to: null },
        },
      ];
    }
    if (action.type === "kurs.deleted") {
      return [
        {
          type: action.type,
          terminId: null,
          kursId: action.target.kursId,
          profileId: null,
          data: { kursTitle: input.kursTitle ?? "" },
        },
      ];
    }
    return [];
  }

  return input.before.flatMap((was) => {
    const now = input.after.find((s) => s.termin.id === was.termin.id);
    if (now && unchanged(was, now)) return [];
    const termin = snapshot((now ?? was).termin);
    const refs = { terminId: was.termin.id, kursId: was.termin.kursId };
    const people = new Map(
      [...was.signups, ...(now?.signups ?? [])].map((s) => [
        s.profileId,
        s.fullName,
      ]),
    );
    const shift = (profileId: string): RoleShift => ({
      personName: people.get(profileId) ?? input.targetName ?? "",
      from: roleOn(was, profileId),
      to: roleOn(now, profileId),
    });

    const main = mainEntry(action, { ...refs, termin, was, now, shift });
    const consequences: AuditEntry[] = [...people.keys()]
      .filter((profileId) => profileId !== targetId)
      .map((profileId) => ({ profileId, ...shift(profileId) }))
      .filter(({ from, to }) => from !== to)
      .map(({ profileId, ...data }) => ({
        type: "signup.role_changed",
        ...refs,
        profileId,
        data: { termin, ...data },
      }));
    return [main, ...consequences];
  });
}

/** Same Termin fields and the same people in the same order and kinds. */
function unchanged(was: TerminState, now: TerminState): boolean {
  const fields = (t: StaffingTermin) => Object.entries(t).sort();
  const order = (s: TerminState) =>
    [...s.signups]
      .sort((a, b) => a.position - b.position)
      .map((x) => [x.profileId, x.kind, x.position]);
  return (
    JSON.stringify([fields(was.termin), order(was)]) ===
    JSON.stringify([fields(now.termin), order(now)])
  );
}

function snapshot(termin: StaffingTermin): TerminSnapshot {
  const { kursTitle, topic, date, startTime, endTime } = termin;
  return { kursTitle, topic, date, startTime, endTime };
}

function roleOn(state: TerminState | undefined, profileId: string) {
  return state?.signups.find((s) => s.profileId === profileId)?.role ?? null;
}

function terminChanges(was: StaffingTermin, now: StaffingTermin) {
  const changes: TerminChanges = {};
  for (const field of TERMIN_FIELDS) {
    if (was[field] !== now[field]) changes[field] = [was[field], now[field]];
  }
  return changes;
}

/** The action's own entry on one Termin. */
function mainEntry(
  action: StaffingAction,
  on: {
    terminId: string;
    kursId: string;
    termin: TerminSnapshot;
    was: TerminState;
    now: TerminState | undefined;
    shift: (profileId: string) => RoleShift;
  },
): AuditEntry {
  const { terminId, kursId, termin } = on;
  const refs = { terminId, kursId, profileId: null };
  switch (action.type) {
    case "signup.created":
    case "signup.removed":
    case "person.removed": {
      const { profileId } = action.target;
      const data = { termin, ...on.shift(profileId) };
      return { type: action.type, ...refs, profileId, data };
    }
    case "signup.moved": {
      const { profileId } = action.target;
      const data = {
        termin,
        ...on.shift(profileId),
        direction: action.direction,
      };
      return { type: action.type, ...refs, profileId, data };
    }
    case "termin.updated": {
      const changes = terminChanges(on.was.termin, (on.now ?? on.was).termin);
      return { type: action.type, ...refs, data: { termin, changes } };
    }
    case "termin.deleted":
      return { type: action.type, ...refs, data: { termin } };
    // Only Termine whose flag changed get here: the others are unchanged.
    case "termin.festgeschrieben":
    case "termin.aufgehoben":
      return { type: action.type, ...refs, data: { termin } };
    case "kurs.deleted":
      return {
        type: action.type,
        ...refs,
        data: { kursTitle: termin.kursTitle, termin },
      };
  }
}

/** A Termin row as just inserted. */
export type CreatedTermin = Omit<TerminSnapshot, "kursTitle"> & {
  id: string;
  kursId: string;
};

/** `termin.created` for a Termin of the Kurs titled `kursTitle`. */
export function terminCreatedEvent(
  kursTitle: string,
  termin: CreatedTermin,
): AuditEntry {
  const { id, kursId, topic, date, startTime, endTime } = termin;
  return {
    type: "termin.created",
    terminId: id,
    kursId,
    profileId: null,
    data: { termin: { kursTitle, topic, date, startTime, endTime } },
  };
}

/** `kurs.created` and a `termin.created` per Termin created with it. */
export function kursCreatedEvents(
  kurs: { id: string; title: string },
  termine: CreatedTermin[],
): AuditEntry[] {
  return [
    {
      type: "kurs.created",
      terminId: null,
      kursId: kurs.id,
      profileId: null,
      data: { kursTitle: kurs.title },
    },
    ...termine.map((termin) => terminCreatedEvent(kurs.title, termin)),
  ];
}

/** `kurs.updated` with old → new per changed field; nothing if no field changed. */
export function kursUpdatedEvents(
  kursId: string,
  was: KursFields,
  now: KursFields,
): AuditEntry[] {
  const changes: KursChanges = {};
  for (const field of ["title", "description"] as const) {
    if (was[field] !== now[field]) changes[field] = [was[field], now[field]];
  }
  if (Object.keys(changes).length === 0) return [];
  return [
    {
      type: "kurs.updated",
      terminId: null,
      kursId,
      profileId: null,
      data: { kursTitle: now.title, changes },
    },
  ];
}

/** `person.updated` for a changed name or phone; nothing if neither changed. */
export function personUpdatedEvents(
  profileId: string,
  was: PersonFields,
  now: PersonFields,
): AuditEntry[] {
  const changes: PersonChanges = {};
  if (was.fullName !== now.fullName) {
    changes.fullName = [was.fullName, now.fullName];
  }
  if (was.phone !== now.phone) changes.phone = true;
  if (Object.keys(changes).length === 0) return [];
  return [
    {
      type: "person.updated",
      terminId: null,
      kursId: null,
      profileId,
      data: { personName: now.fullName, changes },
    },
  ];
}
