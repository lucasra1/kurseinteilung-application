// Verlauf event types and their `data`: a snapshot for later readers, since the Termin, Kurs
// or person may be gone by then. Never e-mail addresses or phone numbers.
import {
  type Aufruf,
  type AusschreibungPlan,
  type Kind,
  type Qualifications,
  type Role,
  triggered,
} from "@/lib/staffing";

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

/** Someone a mail goes to, by ID and name: the address is looked up when sending. */
export type Recipient = { profileId: string; personName: string };

/** The names of the backups an Ausschreibung wrote to, from older entries too. */
export function ausgeschriebenTo(
  data: AuditData["place.ausgeschrieben"],
): string[] {
  return data.recipients?.map((r) => r.personName) ?? data.angeschrieben ?? [];
}

/** How many qualified an Aufruf wrote to, from older entries too. */
export function aufrufCount(data: AuditData["place.aufruf"]): number {
  return data.recipients?.length ?? data.angeschrieben ?? 0;
}

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
  /** A backup took an ausgeschriebenen place (Backup → role). */
  "signup.claimed": { termin: TerminSnapshot } & RoleShift;
  /** An admin gave a backup an ausgeschriebenen place (Backup → role). */
  "signup.place_given": { termin: TerminSnapshot } & RoleShift;
  /**
   * A consequence: `places` of `kind` ausgeschrieben; `recipients` are the backups who got
   * "Platz frei". Read with `ausgeschriebenTo`.
   */
  "place.ausgeschrieben": {
    termin: TerminSnapshot;
    kind: Kind;
    places: number;
    recipients?: Recipient[];
    /** Instead of `recipients` on older entries: only the backups' names. */
    angeschrieben?: string[];
  };
  /**
   * A consequence: `places` of `kind` missing without a backup; `recipients` are the
   * qualified who got "Du wirst gebraucht". Read with `aufrufCount`.
   */
  "place.aufruf": {
    termin: TerminSnapshot;
    kind: Kind;
    places: number;
    recipients?: Recipient[];
    /** Instead of `recipients` on older entries: only how many were written to. */
    angeschrieben?: number;
  };
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

/** The Termin an entry is about, as it was then; none for a Kurs or person alone. */
export function terminOf(entry: {
  data: AuditData[AuditType];
}): TerminSnapshot | undefined {
  return "termin" in entry.data ? entry.data.termin : undefined;
}

const CONSEQUENCES: ReadonlySet<AuditType> = new Set([
  "signup.role_changed",
  "place.ausgeschrieben",
  "place.aufruf",
]);

/** Entry types that only follow from an action's main entry, never stand for it. */
export function isConsequence(type: AuditType): boolean {
  return CONSEQUENCES.has(type);
}

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

/** A staffing change and its target; the target person's role change is in its main entry. */
export type StaffingAction = { actor: Actor } & (
  | {
      type:
        | "signup.created"
        | "signup.removed"
        | "signup.claimed"
        | "signup.place_given";
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

/** Who of `onTermin` the action put on a fixed place on purpose: never counted as moving up. */
export function explicitlyPlaced(
  action: StaffingAction,
  onTermin: string[],
): Set<string> {
  switch (action.type) {
    case "signup.claimed":
    case "signup.place_given":
      return new Set([action.target.profileId]);
    // A swap across the backup line is deliberate, whoever it lifts.
    case "signup.moved":
      return new Set(onTermin);
    default:
      return new Set();
  }
}

/** A Termin as `mutateStaffing` locks it. */
export type StaffingTermin = TerminSnapshot & {
  id: string;
  kursId: string;
  location: string | null;
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
  instruktorenAusgeschrieben: number;
  praxisanleiterAusgeschrieben: number;
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

/** Per changed Termin: the main entry, others' role changes, Ausschreibungen, Aufrufe. */
export function staffingEvents(input: {
  action: StaffingAction;
  before: TerminState[];
  after: TerminState[];
  /** What `planAusschreibung` decided per Termin. */
  plans?: AusschreibungPlan[];
  /** The Aufrufe of those plans, with the qualified written to (see `planAufrufe`). */
  aufrufe?: Aufruf<Recipient>[];
  /** The target person's name, needed when they're on none of the Termine. */
  targetName?: string;
  /** The target Kurs' title, needed when it has no Termine. */
  kursTitle?: string;
}): AuditEntry[] {
  const { action } = input;
  const triggers = triggered(input.plans ?? []);
  const targetId =
    "profileId" in action.target ? action.target.profileId : undefined;

  // Nothing locked (a Kurs without Termine, a person without signups): one entry, no Termin.
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
    const ausgeschrieben: AuditEntry[] = triggers.flatMap(
      ({ terminId, kind, trigger }) => {
        if (terminId !== was.termin.id || trigger.type !== "backups") return [];
        const recipients = trigger.recipients.map((profileId) => ({
          profileId,
          personName: people.get(profileId) ?? "",
        }));
        return [
          {
            type: "place.ausgeschrieben",
            ...refs,
            profileId: null,
            data: { termin, kind, places: trigger.places, recipients },
          },
        ];
      },
    );
    const aufrufe: AuditEntry[] = (input.aufrufe ?? [])
      .filter((aufruf) => aufruf.terminId === was.termin.id)
      .map(({ kind, places, recipients }) => ({
        type: "place.aufruf",
        ...refs,
        profileId: null,
        data: {
          termin,
          kind,
          places,
          // Only ID and name, whatever else the caller loaded.
          recipients: recipients.map(({ profileId, personName }) => ({
            profileId,
            personName,
          })),
        },
      }));
    return [main, ...consequences, ...ausgeschrieben, ...aufrufe];
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

/** `{ field: [old, new] }` for each of `fields` that differs between `was` and `now`. */
function changedFields<T, K extends keyof T>(
  was: T,
  now: T,
  fields: readonly K[],
): { [P in K]?: [T[P], T[P]] } {
  const changes: { [P in K]?: [T[P], T[P]] } = {};
  for (const field of fields) {
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
    case "signup.claimed":
    case "signup.place_given":
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
      const changes: TerminChanges = changedFields(
        on.was.termin,
        (on.now ?? on.was).termin,
        TERMIN_FIELDS,
      );
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
  const changes: KursChanges = changedFields(was, now, [
    "title",
    "description",
  ] as const);
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
  const { fullName, phone } = changedFields(was, now, [
    "fullName",
    "phone",
  ] as const);
  const changes: PersonChanges = {
    ...(fullName && { fullName }),
    ...(phone && { phone: true }),
  };
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
