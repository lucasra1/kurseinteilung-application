import { describe, expect, it } from "vitest";
import type { AuditEvent, TerminSnapshot } from "@/lib/audit";
import {
  auditSentence,
  formatAuditTime,
  historyGroups,
} from "@/lib/audit-text";
import type { Role } from "@/lib/staffing";

const LEA = { id: "lea", name: "Lea Berger" };
const ANNA = { id: "anna", name: "Anna Huber" };
const BEN = { id: "ben", name: "Ben Maier" };

const termin: TerminSnapshot = {
  kursTitle: "Erste Hilfe Grundkurs",
  topic: "Tag 1",
  date: "2026-11-07",
  startTime: "09:00:00",
  endTime: "17:00:00",
};

/** A stored entry by `actor`; only type, people and data matter for the sentence. */
function event(
  actor: { id: string; name: string },
  entry: Pick<AuditEvent, "type" | "data"> &
    Partial<Pick<AuditEvent, "profileId" | "actionId" | "createdAt">>,
): AuditEvent {
  return {
    id: "e1",
    createdAt: new Date("2026-10-31T13:05:00Z"),
    actionId: "a1",
    actorId: actor.id,
    actorName: actor.name,
    terminId: "t1",
    kursId: "k1",
    profileId: null,
    ...entry,
  } as AuditEvent;
}

describe("auditSentence", () => {
  it("names actor and person when someone else was removed", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "signup.removed",
          profileId: ANNA.id,
          data: { termin, personName: ANNA.name, from: "instruktor", to: null },
        }),
      ),
    ).toBe("Lea Berger hat Anna Huber ausgetragen (Instruktor)");
  });

  it("says 'sich' when the actor withdrew themselves", () => {
    expect(
      auditSentence(
        event(ANNA, {
          type: "signup.removed",
          profileId: ANNA.id,
          data: {
            termin,
            personName: ANNA.name,
            from: "backup-praxisanleiter",
            to: null,
          },
        }),
      ),
    ).toBe("Anna Huber hat sich ausgetragen (Backup Praxisanleiter)");
  });

  it("describes signing up oneself and being signed up by someone", () => {
    const created = (actor: typeof LEA) =>
      event(actor, {
        type: "signup.created",
        profileId: ANNA.id,
        data: { termin, personName: ANNA.name, from: null, to: "instruktor" },
      });
    expect(auditSentence(created(ANNA))).toBe(
      "Anna Huber hat sich eingetragen (Instruktor)",
    );
    expect(auditSentence(created(LEA))).toBe(
      "Lea Berger hat Anna Huber eingetragen (Instruktor)",
    );
  });

  const roleChanged = (from: Role | null, to: Role | null) =>
    event(LEA, {
      type: "signup.role_changed",
      profileId: BEN.id,
      data: { termin, personName: BEN.name, from, to },
    });

  it("says a backup moves up into a fixed place", () => {
    expect(auditSentence(roleChanged("backup-instruktor", "instruktor"))).toBe(
      "Ben Maier rückt als Instruktor nach",
    );
  });

  it("says someone in a fixed place becomes backup", () => {
    expect(
      auditSentence(roleChanged("praxisanleiter", "backup-praxisanleiter")),
    ).toBe("Ben Maier wird Backup (Praxisanleiter)");
  });

  it("says someone lost their place, e.g. with a deleted Termin", () => {
    expect(auditSentence(roleChanged("backup-instruktor", null))).toBe(
      "Ben Maier ist nicht mehr eingetragen (Backup Instruktor)",
    );
  });

  it("says someone is now signed up", () => {
    expect(auditSentence(roleChanged(null, "praxisanleiter"))).toBe(
      "Ben Maier ist jetzt eingetragen (Praxisanleiter)",
    );
  });

  const moved = (direction: "up" | "down", from: Role, to: Role) =>
    event(LEA, {
      type: "signup.moved",
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, direction, from, to },
    });

  it("describes ↑/↓ within the fixed places", () => {
    expect(auditSentence(moved("down", "instruktor", "instruktor"))).toBe(
      "Lea Berger hat Anna Huber nach unten verschoben (Instruktor)",
    );
  });

  it("describes ↑/↓ across the backup line with the role change", () => {
    expect(auditSentence(moved("up", "backup-instruktor", "instruktor"))).toBe(
      "Lea Berger hat Anna Huber nach oben verschoben (Backup → Instruktor)",
    );
  });

  it("names the deleted Termin", () => {
    expect(
      auditSentence(event(LEA, { type: "termin.deleted", data: { termin } })),
    ).toBe(
      "Lea Berger hat den Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 gelöscht",
    );
  });

  it("names the deleted Kurs", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "kurs.deleted",
          data: { kursTitle: "Erste Hilfe Grundkurs", termin },
        }),
      ),
    ).toBe("Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ gelöscht");
  });

  it("describes removing a person, with their role on the Termin if any", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "person.removed",
          profileId: ANNA.id,
          data: { termin, personName: ANNA.name, from: "instruktor", to: null },
        }),
      ),
    ).toBe("Lea Berger hat Anna Huber entfernt (Instruktor)");
    expect(
      auditSentence(
        event(LEA, {
          type: "person.removed",
          profileId: ANNA.id,
          data: { personName: ANNA.name, from: null, to: null },
        }),
      ),
    ).toBe("Lea Berger hat Anna Huber entfernt");
  });

  it("lists the changed staffing numbers of a Termin", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "termin.updated",
          data: {
            termin,
            changes: {
              instruktorenNeeded: [2, 3],
              praxisanleiterNeeded: [1, 0],
            },
          },
        }),
      ),
    ).toBe(
      "Lea Berger hat den Termin geändert (Instruktoren 2 → 3, Praxisanleiter 1 → 0)",
    );
  });

  it("shows changed dates, times and an empty location readably", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "termin.updated",
          data: {
            termin,
            changes: {
              date: ["2026-11-07", "2026-11-08"],
              startTime: ["09:00:00", "10:00:00"],
              location: [null, "Halle 2"],
            },
          },
        }),
      ),
    ).toBe(
      "Lea Berger hat den Termin geändert (Datum Sa., 07.11.2026 → So., 08.11.2026, Beginn 09:00 → 10:00, Ort – → Halle 2)",
    );
  });
});

