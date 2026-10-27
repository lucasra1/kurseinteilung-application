import { describe, expect, it } from "vitest";
import type { AuditEvent, PersonChanges, TerminSnapshot } from "@/lib/audit";
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

describe("auditSentence for Kurse and Termine", () => {
  it("names the created Kurs; a created Termin is named by its context", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "kurs.created",
          data: { kursTitle: "Erste Hilfe Grundkurs" },
        }),
      ),
    ).toBe("Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ angelegt");
    expect(
      auditSentence(event(LEA, { type: "termin.created", data: { termin } })),
    ).toBe("Lea Berger hat den Termin angelegt");
  });

  it("lists the changed Kurs fields old → new", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "kurs.updated",
          data: {
            kursTitle: "Erste Hilfe Grundkurs",
            changes: {
              title: ["Erste Hilfe", "Erste Hilfe Grundkurs"],
              description: ["", "Für alle im Betrieb"],
            },
          },
        }),
      ),
    ).toBe(
      "Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ geändert (Titel „Erste Hilfe“ → „Erste Hilfe Grundkurs“, Beschreibung – → „Für alle im Betrieb“)",
    );
  });

  it("shortens a long description at a word", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "kurs.updated",
          data: {
            kursTitle: "Erste Hilfe Grundkurs",
            changes: {
              description: [
                "Für alle, die im Betrieb Erste Hilfe leisten wollen und dafür\neine Auffrischung brauchen.",
                "Kurz",
              ],
            },
          },
        }),
      ),
    ).toBe(
      "Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ geändert (Beschreibung „Für alle, die im Betrieb Erste Hilfe leisten…“ → „Kurz“)",
    );
  });
});

describe("auditSentence for Personen", () => {
  it("says how someone registered", () => {
    expect(
      auditSentence(
        event(ANNA, {
          type: "person.registered",
          profileId: ANNA.id,
          data: {
            personName: ANNA.name,
            via: "einladung",
            isInstruktor: true,
            isPraxisanleiter: true,
          },
        }),
      ),
    ).toBe(
      "Anna Huber hat sich mit dem Einladungslink registriert (Instruktor, Praxisanleiter)",
    );
    expect(
      auditSentence(
        event(
          { id: "lea", name: "lea.berger" },
          {
            type: "person.registered",
            profileId: "lea",
            data: {
              personName: "lea.berger",
              via: "admin-emails",
              isInstruktor: false,
              isPraxisanleiter: false,
            },
          },
        ),
      ),
    ).toBe(
      "lea.berger hat sich registriert (fix als Praxisanleiterkoordinator:in eingetragen)",
    );
  });

  it("shows the name old → new but only that the phone changed", () => {
    const updated = (changes: PersonChanges) =>
      auditSentence(
        event(ANNA, {
          type: "person.updated",
          profileId: ANNA.id,
          data: { personName: "Anna Maier", changes },
        }),
      );
    expect(
      updated({ fullName: ["Anna Huber", "Anna Maier"], phone: true }),
    ).toBe(
      "Anna Huber hat das Profil geändert (Name Anna Huber → Anna Maier, Telefon geändert)",
    );
    expect(updated({ phone: true })).toBe(
      "Anna Huber hat das Profil geändert (Telefon geändert)",
    );
  });

  it("says who gave or took a qualification", () => {
    const changed = (actor: typeof LEA, granted: boolean) =>
      auditSentence(
        event(actor, {
          type: "person.qualification_changed",
          profileId: ANNA.id,
          data: { personName: ANNA.name, kind: "praxisanleiter", granted },
        }),
      );
    expect(changed(LEA, true)).toBe(
      "Lea Berger hat Anna Huber die Qualifikation Praxisanleiter gegeben",
    );
    expect(changed(LEA, false)).toBe(
      "Lea Berger hat Anna Huber die Qualifikation Praxisanleiter entzogen",
    );
    expect(changed(ANNA, true)).toBe(
      "Anna Huber hat sich die Qualifikation Praxisanleiter gegeben",
    );
  });

  it("says who made someone Praxisanleiterkoordinator:in or not", () => {
    const changed = (granted: boolean) =>
      auditSentence(
        event(LEA, {
          type: "person.koordination_changed",
          profileId: ANNA.id,
          data: { personName: ANNA.name, granted },
        }),
      );
    expect(changed(true)).toBe(
      "Lea Berger hat Anna Huber die Rolle Praxisanleiterkoordinator:in gegeben",
    );
    expect(changed(false)).toBe(
      "Lea Berger hat Anna Huber die Rolle Praxisanleiterkoordinator:in entzogen",
    );
  });
});

