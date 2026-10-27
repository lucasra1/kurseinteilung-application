import { describe, expect, it } from "vitest";
import {
  type StaffingTermin,
  staffingEvents,
  type TerminSnapshot,
  type TerminState,
} from "@/lib/audit";
import type { Kind, Role } from "@/lib/staffing";

const LEA = { id: "lea", fullName: "Lea Berger" };
const ANNA = { id: "anna", fullName: "Anna Huber" };
const BEN = { id: "ben", fullName: "Ben Maier" };

const T1: StaffingTermin = {
  id: "t1",
  kursId: "k1",
  kursTitle: "Erste Hilfe Grundkurs",
  topic: "Tag 1",
  date: "2026-11-07",
  startTime: "09:00:00",
  endTime: "17:00:00",
  location: "Halle 2",
  instruktorenNeeded: 1,
  praxisanleiterNeeded: 1,
};

const T1_SNAPSHOT: TerminSnapshot = {
  kursTitle: "Erste Hilfe Grundkurs",
  topic: "Tag 1",
  date: "2026-11-07",
  startTime: "09:00:00",
  endTime: "17:00:00",
};

/** A signup as the DAL loads it: with contact details that must not end up in the Verlauf. */
function signup(
  person: { id: string; fullName: string },
  kind: Kind,
  position: number,
  role: Role,
) {
  return {
    profileId: person.id,
    fullName: person.fullName,
    email: `${person.id}@example.org`,
    phone: "0664 1234567",
    kind,
    position,
    role,
  };
}

function state(
  termin: StaffingTermin,
  signups: ReturnType<typeof signup>[],
): TerminState {
  return { termin, signups };
}

