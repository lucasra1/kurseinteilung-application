import { describe, expect, it } from "vitest";
import {
  aufrufe,
  festschreibungMessage,
  isFestgeschrieben,
  type Kind,
  missingPlaces,
  nextRole,
  planAusschreibung,
  type RolePlan,
  rankSignups,
  type Staffing,
  triggered,
} from "@/lib/staffing";

/** Signups in this order; `kind` defaults to instruktor. */
function inOrder(...people: Array<string | [string, Kind]>) {
  return people.map((person, i) => {
    const [profileId, kind] =
      typeof person === "string" ? [person, "instruktor" as Kind] : person;
    return {
      profileId,
      kind,
      position: i + 1,
      createdAt: new Date(0),
    };
  });
}

function staffing(
  instruktoren: number,
  ausgeschrieben = 0,
  praxisanleiter = 0,
): Staffing {
  return {
    instruktorenNeeded: instruktoren,
    praxisanleiterNeeded: praxisanleiter,
    instruktorenAusgeschrieben: ausgeschrieben,
    praxisanleiterAusgeschrieben: 0,
  };
}

type Side = { staffing: Staffing; signups: ReturnType<typeof inOrder> };

/** The instruktor part of the plan for a change on Termin t1, festgeschrieben and upcoming unless said otherwise. */
function instruktorPlan(
  before: Side,
  after: Side,
  options: {
    festgeschrieben?: boolean;
    isPast?: boolean;
    explicit?: string[];
    actorId?: string;
  } = {},
) {
  return planAusschreibung({
    terminId: "t1",
    before,
    after,
    festgeschrieben: options.festgeschrieben ?? true,
    isPast: options.isPast ?? false,
    explicit: new Set(options.explicit ?? []),
    actorId: options.actorId ?? "lea",
  }).roles.instruktor;
}

const roles = (ranked: { profileId: string; role: string }[]) =>
  Object.fromEntries(ranked.map((s) => [s.profileId, s.role]));

describe("rankSignups", () => {
  it("gives the first N of a kind the fixed places and makes the rest backups", () => {
    expect(
      roles(rankSignups(inOrder("anna", "ben", "clara"), staffing(2))),
    ).toEqual({
      anna: "instruktor",
      ben: "instruktor",
      clara: "backup-instruktor",
    });
  });

  it("holds ausgeschriebene places back: only the first N − A are fixed", () => {
    expect(
      roles(rankSignups(inOrder("anna", "ben", "clara"), staffing(2, 1))),
    ).toEqual({
      anna: "instruktor",
      ben: "backup-instruktor",
      clara: "backup-instruktor",
    });
  });

  it("counts ausgeschriebene places as missing", () => {
    const s = staffing(2, 1);
    expect(missingPlaces(rankSignups(inOrder("anna", "ben"), s), s)).toEqual({
      instruktor: 1,
      praxisanleiter: 0,
    });
  });

  it("gives the next person signing up a fixed place while one is ausgeschrieben", () => {
    const next = (s: Staffing) =>
      nextRole(rankSignups(inOrder("anna", "ben"), s), s, "instruktor");
    expect(next(staffing(2, 1))).toBe("instruktor");
    expect(next(staffing(2))).toBe("backup-instruktor");
  });
});

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