describe("historyGroups outside a Termin", () => {
  const tag2: TerminSnapshot = {
    ...termin,
    topic: "Tag 2",
    date: "2026-11-08",
  };

  it("on the Kurs page, names each Termin and orders an action's Termine by date", () => {
    const kurs = event(LEA, {
      type: "kurs.created",
      data: { kursTitle: "Erste Hilfe Grundkurs" },
    });
    const created = (terminId: string, snapshot: TerminSnapshot) => ({
      ...event(LEA, { type: "termin.created", data: { termin: snapshot } }),
      terminId,
    });

    expect(
      historyGroups(
        [
          created("t2", tag2),
          { ...kurs, terminId: null },
          created("t1", termin),
        ],
        "kurs",
      ),
    ).toEqual([
      {
        actionId: "a1",
        time: "Sa., 31.10., 14:05",
        text: "Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ angelegt",
        consequences: [],
      },
      {
        actionId: "a1",
        about: { kind: "termin", id: "t1", label: "Tag 1, Sa., 07.11.2026" },
        time: "Sa., 31.10., 14:05",
        text: "Lea Berger hat den Termin angelegt",
        consequences: [],
      },
      {
        actionId: "a1",
        about: { kind: "termin", id: "t2", label: "Tag 2, So., 08.11.2026" },
        time: "Sa., 31.10., 14:05",
        text: "Lea Berger hat den Termin angelegt",
        consequences: [],
      },
    ]);
  });

  it("for a person, names Kurs and Termin and keeps consequences with their Termin", () => {
    const removed = (
      terminId: string,
      snapshot: TerminSnapshot,
      from: Role,
    ) => ({
      ...event(LEA, {
        type: "person.removed",
        profileId: ANNA.id,
        data: { termin: snapshot, personName: ANNA.name, from, to: null },
      }),
      terminId,
    });
    const movedUp = event(LEA, {
      type: "signup.role_changed",
      profileId: BEN.id,
      data: {
        termin,
        personName: BEN.name,
        from: "backup-instruktor",
        to: "instruktor",
      },
    });

    const groups = historyGroups(
      [
        removed("t2", tag2, "backup-instruktor"),
        movedUp,
        removed("t1", termin, "instruktor"),
      ],
      "person",
    );
    expect(
      groups.map(({ about, text, consequences }) => ({
        about,
        text,
        consequences,
      })),
    ).toEqual([
      {
        about: {
          kind: "termin",
          id: "t1",
          label: "Erste Hilfe Grundkurs – Tag 1, Sa., 07.11.2026",
        },
        text: "Lea Berger hat Anna Huber entfernt (Instruktor)",
        consequences: ["Ben Maier rückt als Instruktor nach"],
      },
      {
        about: {
          kind: "termin",
          id: "t2",
          label: "Erste Hilfe Grundkurs – Tag 2, So., 08.11.2026",
        },
        text: "Lea Berger hat Anna Huber entfernt (Backup Instruktor)",
        consequences: [],
      },
    ]);
  });
});

describe("auditSentence for Festschreiben", () => {
  it("says the Termin was festgeschrieben or the Festschreibung lifted", () => {
    expect(
      auditSentence(
        event(LEA, { type: "termin.festgeschrieben", data: { termin } }),
      ),
    ).toBe("Lea Berger hat den Termin festgeschrieben");
    expect(
      auditSentence(
        event(LEA, { type: "termin.aufgehoben", data: { termin } }),
      ),
    ).toBe("Lea Berger hat die Festschreibung aufgehoben");
  });
});

