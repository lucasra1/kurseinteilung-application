import { describe, expect, it } from "vitest";
import {
  type AuditEntry,
  type StaffingTermin,
  staffingEvents,
  type TerminState,
} from "@/lib/audit";
import { bereicheOf, bereichTypes } from "@/lib/history-source";

const LEA = { id: "lea", fullName: "Lea Berger" };
const ANNA = { id: "anna", fullName: "Anna Huber" };

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
  instruktorenAusgeschrieben: 0,
  praxisanleiterAusgeschrieben: 0,
  festgeschrieben: false,
};

const annaOn = (termin: StaffingTermin): TerminState => ({
  termin,
  signups: [
    {
      profileId: ANNA.id,
      fullName: ANNA.fullName,
      kind: "instruktor",
      position: 1,
      role: "instruktor",
    },
  ],
});

/** The Bereiche the `/verlauf` filter shows one part of an action (one Termin's entries) under. */
function shownUnder(part: AuditEntry[]) {
  return [...new Set(part.flatMap(bereicheOf))].sort();
}

describe("bereicheOf", () => {
  it("puts a person removed from a Termin under Besetzung too, even if nobody moves up", () => {
    const part = staffingEvents({
      action: {
        type: "person.removed",
        actor: LEA,
        target: { profileId: ANNA.id },
      },
      before: [annaOn(T1)],
      after: [{ termin: T1, signups: [] }],
    });

    expect(part.map((e) => e.type)).toEqual(["person.removed"]);
    expect(shownUnder(part)).toEqual(["besetzung", "personen"]);
  });

  it("keeps a person removed who was on no Termin under Personen only", () => {
    const part = staffingEvents({
      action: {
        type: "person.removed",
        actor: LEA,
        target: { profileId: ANNA.id },
      },
      before: [],
      after: [],
      targetName: ANNA.fullName,
    });

    expect(shownUnder(part)).toEqual(["personen"]);
  });

  it("puts a deleted Termin under Besetzung while someone was signed up for it", () => {
    const deleteT1 = {
      type: "termin.deleted",
      actor: LEA,
      target: { terminId: "t1" },
    } as const;

    expect(
      shownUnder(
        staffingEvents({ action: deleteT1, before: [annaOn(T1)], after: [] }),
      ),
    ).toEqual(["besetzung", "termine-kurse"]);
    expect(
      shownUnder(
        staffingEvents({
          action: deleteT1,
          before: [{ termin: T1, signups: [] }],
          after: [],
        }),
      ),
    ).toEqual(["termine-kurse"]);
  });

  it("puts each Termin of a deleted Kurs under Besetzung only if someone was signed up for it", () => {
    const T2: StaffingTermin = { ...T1, id: "t2", topic: "Tag 2" };
    const entries = staffingEvents({
      action: { type: "kurs.deleted", actor: LEA, target: { kursId: "k1" } },
      before: [annaOn(T1), { termin: T2, signups: [] }],
      after: [],
    });

    const on = (id: string) => entries.filter((e) => e.terminId === id);
    expect(shownUnder(on("t1"))).toEqual(["besetzung", "termine-kurse"]);
    expect(shownUnder(on("t2"))).toEqual(["termine-kurse"]);
  });
});

describe("bereichTypes", () => {
  const BESETZUNG = [
    "place.aufruf",
    "place.ausgeschrieben",
    "signup.claimed",
    "signup.created",
    "signup.moved",
    "signup.place_given",
    "signup.removed",
    "signup.role_changed",
  ];
  const sorted = ({
    withoutTermin,
    onTermin,
  }: ReturnType<typeof bereichTypes>) => ({
    withoutTermin: withoutTermin.sort(),
    onTermin: onTermin.sort(),
  });

  it("puts Eintragungen, Ausschreibungen and Aufrufe under Besetzung, and on a Termin removing a person", () => {
    expect(sorted(bereichTypes("besetzung"))).toEqual({
      withoutTermin: BESETZUNG,
      onTermin: [...BESETZUNG, "person.removed"].sort(),
    });
  });

  it("puts what happened to Termine and Kurse under Termine & Kurse", () => {
    const types = [
      "kurs.created",
      "kurs.deleted",
      "kurs.updated",
      "termin.aufgehoben",
      "termin.created",
      "termin.deleted",
      "termin.festgeschrieben",
      "termin.updated",
    ];
    expect(sorted(bereichTypes("termine-kurse"))).toEqual({
      withoutTermin: types,
      onTermin: types,
    });
  });

  it("puts registering, profile changes, roles and removal under Personen", () => {
    const types = [
      "person.koordination_changed",
      "person.qualification_changed",
      "person.registered",
      "person.removed",
      "person.updated",
    ];
    expect(sorted(bereichTypes("personen"))).toEqual({
      withoutTermin: types,
      onTermin: types,
    });
  });
});
