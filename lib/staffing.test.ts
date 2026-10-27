import { describe, expect, it } from "vitest";
import { festschreibungMessage, isFestgeschrieben } from "@/lib/staffing";

describe("isFestgeschrieben", () => {
  it("is festgeschrieben when set manually, however far away the Termin is", () => {
    expect(
      isFestgeschrieben(
        { date: "2027-12-01", festgeschrieben: true },
        "2026-10-27",
      ),
    ).toBe(true);
  });

  it("is festgeschrieben up to and including 3 calendar months from today, across the year", () => {
    const auto = (date: string) =>
      isFestgeschrieben({ date, festgeschrieben: false }, "2026-10-27");
    expect(auto("2027-01-27")).toBe(true);
    expect(auto("2027-01-28")).toBe(false);
  });

  it("takes the last day of the target month when it lacks today's day (30.11. → 28.02.)", () => {
    const auto = (date: string) =>
      isFestgeschrieben({ date, festgeschrieben: false }, "2026-11-30");
    expect(auto("2027-02-28")).toBe(true);
    expect(auto("2027-03-01")).toBe(false);
  });

  it("takes 29.02. in a leap year", () => {
    const auto = (date: string) =>
      isFestgeschrieben({ date, festgeschrieben: false }, "2027-11-30");
    expect(auto("2028-02-29")).toBe(true);
    expect(auto("2028-03-01")).toBe(false);
  });

  it("crosses the year from December (31.12. → 31.03.)", () => {
    const auto = (date: string) =>
      isFestgeschrieben({ date, festgeschrieben: false }, "2026-12-31");
    expect(auto("2027-03-31")).toBe(true);
    expect(auto("2027-04-01")).toBe(false);
  });

  it("counts today and past Termine as festgeschrieben", () => {
    const auto = (date: string) =>
      isFestgeschrieben({ date, festgeschrieben: false }, "2026-10-27");
    expect(auto("2026-10-27")).toBe(true);
    expect(auto("2026-09-01")).toBe(true);
  });
});

describe("festschreibungMessage", () => {
  it("counts the Termine that were festgeschrieben", () => {
    expect(festschreibungMessage(true, { changed: 1, automatisch: 0 })).toBe(
      "1 Termin festgeschrieben.",
    );
    expect(festschreibungMessage(true, { changed: 3, automatisch: 0 })).toBe(
      "3 Termine festgeschrieben.",
    );
  });

  it("points out Termine that stay automatically festgeschrieben after Aufheben", () => {
    expect(festschreibungMessage(false, { changed: 3, automatisch: 0 })).toBe(
      "Festschreibung bei 3 Terminen aufgehoben.",
    );
    expect(festschreibungMessage(false, { changed: 1, automatisch: 1 })).toBe(
      "Festschreibung bei 1 Termin aufgehoben. 1 Termin bleibt automatisch festgeschrieben (weniger als 3 Monate).",
    );
    expect(festschreibungMessage(false, { changed: 3, automatisch: 2 })).toBe(
      "Festschreibung bei 3 Terminen aufgehoben. 2 Termine bleiben automatisch festgeschrieben (weniger als 3 Monate).",
    );
  });

  it("says when nothing changed", () => {
    expect(festschreibungMessage(true, { changed: 0, automatisch: 0 })).toBe(
      "Die Auswahl war schon festgeschrieben.",
    );
    expect(festschreibungMessage(false, { changed: 0, automatisch: 0 })).toBe(
      "In der Auswahl war nichts manuell festgeschrieben.",
    );
    expect(festschreibungMessage(false, { changed: 0, automatisch: 2 })).toBe(
      "In der Auswahl war nichts manuell festgeschrieben. 2 Termine bleiben automatisch festgeschrieben (weniger als 3 Monate).",
    );
  });
});