describe("auditSentence for Ausschreibung", () => {
  const ausgeschrieben = (places: number, angeschrieben: string[]) =>
    event(LEA, {
      type: "place.ausgeschrieben",
      data: { termin, kind: "instruktor", places, angeschrieben },
    });

  it("names the ausgeschriebenen places and who was written to", () => {
    expect(auditSentence(ausgeschrieben(1, ["Ben Maier", "Clara Ott"]))).toBe(
      "1 Instruktor-Platz ausgeschrieben, angeschrieben: Ben Maier, Clara Ott",
    );
    expect(auditSentence(ausgeschrieben(2, ["Ben Maier"]))).toBe(
      "2 Instruktor-Plätze ausgeschrieben, angeschrieben: Ben Maier",
    );
  });

  it("leaves out the names when the only backup is the actor", () => {
    expect(auditSentence(ausgeschrieben(1, []))).toBe(
      "1 Instruktor-Platz ausgeschrieben",
    );
  });

  const aufruf = (places: number, angeschrieben: number) =>
    event(LEA, {
      type: "place.aufruf",
      data: { termin, kind: "instruktor", places, angeschrieben },
    });

  it("says the place lacks a backup and how many qualified were written to", () => {
    expect(auditSentence(aufruf(1, 14))).toBe(
      "1 Instruktor-Platz fehlt, kein Backup: 14 Qualifizierte angeschrieben",
    );
    expect(auditSentence(aufruf(2, 1))).toBe(
      "2 Instruktor-Plätze fehlen, kein Backup: 1 qualifizierte Person angeschrieben",
    );
  });

  it("shows the Aufruf below the action, whatever order the entries come back in", () => {
    const removed = event(ANNA, {
      type: "signup.removed",
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, from: "instruktor", to: null },
    });

    expect(historyGroups([aufruf(1, 14), removed])).toEqual([
      {
        actionId: "a1",
        time: "Sa., 31.10., 14:05",
        text: "Anna Huber hat sich ausgetragen (Instruktor)",
        consequences: [
          "1 Instruktor-Platz fehlt, kein Backup: 14 Qualifizierte angeschrieben",
        ],
      },
    ]);
  });

  it("says so when there was nobody else to write to", () => {
    expect(auditSentence(aufruf(1, 0))).toBe(
      "1 Instruktor-Platz fehlt, kein Backup und sonst niemand qualifiziert",
    );
  });

  it("says who took the place", () => {
    expect(
      auditSentence(
        event(BEN, {
          type: "signup.claimed",
          profileId: BEN.id,
          data: {
            termin,
            personName: BEN.name,
            from: "backup-instruktor",
            to: "instruktor",
          },
        }),
      ),
    ).toBe("Ben Maier hat den Platz übernommen (Backup → Instruktor)");
  });

  it("says which admin gave whom the place", () => {
    expect(
      auditSentence(
        event(LEA, {
          type: "signup.place_given",
          profileId: BEN.id,
          data: {
            termin,
            personName: BEN.name,
            from: "backup-praxisanleiter",
            to: "praxisanleiter",
          },
        }),
      ),
    ).toBe(
      "Lea Berger hat Ben Maier den Platz gegeben (Backup → Praxisanleiter)",
    );
  });

  it("keeps the action's own entry on top, whatever order the entries come back in", () => {
    const removed = event(ANNA, {
      type: "signup.removed",
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, from: "instruktor", to: null },
    });
    const ausgeschrieben = event(ANNA, {
      type: "place.ausgeschrieben",
      data: {
        termin,
        kind: "instruktor",
        places: 1,
        angeschrieben: ["Ben Maier"],
      },
    });
    const becameBackup = event(ANNA, {
      type: "signup.role_changed",
      profileId: BEN.id,
      data: {
        termin,
        personName: BEN.name,
        from: "instruktor",
        to: "backup-instruktor",
      },
    });

    expect(historyGroups([ausgeschrieben, becameBackup, removed])).toEqual([
      {
        actionId: "a1",
        time: "Sa., 31.10., 14:05",
        text: "Anna Huber hat sich ausgetragen (Instruktor)",
        consequences: [
          "Ben Maier wird Backup (Instruktor)",
          "1 Instruktor-Platz ausgeschrieben, angeschrieben: Ben Maier",
        ],
      },
    ]);
  });
});