describe("planAusschreibung", () => {
  it("holds a place freed by a withdrawal for the backups and writes to all of them but the actor", () => {
    expect(
      instruktorPlan(
        {
          staffing: staffing(2),
          signups: inOrder("anna", "ben", "clara", "dora"),
        },
        { staffing: staffing(2), signups: inOrder("ben", "clara", "dora") },
        { actorId: "anna" },
      ),
    ).toEqual({
      ausgeschrieben: 1,
      trigger: { type: "backups", places: 1, recipients: ["clara", "dora"] },
    });
  });

  it("lowers the counter first when the number drops, so nobody becomes backup (N 3 → 2, A 1)", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(3, 1), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(2, 1), signups: inOrder("anna", "ben", "clara") },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("lets backups move up as before on a Termin that isn't festgeschrieben", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(2), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(2), signups: inOrder("ben", "clara") },
        { festgeschrieben: false, actorId: "anna" },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("releases every held place once the Termin is no longer festgeschrieben (Aufheben)", () => {
    const signups = inOrder("anna", "clara", "dora");
    expect(
      instruktorPlan(
        { staffing: staffing(2, 1), signups },
        { staffing: staffing(2, 1), signups },
        { festgeschrieben: false },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("keeps the counter on a past Termin and lets the backup move up, without Ausschreibung", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(3, 1), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(3, 1), signups: inOrder("ben", "clara") },
        { isPast: true },
      ),
    ).toEqual({ ausgeschrieben: 1, trigger: { type: "none" } });
  });

  it("holds a place added by a higher number for the backups (N 2 → 3)", () => {
    const signups = inOrder("anna", "ben", "clara");
    expect(
      instruktorPlan(
        { staffing: staffing(2), signups },
        { staffing: staffing(3), signups },
      ),
    ).toEqual({
      ausgeschrieben: 1,
      trigger: { type: "backups", places: 1, recipients: ["clara"] },
    });
  });

  it("calls the qualified when a higher number finds no backup", () => {
    const signups = inOrder("anna", "ben");
    expect(
      instruktorPlan(
        { staffing: staffing(2), signups },
        { staffing: staffing(3), signups },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "aufruf", places: 1 } });
  });

  it("calls the qualified when a fixed person leaves and there is no backup", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(2), signups: inOrder("anna", "ben") },
        { staffing: staffing(2), signups: inOrder("ben") },
        { actorId: "anna" },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "aufruf", places: 1 } });
  });

  it("keeps the counter when it calls the qualified (N 3, A 1, a fixed one leaves)", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(3, 1), signups: inOrder("anna", "ben") },
        { staffing: staffing(3, 1), signups: inOrder("ben") },
        { actorId: "anna" },
      ),
    ).toEqual({ ausgeschrieben: 1, trigger: { type: "aufruf", places: 1 } });
  });

  it("only touches the role whose places changed", () => {
    const plan = planAusschreibung({
      terminId: "t1",
      before: {
        staffing: staffing(1, 0, 1),
        signups: inOrder("anna", ["paul", "praxisanleiter"], "ben"),
      },
      after: {
        staffing: staffing(1, 0, 1),
        signups: inOrder(["paul", "praxisanleiter"], "ben"),
      },
      festgeschrieben: true,
      isPast: false,
      explicit: new Set(),
      actorId: "anna",
    });
    expect(plan).toEqual({
      terminId: "t1",
      roles: {
        instruktor: {
          ausgeschrieben: 1,
          trigger: { type: "backups", places: 1, recipients: ["ben"] },
        },
        praxisanleiter: { ausgeschrieben: 0, trigger: { type: "none" } },
      },
    });
  });
});

describe("triggered", () => {
  it("lists the roles that trigger something, per Termin", () => {
    const none: RolePlan = { ausgeschrieben: 0, trigger: { type: "none" } };
    const backups: RolePlan = {
      ausgeschrieben: 1,
      trigger: { type: "backups", places: 1, recipients: ["ben"] },
    };
    const aufruf: RolePlan = {
      ausgeschrieben: 0,
      trigger: { type: "aufruf", places: 1 },
    };
    expect(
      triggered([
        {
          terminId: "t1",
          roles: { instruktor: backups, praxisanleiter: none },
        },
        { terminId: "t2", roles: { instruktor: none, praxisanleiter: none } },
        { terminId: "t3", roles: { instruktor: none, praxisanleiter: aufruf } },
      ]),
    ).toEqual([
      { terminId: "t1", kind: "instruktor", trigger: backups.trigger },
      { terminId: "t3", kind: "praxisanleiter", trigger: aufruf.trigger },
    ]);
  });
});

