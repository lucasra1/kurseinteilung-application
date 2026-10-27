import { describe, expect, it } from "vitest";
import { festschreibungMessage } from "@/lib/wording";

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
