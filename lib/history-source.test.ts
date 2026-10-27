import { describe, expect, it } from "vitest";
import { bereichTypes } from "@/lib/history-source";

describe("bereichTypes", () => {
  it("puts Eintragungen, Ausschreibungen and Aufrufe under Besetzung", () => {
    expect(bereichTypes("besetzung").sort()).toEqual([
      "place.aufruf",
      "place.ausgeschrieben",
      "signup.claimed",
      "signup.created",
      "signup.moved",
      "signup.place_given",
      "signup.removed",
      "signup.role_changed",
    ]);
  });

  it("puts what happened to Termine and Kurse under Termine & Kurse", () => {
    expect(bereichTypes("termine-kurse").sort()).toEqual([
      "kurs.created",
      "kurs.deleted",
      "kurs.updated",
      "termin.aufgehoben",
      "termin.created",
      "termin.deleted",
      "termin.festgeschrieben",
      "termin.updated",
    ]);
  });

  it("puts registering, profile changes, roles and removal under Personen", () => {
    expect(bereichTypes("personen").sort()).toEqual([
      "person.koordination_changed",
      "person.qualification_changed",
      "person.registered",
      "person.removed",
      "person.updated",
    ]);
  });
});
