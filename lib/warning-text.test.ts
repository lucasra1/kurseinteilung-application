import { describe, expect, it } from "vitest";
import type { Kind, Role } from "@/lib/staffing";
import { selfWithdrawWarning, warningText } from "@/lib/warning-text";

const tag1 = {
  id: "t1",
  kursTitle: "Erste Hilfe Grundkurs",
  topic: "Tag 1",
  date: "2026-11-07",
  startTime: "09:00:00",
};

describe("warningText", () => {
  it("says how many places go to the backups and how many backups get a mail", () => {
    expect(
      warningText([
        {
          termin: tag1,
          kind: "instruktor",
          type: "backups",
          places: 1,
          backups: 2,
        },
      ]),
    ).toBe(
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail.",
    );
  });

  it("says that without a backup the qualified get a mail", () => {
    expect(
      warningText([
        {
          termin: tag1,
          kind: "instruktor",
          type: "aufruf",
          places: 1,
          qualified: 14,
        },
      ]),
    ).toBe(
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch fehlt 1 Instruktor-Platz. Es gibt kein Backup: 14 Qualifizierte bekommen eine E-Mail.",
    );
  });

  it.each([
    [
      { type: "backups", places: 2, backups: 1 },
      "Dadurch werden 2 Praxisanleiter-Plätze ausgeschrieben. 1 Backup bekommt eine E-Mail.",
    ],
    [
      { type: "aufruf", places: 2, qualified: 1 },
      "Dadurch fehlen 2 Praxisanleiter-Plätze. Es gibt kein Backup: 1 qualifizierte Person bekommt eine E-Mail.",
    ],
    [
      { type: "aufruf", places: 1, qualified: 0 },
      "Dadurch fehlt 1 Praxisanleiter-Platz. Es gibt kein Backup und sonst niemanden mit der Qualifikation.",
    ],
  ] as const)("words %o as %s", (trigger, sentence) => {
    expect(
      warningText([{ termin: tag1, kind: "praxisanleiter", ...trigger }]),
    ).toBe(
      `Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. ${sentence}`,
    );
  });

  it("writes one line per Termin, in date order", () => {
    const tag2 = { ...tag1, id: "t2", topic: "Tag 2", date: "2026-11-08" };
    const reanimation = {
      id: "t3",
      kursTitle: "Reanimation",
      topic: "Praxis",
      date: "2026-11-07",
      startTime: "13:00:00",
    };
    expect(
      warningText([
        {
          termin: tag2,
          kind: "instruktor",
          type: "backups",
          places: 1,
          backups: 2,
        },
        {
          termin: reanimation,
          kind: "instruktor",
          type: "aufruf",
          places: 1,
          qualified: 3,
        },
        {
          termin: tag1,
          kind: "instruktor",
          type: "backups",
          places: 1,
          backups: 1,
        },
      ]).split("\n"),
    ).toEqual([
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 1 Backup bekommt eine E-Mail.",
      "Der Termin „Reanimation – Praxis“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch fehlt 1 Instruktor-Platz. Es gibt kein Backup: 3 Qualifizierte bekommen eine E-Mail.",
      "Der Termin „Erste Hilfe Grundkurs – Tag 2“ am So., 08.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail.",
    ]);
  });

  it("keeps both roles of one Termin on its line", () => {
    expect(
      warningText([
        {
          termin: tag1,
          kind: "instruktor",
          type: "backups",
          places: 1,
          backups: 2,
        },
        {
          termin: tag1,
          kind: "praxisanleiter",
          type: "aufruf",
          places: 1,
          qualified: 5,
        },
      ]),
    ).toBe(
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail. Außerdem fehlt 1 Praxisanleiter-Platz. Es gibt kein Backup: 5 Qualifizierte bekommen eine E-Mail.",
    );
  });
});

describe("selfWithdrawWarning", () => {
  /** Tag 1 with these signups; festgeschrieben and upcoming unless overridden. */
  function termin(
    signups: Array<[string, Role]>,
    overrides: { festgeschrieben?: boolean; isPast?: boolean } = {},
  ) {
    return {
      ...tag1,
      festgeschrieben: true,
      isPast: false,
      ...overrides,
      signups: signups.map(([profileId, role]) => ({
        profileId,
        role,
        kind: role.replace("backup-", "") as Kind,
      })),
    };
  }

  it("warns a fixed place on a festgeschriebenen Termin that the backups get a mail", () => {
    expect(
      selfWithdrawWarning(
        termin([
          ["me", "instruktor"],
          ["b1", "backup-instruktor"],
          ["b2", "backup-instruktor"],
          ["p1", "backup-praxisanleiter"],
        ]),
        "me",
      ),
    ).toBe(
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail.",
    );
  });

  it("without a backup of the role, says the other qualified get a mail", () => {
    expect(
      selfWithdrawWarning(
        termin([
          ["me", "praxisanleiter"],
          ["b1", "backup-instruktor"],
        ]),
        "me",
      ),
    ).toBe(
      "Der Termin „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026 ist festgeschrieben. Dadurch fehlt 1 Praxisanleiter-Platz. Es gibt kein Backup: Die übrigen Qualifizierten bekommen eine E-Mail.",
    );
  });

  it.each([
    [
      "a backup",
      termin([
        ["x", "instruktor"],
        ["me", "backup-instruktor"],
      ]),
    ],
    [
      "not festgeschrieben",
      termin([["me", "instruktor"]], { festgeschrieben: false }),
    ],
    ["past", termin([["me", "instruktor"]], { isPast: true })],
    ["not signed up", termin([["x", "instruktor"]])],
  ])("has nothing to warn about when %s", (_, t) => {
    expect(selfWithdrawWarning(t, "me")).toBeUndefined();
  });
});