describe("planAusschreibung never triggers on", () => {
  it("a backup withdrawing", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(1), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(1), signups: inOrder("anna", "clara") },
        { actorId: "ben" },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("the last backup withdrawing while a place is ausgeschrieben: the place stays open", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(2, 1), signups: inOrder("anna", "ben") },
        { staffing: staffing(2, 1), signups: inOrder("anna") },
        { actorId: "ben" },
      ),
    ).toEqual({ ausgeschrieben: 1, trigger: { type: "none" } });
  });

  it("Platz übernehmen: the claimer was put there on purpose and doesn't count as moving up", () => {
    // claimPlace moved Ben to the first backup slot and lowered the counter.
    expect(
      instruktorPlan(
        {
          staffing: staffing(2, 1),
          signups: inOrder("anna", "clara", "ben"),
        },
        {
          staffing: staffing(2, 0),
          signups: inOrder("anna", "ben", "clara"),
        },
        { explicit: ["ben"], actorId: "ben" },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("signing up for a role with a held place: the newcomer takes it", () => {
    // appendSignup put Dora at the first backup slot and lowered the counter.
    expect(
      instruktorPlan(
        { staffing: staffing(2, 1), signups: inOrder("anna", "clara") },
        { staffing: staffing(2, 0), signups: inOrder("anna", "dora", "clara") },
        { actorId: "dora" },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("↑/↓ across the backup line: the swap is deliberate and the counter stays", () => {
    expect(
      instruktorPlan(
        { staffing: staffing(2, 1), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(2, 1), signups: inOrder("ben", "anna", "clara") },
        { explicit: ["anna", "ben", "clara"] },
      ),
    ).toEqual({ ausgeschrieben: 1, trigger: { type: "none" } });
    expect(
      instruktorPlan(
        { staffing: staffing(1), signups: inOrder("anna", "ben") },
        { staffing: staffing(1), signups: inOrder("ben", "anna") },
        { explicit: ["anna", "ben"] },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });

  it("a lower number without held places: the last fixed person becomes backup", () => {
    const signups = inOrder("anna", "ben");
    expect(
      instruktorPlan(
        { staffing: staffing(2), signups },
        { staffing: staffing(1), signups },
      ),
    ).toEqual({ ausgeschrieben: 0, trigger: { type: "none" } });
  });
});

describe("aufrufe", () => {
  /** Everyone with an account: id and qualifications. */
  const PEOPLE = [
    { id: "lea", isInstruktor: false, isPraxisanleiter: false },
    { id: "anna", isInstruktor: true, isPraxisanleiter: false },
    { id: "ben", isInstruktor: true, isPraxisanleiter: false },
    { id: "clara", isInstruktor: true, isPraxisanleiter: false },
    { id: "dora", isInstruktor: true, isPraxisanleiter: true },
    { id: "emil", isInstruktor: false, isPraxisanleiter: true },
    { id: "paul", isInstruktor: true, isPraxisanleiter: true },
  ];

  /** Who gets "Du wirst gebraucht" for a change on festgeschrieben, upcoming Termin t1. */
  function called(before: Side, after: Side, actorId: string) {
    const plan = planAusschreibung({
      terminId: "t1",
      before,
      after,
      festgeschrieben: true,
      isPast: false,
      explicit: new Set(),
      actorId,
    });
    const onT1 = (side: Side) =>
      side.signups.map((s) => ({ terminId: "t1", profileId: s.profileId }));
    return aufrufe({
      plans: [plan],
      people: PEOPLE,
      before: onT1(before),
      after: onT1(after),
      actorId,
    }).map(({ recipients, ...aufruf }) => ({
      ...aufruf,
      recipients: recipients.map((p) => p.id),
    }));
  }

  it("calls everyone qualified for the role who is on the Termin in no role, without the actor", () => {
    expect(
      called(
        {
          staffing: staffing(2, 0, 1),
          signups: inOrder("anna", "ben", ["paul", "praxisanleiter"]),
        },
        {
          staffing: staffing(2, 0, 1),
          signups: inOrder("ben", ["paul", "praxisanleiter"]),
        },
        "anna",
      ),
    ).toEqual([
      {
        terminId: "t1",
        kind: "instruktor",
        places: 1,
        recipients: ["clara", "dora"],
      },
    ]);
  });

  it("calls nobody when the role has a backup: the backups get Platz frei", () => {
    expect(
      called(
        { staffing: staffing(2), signups: inOrder("anna", "ben", "clara") },
        { staffing: staffing(2), signups: inOrder("ben", "clara") },
        "anna",
      ),
    ).toEqual([]);
  });

  it("calls the qualified when a higher number finds no backup", () => {
    const signups = inOrder("anna", "ben");
    expect(
      called(
        { staffing: staffing(2), signups },
        { staffing: staffing(3), signups },
        "lea",
      ),
    ).toEqual([
      {
        terminId: "t1",
        kind: "instruktor",
        places: 1,
        recipients: ["clara", "dora", "paul"],
      },
    ]);
  });

  it("calls nobody when the last backup withdraws while a place is ausgeschrieben", () => {
    expect(
      called(
        { staffing: staffing(2, 1), signups: inOrder("anna", "ben") },
        { staffing: staffing(2, 1), signups: inOrder("anna") },
        "ben",
      ),
    ).toEqual([]);
  });

  it("doesn't call back whoever a coordinator just took off the Termin", () => {
    expect(
      called(
        { staffing: staffing(2), signups: inOrder("anna", "ben") },
        { staffing: staffing(2), signups: inOrder("ben") },
        "lea",
      ),
    ).toEqual([
      {
        terminId: "t1",
        kind: "instruktor",
        places: 1,
        recipients: ["clara", "dora", "paul"],
      },
    ]);
  });
});
