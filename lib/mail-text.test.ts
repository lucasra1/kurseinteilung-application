import { describe, expect, it } from "vitest";
import {
  type Recipient,
  type StaffingAction,
  type StaffingTermin,
  staffingEvents,
  type TerminState,
} from "@/lib/audit";
import {
  adminMail,
  gebrauchtMail,
  MAIL_GROUPS,
  platzFreiMail,
  type StaffingMail,
} from "@/lib/mail-text";
import type { Aufruf, AusschreibungPlan, Kind, Role } from "@/lib/staffing";

const LEA = { id: "lea", fullName: "Lea Berger" };
const ANNA = { id: "anna", fullName: "Anna Huber" };
const BEN = { id: "ben", fullName: "Ben Maier" };

const APP_URL = "https://kurse.example.org";

/** An Aufruf as `mutateStaffing` hands it to `staffingEvents`. */
type Called = Aufruf<Recipient>;

const recipient = (person: { id: string; fullName: string }): Recipient => ({
  profileId: person.id,
  personName: person.fullName,
});
const TODAY = "2026-10-27";

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

function signup(
  person: { id: string; fullName: string },
  kind: Kind,
  position: number,
  role: Role,
) {
  return {
    profileId: person.id,
    fullName: person.fullName,
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

/** The admin mail for an action, with entries built the way mutateStaffing builds them. */
function mail(
  action: StaffingAction,
  before: TerminState[],
  after: TerminState[],
  today = TODAY,
  plans: AusschreibungPlan[] = [],
  aufrufe: Called[] = [],
) {
  const entries = staffingEvents({ action, before, after, plans, aufrufe });
  return adminMail({
    actor: action.actor,
    entries,
    before,
    after,
    today,
    appUrl: APP_URL,
  });
}

describe("adminMail", () => {
  it("describes a self-withdrawal, the backup moving up and the Stand afterwards", () => {
    expect(
      mail(
        {
          type: "signup.removed",
          actor: ANNA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        [
          state(T1, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
        [state(T1, [signup(BEN, "instruktor", 1, "instruktor")])],
      ),
    ).toEqual({
      subject: "Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Anna Huber hat sich ausgetragen (Instruktor).\n\n" +
        "– Ben Maier rückt als Instruktor nach.\n\n" +
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("counts one backup in the singular", () => {
    expect(
      mail(
        {
          type: "signup.created",
          actor: BEN,
          target: { terminId: "t1", profileId: BEN.id },
        },
        [state(T1, [signup(ANNA, "instruktor", 1, "instruktor")])],
        [
          state(T1, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
      )?.text,
    ).toContain(
      "Ben Maier hat sich eingetragen (Backup Instruktor).\n\n" +
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1, 1 Backup.",
    );
  });

  it("writes one block per Termin, in date order, for an action on several Termine", () => {
    const T2: StaffingTermin = {
      ...T1,
      id: "t2",
      topic: "Tag 2",
      date: "2026-11-08",
    };
    // mutateStaffing locks Termine in id order, which needn't be date order.
    const result = mail(
      { type: "person.removed", actor: LEA, target: { profileId: ANNA.id } },
      [
        state(T2, [signup(ANNA, "praxisanleiter", 1, "praxisanleiter")]),
        state(T1, [
          signup(ANNA, "instruktor", 1, "instruktor"),
          signup(BEN, "instruktor", 2, "backup-instruktor"),
        ]),
      ],
      [state(T2, []), state(T1, [signup(BEN, "instruktor", 1, "instruktor")])],
    );

    expect(result?.text).toBe(
      "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Lea Berger hat Anna Huber entfernt (Instruktor).\n\n" +
        "– Ben Maier rückt als Instruktor nach.\n\n" +
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "„Erste Hilfe Grundkurs – Tag 2“ am So., 08.11.2026, 09:00–17:00\n" +
        "Lea Berger hat Anna Huber entfernt (Praxisanleiter).\n\n" +
        "Aktueller Stand: Instruktoren 0/1, Praxisanleiter 0/1.\n\n" +
        "https://kurse.example.org/termine?termin=t2\n\n" +
        "Kurseinteilung",
    );
  });

  describe("past Termine", () => {
    const PAST: StaffingTermin = {
      ...T1,
      id: "t0",
      topic: "Tag 0",
      date: "2026-10-26",
    };
    const removeAnna: StaffingAction = {
      type: "person.removed",
      actor: LEA,
      target: { profileId: ANNA.id },
    };

    it("leaves them out of the mail", () => {
      const result = mail(
        removeAnna,
        [
          state(PAST, [signup(ANNA, "instruktor", 1, "instruktor")]),
          state(T1, [signup(ANNA, "instruktor", 1, "instruktor")]),
        ],
        [state(PAST, []), state(T1, [])],
      );
      expect(result?.text).not.toContain("Tag 0");
      expect(result?.text).toContain("Tag 1");
    });

    it("sends no mail if the action only touched past Termine", () => {
      expect(
        mail(
          removeAnna,
          [state(PAST, [signup(ANNA, "instruktor", 1, "instruktor")])],
          [state(PAST, [])],
        ),
      ).toBeNull();
    });

    it("still mails about a Termin taking place today", () => {
      expect(
        mail(
          removeAnna,
          [state(T1, [signup(ANNA, "instruktor", 1, "instruktor")])],
          [state(T1, [])],
          T1.date,
        ),
      ).not.toBeNull();
    });
  });

  describe("only changes to the staffing", () => {
    const anna = [state(T1, [signup(ANNA, "instruktor", 1, "instruktor")])];
    const updateT1: StaffingAction = {
      type: "termin.updated",
      actor: LEA,
      target: { terminId: "t1" },
    };

    it("sends no mail for a new time or place", () => {
      const moved = { ...T1, startTime: "10:00:00", location: "Halle 3" };
      expect(mail(updateT1, anna, [state(moved, anna[0].signups)])).toBeNull();
    });

    it("mails about changed numbers, even if nobody's role changes", () => {
      const more = { ...T1, instruktorenNeeded: 2, startTime: "10:00:00" };
      expect(
        mail(updateT1, anna, [state(more, anna[0].signups)])?.text,
      ).toContain("Aktueller Stand: Instruktoren 1/2, Praxisanleiter 0/1.");
    });

    it("mails about swapping two backups, though no role changes", () => {
      const CLARA = { id: "clara", fullName: "Clara Ott" };
      const result = mail(
        {
          type: "signup.moved",
          actor: LEA,
          target: { terminId: "t1", profileId: CLARA.id },
          direction: "up",
        },
        [
          state(T1, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
            signup(CLARA, "instruktor", 3, "backup-instruktor"),
          ]),
        ],
        [
          state(T1, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(CLARA, "instruktor", 2, "backup-instruktor"),
            signup(BEN, "instruktor", 3, "backup-instruktor"),
          ]),
        ],
      );
      expect(result?.text).toContain(
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1, 2 Backups.",
      );
    });

    it("sends no mail for deleting a Termin nobody signed up for", () => {
      expect(
        mail(
          { type: "termin.deleted", actor: LEA, target: { terminId: "t1" } },
          [state(T1, [])],
          [],
        ),
      ).toBeNull();
    });

    it("lists only the deleted Termine that had signups, without Stand or link", () => {
      const T2: StaffingTermin = { ...T1, id: "t2", topic: "Tag 2" };
      expect(
        mail(
          { type: "kurs.deleted", actor: LEA, target: { kursId: "k1" } },
          [...anna, state(T2, [])],
          [],
        )?.text,
      ).toBe(
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
          "Lea Berger hat den Kurs „Erste Hilfe Grundkurs“ gelöscht.\n\n" +
          "– Anna Huber ist nicht mehr eingetragen (Instruktor).\n\n" +
          "Kurseinteilung",
      );
    });
  });

  describe("subject", () => {
    const anna = [state(T1, [signup(ANNA, "instruktor", 1, "instruktor")])];
    const empty = [state(T1, [])];
    const twoInstruktoren = { ...T1, instruktorenNeeded: 2 };

    it.each<[string, StaffingAction, TerminState[], TerminState[]]>([
      [
        "Eintragung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        {
          type: "signup.created",
          actor: ANNA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        empty,
        anna,
      ],
      [
        "Eintragung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        {
          type: "signup.created",
          actor: LEA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        empty,
        anna,
      ],
      [
        "Ausgetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        {
          type: "signup.removed",
          actor: LEA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        anna,
        empty,
      ],
      [
        "Besetzung geändert: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        {
          type: "signup.moved",
          actor: LEA,
          target: { terminId: "t1", profileId: BEN.id },
          direction: "up",
        },
        [
          state(T1, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
        [
          state(T1, [
            signup(BEN, "instruktor", 1, "instruktor"),
            signup(ANNA, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
      ],
      [
        "Besetzung geändert: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        { type: "termin.updated", actor: LEA, target: { terminId: "t1" } },
        anna,
        [state(twoInstruktoren, anna[0].signups)],
      ],
      [
        "Termin gelöscht: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        { type: "termin.deleted", actor: LEA, target: { terminId: "t1" } },
        anna,
        [],
      ],
      [
        "Kurs gelöscht: Erste Hilfe Grundkurs",
        { type: "kurs.deleted", actor: LEA, target: { kursId: "k1" } },
        anna,
        [],
      ],
      [
        "Person entfernt: Anna Huber",
        { type: "person.removed", actor: LEA, target: { profileId: ANNA.id } },
        anna,
        empty,
      ],
    ])("is „%s“", (expected, action, before, after) => {
      expect(mail(action, before, after)?.subject).toBe(expected);
    });
  });
});

describe("adminMail for Festschreiben", () => {
  const anna = [signup(ANNA, "instruktor", 1, "instruktor")];
  const T2: StaffingTermin = { ...T1, id: "t2", topic: "Tag 2" };

  it("sends no mail for Festschreiben or Aufheben while no role changes", () => {
    const open = [state(T1, anna), state(T2, [])];
    const locked = [
      state({ ...T1, festgeschrieben: true }, anna),
      state({ ...T2, festgeschrieben: true }, []),
    ];
    const target = { terminIds: ["t1", "t2"] };
    expect(
      mail(
        { type: "termin.festgeschrieben", actor: LEA, target },
        open,
        locked,
      ),
    ).toBeNull();
    expect(
      mail({ type: "termin.aufgehoben", actor: LEA, target }, locked, open),
    ).toBeNull();
  });
});

describe("adminMail for Ausschreibung", () => {
  const CLARA = { id: "clara", fullName: "Clara Ott" };
  const NONE = { ausgeschrieben: 0, trigger: { type: "none" } } as const;
  const T1F: StaffingTermin = { ...T1, festgeschrieben: true };
  const backups = (recipients: string[]): AusschreibungPlan[] => [
    {
      terminId: "t1",
      roles: {
        instruktor: {
          ausgeschrieben: 1,
          trigger: { type: "backups", places: 1, recipients },
        },
        praxisanleiter: NONE,
      },
    },
  ];
  const withdrawal = {
    type: "signup.removed",
    actor: ANNA,
    target: { terminId: "t1", profileId: ANNA.id },
  } as const;
  const before = [
    state(T1F, [
      signup(ANNA, "instruktor", 1, "instruktor"),
      signup(BEN, "instruktor", 2, "backup-instruktor"),
      signup(CLARA, "instruktor", 3, "backup-instruktor"),
    ]),
  ];
  const after = [
    state({ ...T1F, instruktorenAusgeschrieben: 1 }, [
      signup(BEN, "instruktor", 1, "backup-instruktor"),
      signup(CLARA, "instruktor", 2, "backup-instruktor"),
    ]),
  ];

  it("says the place is ausgeschrieben and whom it was offered to", () => {
    expect(
      mail(withdrawal, before, after, TODAY, backups([BEN.id, CLARA.id])),
    ).toEqual({
      subject: "Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Anna Huber hat sich ausgetragen (Instruktor).\n\n" +
        "– Der Termin ist festgeschrieben: 1 Instruktor-Platz ist ausgeschrieben. Angeschrieben: Ben Maier, Clara Ott (Backups).\n\n" +
        "Aktueller Stand: Instruktoren 0/1, Praxisanleiter 0/1, 2 Backups.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("names a single backup in the singular, and nobody if the only backup acted", () => {
    expect(
      mail(withdrawal, before, after, TODAY, backups([BEN.id]))?.text,
    ).toContain(
      "– Der Termin ist festgeschrieben: 1 Instruktor-Platz ist ausgeschrieben. Angeschrieben: Ben Maier (Backup).\n",
    );
    expect(mail(withdrawal, before, after, TODAY, backups([]))?.text).toContain(
      "– Der Termin ist festgeschrieben: 1 Instruktor-Platz ist ausgeschrieben.\n",
    );
  });

  it("has its own subject for Platz übernehmen", () => {
    expect(
      mail(
        {
          type: "signup.claimed",
          actor: BEN,
          target: { terminId: "t1", profileId: BEN.id },
        },
        after,
        [
          state(T1F, [
            signup(BEN, "instruktor", 1, "instruktor"),
            signup(CLARA, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
      ),
    ).toEqual({
      subject: "Platz übernommen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Ben Maier hat den Platz übernommen (Backup → Instruktor).\n\n" +
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1, 1 Backup.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("tells the other admins who gave whom the place", () => {
    expect(
      mail(
        {
          type: "signup.place_given",
          actor: LEA,
          target: { terminId: "t1", profileId: CLARA.id },
        },
        after,
        [
          state(T1F, [
            signup(CLARA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
      ),
    ).toEqual({
      subject: "Platz gegeben: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Lea Berger hat Clara Ott den Platz gegeben (Backup → Instruktor).\n\n" +
        "Aktueller Stand: Instruktoren 1/1, Praxisanleiter 0/1, 1 Backup.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });
});

describe("adminMail for Aufruf", () => {
  const NONE = { ausgeschrieben: 0, trigger: { type: "none" } } as const;
  const T1F: StaffingTermin = { ...T1, festgeschrieben: true };
  const plans: AusschreibungPlan[] = [
    {
      terminId: "t1",
      roles: {
        instruktor: {
          ausgeschrieben: 0,
          trigger: { type: "aufruf", places: 1 },
        },
        praxisanleiter: NONE,
      },
    },
  ];
  const calling = (n: number): Called[] => [
    {
      terminId: "t1",
      kind: "instruktor",
      places: 1,
      recipients: Array.from({ length: n }, (_, i) => ({
        profileId: `q${i}`,
        personName: `Qualifizierte:r ${i}`,
      })),
    },
  ];
  const withdrawal = {
    type: "signup.removed",
    actor: ANNA,
    target: { terminId: "t1", profileId: ANNA.id },
  } as const;
  const before = [state(T1F, [signup(ANNA, "instruktor", 1, "instruktor")])];
  const after = [state(T1F, [])];

  it("says there is no backup and how many qualified were written to", () => {
    expect(mail(withdrawal, before, after, TODAY, plans, calling(14))).toEqual({
      subject: "Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "„Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00\n" +
        "Anna Huber hat sich ausgetragen (Instruktor).\n\n" +
        "– Kein Backup: 14 Qualifizierte angeschrieben.\n\n" +
        "Aktueller Stand: Instruktoren 0/1, Praxisanleiter 0/1.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("speaks of one person, or says nobody else is qualified", () => {
    expect(
      mail(withdrawal, before, after, TODAY, plans, calling(1))?.text,
    ).toContain("\n– Kein Backup: 1 qualifizierte Person angeschrieben.\n");
    expect(
      mail(withdrawal, before, after, TODAY, plans, calling(0))?.text,
    ).toContain("\n– Kein Backup und sonst niemand qualifiziert.\n");
  });
});

describe("platzFreiMail", () => {
  it("offers the place to a backup, with the link to the Termin", () => {
    expect(
      platzFreiMail({
        termin: T1,
        kind: "instruktor",
        places: 1,
        name: "Ben Maier",
        appUrl: APP_URL,
      }),
    ).toEqual({
      subject: "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "Hallo Ben Maier,\n\n" +
        "du bist Backup bei „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00. Ein Instruktor-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("speaks of several places when more than one is ausgeschrieben", () => {
    expect(
      platzFreiMail({
        termin: T1,
        kind: "praxisanleiter",
        places: 2,
        name: "Ben Maier",
        appUrl: APP_URL,
      }).text,
    ).toContain(
      "09:00–17:00. 2 Praxisanleiter-Plätze sind frei geworden. Wer zuerst übernimmt, bekommt einen davon.",
    );
  });
});

describe("gebrauchtMail", () => {
  it("asks someone qualified to sign up, with the link to the Termin", () => {
    expect(
      gebrauchtMail({
        termin: T1,
        kind: "instruktor",
        places: 1,
        name: "Clara Ott",
        appUrl: APP_URL,
      }),
    ).toEqual({
      subject: "Du wirst gebraucht: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      text:
        "Hallo Clara Ott,\n\n" +
        "bei „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 fehlt ein Instruktor. Wenn du Zeit hast, trag dich ein.\n\n" +
        "https://kurse.example.org/termine?termin=t1\n\n" +
        "Kurseinteilung",
    });
  });

  it("names the number when more than one is missing", () => {
    expect(
      gebrauchtMail({
        termin: T1,
        kind: "praxisanleiter",
        places: 2,
        name: "Clara Ott",
        appUrl: APP_URL,
      }).text,
    ).toContain("fehlen 2 Praxisanleiter. Wenn du Zeit hast, trag dich ein.");
  });
});

describe("MAIL_GROUPS", () => {
  const CLARA = { id: "clara", fullName: "Clara Ott" };
  const NONE = { ausgeschrieben: 0, trigger: { type: "none" } } as const;
  const T1F: StaffingTermin = { ...T1, festgeschrieben: true };

  /**
   * Every mail of an action, group by group in sending order, with entries built the way
   * mutateStaffing builds them.
   */
  function mails(
    action: StaffingAction,
    before: TerminState[],
    after: TerminState[],
    opts: {
      plans?: AusschreibungPlan[];
      aufrufe?: Called[];
      today?: string;
    } = {},
  ) {
    const { plans, aufrufe, today = TODAY } = opts;
    const entries = staffingEvents({ action, before, after, plans, aufrufe });
    const input = {
      actor: action.actor,
      entries,
      before,
      after,
      today,
      appUrl: APP_URL,
    };
    return MAIL_GROUPS.flatMap((group) => group.build(input));
  }

  /** Who gets which mail, in sending order. */
  function sent(list: StaffingMail[]) {
    return list.map((mail) => [
      mail.group,
      "profileId" in mail ? mail.profileId : "alle Koordinator:innen",
      mail.subject,
    ]);
  }

  const backupsPlan = (
    terminId: string,
    places: number,
    recipients: string[],
  ): AusschreibungPlan => ({
    terminId,
    roles: {
      instruktor: {
        ausgeschrieben: places,
        trigger: { type: "backups", places, recipients },
      },
      praxisanleiter: NONE,
    },
  });

  describe("Austragen auf einem festgeschriebenen Termin", () => {
    const withBackups = [
      state(T1F, [
        signup(ANNA, "instruktor", 1, "instruktor"),
        signup(BEN, "instruktor", 2, "backup-instruktor"),
        signup(CLARA, "instruktor", 3, "backup-instruktor"),
      ]),
    ];
    const ausgeschrieben = [
      state({ ...T1F, instruktorenAusgeschrieben: 1 }, [
        signup(BEN, "instruktor", 1, "backup-instruktor"),
        signup(CLARA, "instruktor", 2, "backup-instruktor"),
      ]),
    ];

    it("offers the place to every backup, then tells the admins", () => {
      expect(
        mails(
          {
            type: "signup.removed",
            actor: ANNA,
            target: { terminId: "t1", profileId: ANNA.id },
          },
          withBackups,
          ausgeschrieben,
          { plans: [backupsPlan("t1", 1, [BEN.id, CLARA.id])] },
        ),
      ).toEqual([
        {
          group: "platz-frei",
          profileId: BEN.id,
          subject: "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text:
            "Hallo Ben Maier,\n\n" +
            "du bist Backup bei „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00. Ein Instruktor-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn.\n\n" +
            "https://kurse.example.org/termine?termin=t1\n\n" +
            "Kurseinteilung",
        },
        {
          group: "platz-frei",
          profileId: CLARA.id,
          subject: "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text: expect.stringMatching(
            /^Hallo Clara Ott,\n\ndu bist Backup bei/,
          ),
        },
        {
          group: "admins",
          subject: "Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text: expect.stringContaining(
            "– Der Termin ist festgeschrieben: 1 Instruktor-Platz ist ausgeschrieben. Angeschrieben: Ben Maier, Clara Ott (Backups).",
          ),
        },
      ]);
    });

    it("by an admin: Platz frei first, then the person taken off, then the admins", () => {
      const result = mails(
        {
          type: "signup.removed",
          actor: LEA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        withBackups,
        ausgeschrieben,
        { plans: [backupsPlan("t1", 1, [BEN.id, CLARA.id])] },
      );
      expect(sent(result)).toEqual([
        [
          "platz-frei",
          BEN.id,
          "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "platz-frei",
          CLARA.id,
          "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "betroffene",
          ANNA.id,
          "Ausgetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "admins",
          "alle Koordinator:innen",
          "Ausgetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
      expect(result[2]?.text).toBe(
        "Hallo Anna Huber,\n\n" +
          "du wurdest von „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 ausgetragen.\n\n" +
          "https://kurse.example.org/meine\n\n" +
          "Kurseinteilung",
      );
    });

    it("without a backup, calls on the qualified not on the Termin, then tells the admins", () => {
      expect(
        mails(
          {
            type: "signup.removed",
            actor: ANNA,
            target: { terminId: "t1", profileId: ANNA.id },
          },
          [state(T1F, [signup(ANNA, "instruktor", 1, "instruktor")])],
          [state(T1F, [])],
          {
            plans: [
              {
                terminId: "t1",
                roles: {
                  instruktor: {
                    ausgeschrieben: 0,
                    trigger: { type: "aufruf", places: 1 },
                  },
                  praxisanleiter: NONE,
                },
              },
            ],
            aufrufe: [
              {
                terminId: "t1",
                kind: "instruktor",
                places: 1,
                recipients: [BEN, CLARA].map(recipient),
              },
            ],
          },
        ),
      ).toEqual([
        {
          group: "gebraucht",
          profileId: BEN.id,
          subject: "Du wirst gebraucht: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text:
            "Hallo Ben Maier,\n\n" +
            "bei „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 fehlt ein Instruktor. Wenn du Zeit hast, trag dich ein.\n\n" +
            "https://kurse.example.org/termine?termin=t1\n\n" +
            "Kurseinteilung",
        },
        {
          group: "gebraucht",
          profileId: CLARA.id,
          subject: "Du wirst gebraucht: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text: expect.stringMatching(/^Hallo Clara Ott,\n\nbei/),
        },
        {
          group: "admins",
          subject: "Abmeldung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
          text: expect.stringContaining(
            "– Kein Backup: 2 Qualifizierte angeschrieben.",
          ),
        },
      ]);
    });
  });

  describe("an ausgeschriebener Platz", () => {
    const offen = [
      state({ ...T1F, instruktorenAusgeschrieben: 1 }, [
        signup(BEN, "instruktor", 1, "backup-instruktor"),
        signup(CLARA, "instruktor", 2, "backup-instruktor"),
      ]),
    ];

    it("taken by a backup themselves only goes to the admins", () => {
      expect(
        sent(
          mails(
            {
              type: "signup.claimed",
              actor: BEN,
              target: { terminId: "t1", profileId: BEN.id },
            },
            offen,
            [
              state(T1F, [
                signup(BEN, "instruktor", 1, "instruktor"),
                signup(CLARA, "instruktor", 2, "backup-instruktor"),
              ]),
            ],
          ),
        ),
      ).toEqual([
        [
          "admins",
          "alle Koordinator:innen",
          "Platz übernommen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
    });

    it("given by an admin tells the person their new role, then the admins", () => {
      const result = mails(
        {
          type: "signup.place_given",
          actor: LEA,
          target: { terminId: "t1", profileId: CLARA.id },
        },
        offen,
        [
          state(T1F, [
            signup(CLARA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
      );
      expect(sent(result)).toEqual([
        [
          "betroffene",
          CLARA.id,
          "Neue Rolle: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "admins",
          "alle Koordinator:innen",
          "Platz gegeben: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
      expect(result[0]?.text).toBe(
        "Hallo Clara Ott,\n\n" +
          "deine Rolle für „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 hat sich geändert: Backup (Instruktor) → Instruktor.\n\n" +
          "https://kurse.example.org/meine\n\n" +
          "Kurseinteilung",
      );
    });
  });

  describe("Zahl erhöht", () => {
    const updateT1: StaffingAction = {
      type: "termin.updated",
      actor: LEA,
      target: { terminId: "t1" },
    };
    const annaAndBen = (termin: StaffingTermin) =>
      state(termin, [
        signup(ANNA, "instruktor", 1, "instruktor"),
        signup(BEN, "instruktor", 2, "backup-instruktor"),
      ]);

    it("on a festgeschriebenen Termin offers the new place to the backup, who stays backup", () => {
      expect(
        sent(
          mails(
            updateT1,
            [annaAndBen(T1F)],
            [
              annaAndBen({
                ...T1F,
                instruktorenNeeded: 2,
                instruktorenAusgeschrieben: 1,
              }),
            ],
            { plans: [backupsPlan("t1", 1, [BEN.id])] },
          ),
        ),
      ).toEqual([
        [
          "platz-frei",
          BEN.id,
          "Platz frei: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "admins",
          "alle Koordinator:innen",
          "Besetzung geändert: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
    });

    it("otherwise tells the backup moving up their new role", () => {
      expect(
        sent(
          mails(
            updateT1,
            [annaAndBen(T1)],
            [
              state({ ...T1, instruktorenNeeded: 2 }, [
                signup(ANNA, "instruktor", 1, "instruktor"),
                signup(BEN, "instruktor", 2, "instruktor"),
              ]),
            ],
          ),
        ),
      ).toEqual([
        [
          "betroffene",
          BEN.id,
          "Neue Rolle: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "admins",
          "alle Koordinator:innen",
          "Besetzung geändert: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
    });
  });

  it("for a removed person: per Termin the Aufruf and who moves up, nothing to the removed account", () => {
    const T2F: StaffingTermin = {
      ...T1F,
      id: "t2",
      topic: "Tag 2",
      date: "2026-11-08",
    };
    expect(
      sent(
        mails(
          {
            type: "person.removed",
            actor: LEA,
            target: { profileId: ANNA.id },
          },
          [
            state(T1, [
              signup(ANNA, "instruktor", 1, "instruktor"),
              signup(BEN, "instruktor", 2, "backup-instruktor"),
            ]),
            state(T2F, [signup(ANNA, "praxisanleiter", 1, "praxisanleiter")]),
          ],
          [
            state(T1, [signup(BEN, "instruktor", 1, "instruktor")]),
            state(T2F, []),
          ],
          {
            plans: [
              {
                terminId: "t2",
                roles: {
                  instruktor: NONE,
                  praxisanleiter: {
                    ausgeschrieben: 0,
                    trigger: { type: "aufruf", places: 1 },
                  },
                },
              },
            ],
            aufrufe: [
              {
                terminId: "t2",
                kind: "praxisanleiter",
                places: 1,
                recipients: [recipient(CLARA)],
              },
            ],
          },
        ),
      ),
    ).toEqual([
      [
        "gebraucht",
        CLARA.id,
        "Du wirst gebraucht: Erste Hilfe Grundkurs, So., 08.11.2026",
      ],
      [
        "betroffene",
        BEN.id,
        "Neue Rolle: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
      ["admins", "alle Koordinator:innen", "Person entfernt: Anna Huber"],
    ]);
  });

  it("sends nothing about a past Termin", () => {
    const PAST: StaffingTermin = { ...T1, id: "t0", date: "2026-10-26" };
    expect(
      mails(
        {
          type: "signup.removed",
          actor: LEA,
          target: { terminId: "t0", profileId: ANNA.id },
        },
        [
          state(PAST, [
            signup(ANNA, "instruktor", 1, "instruktor"),
            signup(BEN, "instruktor", 2, "backup-instruktor"),
          ]),
        ],
        [state(PAST, [signup(BEN, "instruktor", 1, "instruktor")])],
      ),
    ).toEqual([]);
  });

  describe("Eintragen", () => {
    const anna = [state(T1, [signup(ANNA, "instruktor", 1, "instruktor")])];

    it("by an admin tells the person, then the admins", () => {
      const result = mails(
        {
          type: "signup.created",
          actor: LEA,
          target: { terminId: "t1", profileId: ANNA.id },
        },
        [state(T1, [])],
        anna,
      );
      expect(sent(result)).toEqual([
        [
          "betroffene",
          ANNA.id,
          "Eingetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
        [
          "admins",
          "alle Koordinator:innen",
          "Eintragung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
      expect(result[0]?.text).toBe(
        "Hallo Anna Huber,\n\n" +
          "du wurdest für „Erste Hilfe Grundkurs – Tag 1“ am Sa., 07.11.2026, 09:00–17:00 als Instruktor eingetragen.\n\n" +
          "https://kurse.example.org/meine\n\n" +
          "Kurseinteilung",
      );
    });

    it("oneself only goes to the admins", () => {
      expect(
        sent(
          mails(
            {
              type: "signup.created",
              actor: ANNA,
              target: { terminId: "t1", profileId: ANNA.id },
            },
            [state(T1, [])],
            anna,
          ),
        ),
      ).toEqual([
        [
          "admins",
          "alle Koordinator:innen",
          "Eintragung: Erste Hilfe Grundkurs, Sa., 07.11.2026",
        ],
      ]);
    });
  });

  it("tells those whose role changed in signup order, not the moved person first", () => {
    expect(
      sent(
        mails(
          {
            type: "signup.moved",
            actor: LEA,
            target: { terminId: "t1", profileId: CLARA.id },
            direction: "up",
          },
          [
            state(T1, [
              signup(BEN, "instruktor", 1, "instruktor"),
              signup(CLARA, "instruktor", 2, "backup-instruktor"),
            ]),
          ],
          [
            state(T1, [
              signup(CLARA, "instruktor", 1, "instruktor"),
              signup(BEN, "instruktor", 2, "backup-instruktor"),
            ]),
          ],
        ),
      ),
    ).toEqual([
      [
        "betroffene",
        BEN.id,
        "Neue Rolle: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
      [
        "betroffene",
        CLARA.id,
        "Neue Rolle: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
      [
        "admins",
        "alle Koordinator:innen",
        "Besetzung geändert: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
    ]);
  });

  it("tells everyone on a deleted Termin they're off it", () => {
    expect(
      sent(
        mails(
          { type: "termin.deleted", actor: LEA, target: { terminId: "t1" } },
          [
            state(T1, [
              signup(ANNA, "instruktor", 1, "instruktor"),
              signup(BEN, "instruktor", 2, "backup-instruktor"),
            ]),
          ],
          [],
        ),
      ),
    ).toEqual([
      [
        "betroffene",
        ANNA.id,
        "Ausgetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
      [
        "betroffene",
        BEN.id,
        "Ausgetragen: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
      [
        "admins",
        "alle Koordinator:innen",
        "Termin gelöscht: Erste Hilfe Grundkurs, Sa., 07.11.2026",
      ],
    ]);
  });
});