describe("historyGroups on the Verlauf page", () => {
  /** What each group is about, with only the given Termine, Kurse and people still there. */
  const about = (
    events: AuditEvent[],
    still: { termin?: string[]; kurs?: string[]; person?: string[] } = {},
  ) =>
    historyGroups(events, "all", {
      termin: new Set(still.termin),
      kurs: new Set(still.kurs),
      person: new Set(still.person),
    }).map((group) => group.about);

  it("names Kurs, Thema and date of the Termin and links to its panel", () => {
    const signedUp = event(ANNA, {
      type: "signup.created",
      profileId: ANNA.id,
      data: { termin, personName: ANNA.name, from: null, to: "instruktor" },
    });

    expect(about([signedUp], { termin: ["t1"] })).toEqual([
      {
        kind: "termin",
        id: "t1",
        label: "Erste Hilfe Grundkurs – Tag 1, Sa., 07.11.2026",
        href: "/termine?termin=t1",
      },
    ]);
  });

  it("names a deleted Termin as it was, without a link", () => {
    const deleted = event(LEA, { type: "termin.deleted", data: { termin } });

    expect(about([deleted])).toEqual([
      {
        kind: "termin",
        id: "t1",
        label: "Erste Hilfe Grundkurs – Tag 1, Sa., 07.11.2026",
      },
    ]);
  });

  it("names the Kurs of an entry without a Termin and links to the Kurs page", () => {
    const created = [
      {
        ...event(LEA, {
          type: "kurs.created",
          data: { kursTitle: "Erste Hilfe Grundkurs" },
        }),
        terminId: null,
      },
      event(LEA, { type: "termin.created", data: { termin } }),
    ];

    expect(about(created, { termin: ["t1"], kurs: ["k1"] })).toEqual([
      {
        kind: "kurs",
        id: "k1",
        label: "Erste Hilfe Grundkurs",
        href: "/kurse/k1",
      },
      {
        kind: "termin",
        id: "t1",
        label: "Erste Hilfe Grundkurs – Tag 1, Sa., 07.11.2026",
        href: "/termine?termin=t1",
      },
    ]);
  });

  it("names a deleted Kurs by its title back then, without a link", () => {
    const deleted = {
      ...event(LEA, {
        type: "kurs.deleted",
        data: { kursTitle: "Erste Hilfe Grundkurs" },
      }),
      terminId: null,
    };

    expect(about([deleted])).toEqual([
      { kind: "kurs", id: "k1", label: "Erste Hilfe Grundkurs" },
    ]);
  });

  it("names the person of an entry without Termin or Kurs and links to their sheet", () => {
    const qualified = {
      ...event(LEA, {
        type: "person.qualification_changed",
        profileId: ANNA.id,
        data: { personName: ANNA.name, kind: "instruktor", granted: true },
      }),
      terminId: null,
      kursId: null,
    };

    expect(about([qualified], { person: ["anna"] })).toEqual([
      {
        kind: "person",
        id: "anna",
        label: "Anna Huber",
        href: "/personen?person=anna",
      },
    ]);
  });

  it("names a removed person by their name back then, without a link", () => {
    const removed = {
      ...event(LEA, {
        type: "person.removed",
        profileId: ANNA.id,
        data: { personName: ANNA.name, from: null, to: null },
      }),
      terminId: null,
      kursId: null,
    };

    expect(about([removed])).toEqual([
      { kind: "person", id: "anna", label: "Anna Huber" },
    ]);
  });
});