describe("historyGroups", () => {
  it("puts an action's consequences under its main entry, newest action first", () => {
    const signedUp = event(ANNA, {
      type: "signup.created",
      actionId: "a1",
      createdAt: new Date("2026-10-30T08:00:00Z"),
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, from: null, to: "instruktor" },
    });
    const removed = event(LEA, {
      type: "signup.removed",
      actionId: "a2",
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, from: "instruktor", to: null },
    });
    const movedUp = event(LEA, {
      type: "signup.role_changed",
      actionId: "a2",
      profileId: BEN.id,
      data: {
        termin,
        personName: BEN.name,
        from: "backup-instruktor",
        to: "instruktor",
      },
    });

    expect(historyGroups([movedUp, removed, signedUp])).toEqual([
      {
        actionId: "a2",
        time: "Sa., 31.10., 14:05",
        text: "Lea Berger hat Anna Huber ausgetragen (Instruktor)",
        consequences: ["Ben Maier rückt als Instruktor nach"],
      },
      {
        actionId: "a1",
        time: "Fr., 30.10., 09:00",
        text: "Anna Huber hat sich eingetragen (Instruktor)",
        consequences: [],
      },
    ]);
  });
});

describe("formatAuditTime", () => {
  it("uses Vienna summer time", () => {
    expect(formatAuditTime(new Date("2026-07-04T12:30:00Z"))).toBe(
      "Sa., 04.07., 14:30",
    );
  });
});