describe("staffingEvents", () => {
  it("writes the withdrawal with the target's role and the backup moving up, without contacts", () => {
    const events = staffingEvents({
      action: {
        type: "signup.removed",
        actor: ANNA,
        target: { terminId: "t1", profileId: ANNA.id },
      },
      before: [
        state(T1, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "backup-instruktor"),
        ]),
      ],
      after: [state(T1, [signup(BEN, "instruktor", 1, "instruktor")])],
    });

    expect(events).toEqual([
      {
        type: "signup.removed",
        terminId: "t1",
        kursId: "k1",
        profileId: ANNA.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Anna Huber",
          from: "instruktor",
          to: null,
        },
      },
      {
        type: "signup.role_changed",
        terminId: "t1",
        kursId: "k1",
        profileId: BEN.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Ben Maier",
          from: "backup-instruktor",
          to: "instruktor",
        },
      },
    ]);
  });

  it("writes ↑ across the backup line with both role changes", () => {
    const events = staffingEvents({
      action: {
        type: "signup.moved",
        actor: LEA,
        target: { terminId: "t1", profileId: BEN.id },
        direction: "up",
      },
      before: [
        state(T1, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "backup-instruktor"),
        ]),
      ],
      after: [
        state(T1, [
          signup(BEN, "instruktor", 1, "instruktor"),
          signup(ANNA, "instruktor", 2, "backup-instruktor"),
        ]),
      ],
    });

    expect(events).toEqual([
      {
        type: "signup.moved",
        terminId: "t1",
        kursId: "k1",
        profileId: BEN.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Ben Maier",
          direction: "up",
          from: "backup-instruktor",
          to: "instruktor",
        },
      },
      {
        type: "signup.role_changed",
        terminId: "t1",
        kursId: "k1",
        profileId: ANNA.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Anna Huber",
          from: "instruktor",
          to: "backup-instruktor",
        },
      },
    ]);
  });

  it("writes nothing when the action changed nothing (↑ at the top)", () => {
    const unchanged = state(T1, [signup(ANNA, "instruktor", 1, "instruktor")]);
    expect(
      staffingEvents({
        action: {
          type: "signup.moved",
          actor: LEA,
          target: { terminId: "t1", profileId: ANNA.id },
          direction: "up",
        },
        before: [unchanged],
        after: [structuredClone(unchanged)],
      }),
    ).toEqual([]);
  });

  it("writes a deleted Termin and everyone losing their place there", () => {
    const events = staffingEvents({
      action: {
        type: "termin.deleted",
        actor: LEA,
        target: { terminId: "t1" },
      },
      before: [
        state(T1, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "praxisanleiter", 2, "praxisanleiter"),
        ]),
      ],
      after: [],
    });

    expect(events).toEqual([
      {
        type: "termin.deleted",
        terminId: "t1",
        kursId: "k1",
        profileId: null,
        data: { termin: T1_SNAPSHOT },
      },
      {
        type: "signup.role_changed",
        terminId: "t1",
        kursId: "k1",
        profileId: ANNA.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Anna Huber",
          from: "instruktor",
          to: null,
        },
      },
      {
        type: "signup.role_changed",
        terminId: "t1",
        kursId: "k1",
        profileId: BEN.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Ben Maier",
          from: "praxisanleiter",
          to: null,
        },
      },
    ]);
  });

  it("writes a removed person once per Termin they were on, with the consequences there", () => {
    const T2: StaffingTermin = {
      ...T1,
      id: "t2",
      topic: "Tag 2",
      date: "2026-11-08",
    };
    const events = staffingEvents({
      action: {
        type: "person.removed",
        actor: LEA,
        target: { profileId: ANNA.id },
      },
      before: [
        state(T1, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "backup-instruktor"),
        ]),
        state(T2, [signup(ANNA, "praxisanleiter", 1, "praxisanleiter")]),
      ],
      after: [
        state(T1, [signup(BEN, "instruktor", 1, "instruktor")]),
        state(T2, []),
      ],
    });

    expect(events.map((e) => [e.type, e.terminId, e.profileId])).toEqual([
      ["person.removed", "t1", ANNA.id],
      ["signup.role_changed", "t1", BEN.id],
      ["person.removed", "t2", ANNA.id],
    ]);
    expect(events[2].data).toEqual({
      termin: { ...T1_SNAPSHOT, topic: "Tag 2", date: "2026-11-08" },
      personName: "Anna Huber",
      from: "praxisanleiter",
      to: null,
    });
  });

  it("writes one entry without Termin for a person who was on none", () => {
    expect(
      staffingEvents({
        action: {
          type: "person.removed",
          actor: LEA,
          target: { profileId: ANNA.id },
        },
        before: [],
        after: [],
        targetName: "Anna Huber",
      }),
    ).toEqual([
      {
        type: "person.removed",
        terminId: null,
        kursId: null,
        profileId: ANNA.id,
        data: { personName: "Anna Huber", from: null, to: null },
      },
    ]);
  });

  it("writes a deleted Kurs per Termin, or once if it had none", () => {
    const action = {
      type: "kurs.deleted",
      actor: LEA,
      target: { kursId: "k1" },
    } as const;
    expect(
      staffingEvents({ action, before: [state(T1, [])], after: [] }),
    ).toEqual([
      {
        type: "kurs.deleted",
        terminId: "t1",
        kursId: "k1",
        profileId: null,
        data: { kursTitle: "Erste Hilfe Grundkurs", termin: T1_SNAPSHOT },
      },
    ]);
    expect(
      staffingEvents({
        action,
        before: [],
        after: [],
        kursTitle: "Erste Hilfe Grundkurs",
      }),
    ).toEqual([
      {
        type: "kurs.deleted",
        terminId: null,
        kursId: "k1",
        profileId: null,
        data: { kursTitle: "Erste Hilfe Grundkurs" },
      },
    ]);
  });

  it("writes the changed Termin fields and who became backup", () => {
    const events = staffingEvents({
      action: {
        type: "termin.updated",
        actor: LEA,
        target: { terminId: "t1" },
      },
      before: [
        state({ ...T1, instruktorenNeeded: 2 }, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "instruktor"),
        ]),
      ],
      after: [
        state({ ...T1, instruktorenNeeded: 1, location: null }, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "backup-instruktor"),
        ]),
      ],
    });

    expect(events).toEqual([
      {
        type: "termin.updated",
        terminId: "t1",
        kursId: "k1",
        profileId: null,
        data: {
          termin: T1_SNAPSHOT,
          changes: { location: ["Halle 2", null], instruktorenNeeded: [2, 1] },
        },
      },
      {
        type: "signup.role_changed",
        terminId: "t1",
        kursId: "k1",
        profileId: BEN.id,
        data: {
          termin: T1_SNAPSHOT,
          personName: "Ben Maier",
          from: "instruktor",
          to: "backup-instruktor",
        },
      },
    ]);
  });
});
