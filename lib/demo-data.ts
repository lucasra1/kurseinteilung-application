// Demo mode (DEMO_MODE): the made-up people, Kurse and Termine the demo starts with.
// Dates are offsets from today, so the demo never looks stale. Not server-only: the
// tour uses the ids and personas.

import type { Kind } from "@/lib/staffing";

type Person = {
  id: string;
  fullName: string;
  phone: string;
  isAdmin?: boolean;
  isInstruktor?: boolean;
  isPraxisanleiter?: boolean;
};

const person = (n: number) =>
  `d0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const kurs = (n: number) =>
  `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const termin = (n: number) =>
  `d2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const DEMO_IDS = {
  anna: person(1),
  ben: person(2),
  clara: person(3),
  markus: person(12),
  /** Grundkurs Tag 1, soon (so festgeschrieben): Ben is fixed, Clara is his backup. */
  terminBenWithdraws: termin(11),
  /** Kindernotfallkurs: the Instruktor place Ben takes. */
  terminBenSignsUp: termin(31),
  /** Auffrischung: Anna adds Markus as Praxisanleiter. */
  terminAnnaAdds: termin(21),
};

/** The three people the tour follows; the persona switcher lists them first. */
export const DEMO_PERSONAS = [
  {
    key: "anna",
    id: DEMO_IDS.anna,
    label: "Praxisanleiterkoordinatorin",
    device: "desktop",
  },
  { key: "ben", id: DEMO_IDS.ben, label: "Instruktor", device: "phone" },
  {
    key: "clara",
    id: DEMO_IDS.clara,
    label: "Instruktorin und Praxisanleiterin",
    device: "phone",
  },
] as const;

export type PersonaKey = (typeof DEMO_PERSONAS)[number]["key"];

const PEOPLE: Person[] = [
  {
    id: DEMO_IDS.anna,
    fullName: "Anna Berger",
    phone: "+43 664 120 45 01",
    isAdmin: true,
  },
  {
    id: DEMO_IDS.ben,
    fullName: "Ben Huber",
    phone: "+43 664 120 45 02",
    isInstruktor: true,
  },
  {
    id: DEMO_IDS.clara,
    fullName: "Clara Wimmer",
    phone: "+43 664 120 45 03",
    isInstruktor: true,
    isPraxisanleiter: true,
  },
  {
    id: person(4),
    fullName: "Thomas Gruber",
    phone: "+43 676 330 12 04",
    isInstruktor: true,
  },
  {
    id: person(5),
    fullName: "Sabine Hofer",
    phone: "+43 676 330 12 05",
    isInstruktor: true,
  },
  {
    id: person(6),
    fullName: "Lukas Pichler",
    phone: "+43 676 330 12 06",
    isInstruktor: true,
    isPraxisanleiter: true,
  },
  {
    id: person(7),
    fullName: "Katharina Moser",
    phone: "+43 650 218 77 07",
    isPraxisanleiter: true,
  },
  {
    id: person(8),
    fullName: "Stefan Bauer",
    phone: "+43 650 218 77 08",
    isInstruktor: true,
  },
  {
    id: person(9),
    fullName: "Elisabeth Wagner",
    phone: "+43 650 218 77 09",
    isPraxisanleiter: true,
  },
  {
    id: person(10),
    fullName: "Michael Fuchs",
    phone: "+43 699 104 23 10",
    isInstruktor: true,
  },
  {
    id: person(11),
    fullName: "Verena Eder",
    phone: "+43 699 104 23 11",
    isPraxisanleiter: true,
  },
  {
    id: DEMO_IDS.markus,
    fullName: "Markus Leitner",
    phone: "+43 699 104 23 12",
    isPraxisanleiter: true,
  },
  {
    id: person(13),
    fullName: "Lisa Brunner",
    phone: "+43 664 552 90 13",
    isInstruktor: true,
  },
  {
    id: person(14),
    fullName: "Florian Reiter",
    phone: "+43 664 552 90 14",
    isPraxisanleiter: true,
  },
  {
    id: person(15),
    fullName: "Teresa Lang",
    phone: "+43 664 552 90 15",
    isInstruktor: true,
    isPraxisanleiter: true,
  },
  {
    id: person(16),
    fullName: "Martina Koller",
    phone: "+43 660 781 44 16",
    isPraxisanleiter: true,
  },
];

/** "Clara Wimmer" → "clara.wimmer@example.org" */
function demoEmail(fullName: string): string {
  return `${fullName.toLowerCase().replace(" ", ".")}@example.org`;
}

export const DEMO_PEOPLE = PEOPLE.map((p) => ({
  id: p.id,
  fullName: p.fullName,
  email: demoEmail(p.fullName),
  phone: p.phone,
  isAdmin: p.isAdmin ?? false,
  isInstruktor: p.isInstruktor ?? false,
  isPraxisanleiter: p.isPraxisanleiter ?? false,
}));

type DemoTermin = {
  id: string;
  /** Days from today. */
  day: number;
  startTime: string;
  endTime: string;
  topic: string;
  location: string;
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
  /** In signup order per role: the first N are fixed, the rest are backups. */
  instruktoren?: number[];
  praxisanleiter?: number[];
};

const SAAL_1 = "Schulungszentrum Mitte, Saal 1";
const SAAL_2 = "Schulungszentrum Mitte, Saal 2";
const GK_TAG_1 = "Notruf, Bewusstlosigkeit, Wiederbelebung";
const GK_TAG_2 = "Verletzungen, Vergiftungen, Fallbeispiele";

const GRUNDKURS =
  "Zwei Tage zu je acht Stunden, mit viel Praxis an Übungspuppen und in Fallbeispielen.";
const AUFFRISCHUNG =
  "Für alle, deren Grundkurs ein paar Jahre zurückliegt: Wiederbelebung mit Defibrillator und die häufigsten Notfälle.";
const KINDERNOTFALL =
  "Notfälle bei Babys und Kindern. Ein Abend, vier Stunden.";

/** Each run of a course is its own Kurs, so "Tag 1 von 2" counts its days. */
const KURSE: {
  id: string;
  title: string;
  description: string;
  termine: DemoTermin[];
}[] = [
  {
    id: kurs(1),
    title: "Erste-Hilfe-Grundkurs (Führerschein)",
    description: GRUNDKURS,
    termine: [
      {
        id: termin(1),
        day: -9,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_1,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [2, 5],
        praxisanleiter: [7],
      },
      {
        id: termin(2),
        day: -8,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_2,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [4, 5],
        praxisanleiter: [7],
      },
    ],
  },
  {
    id: kurs(2),
    title: "Erste-Hilfe-Grundkurs (16 Stunden)",
    description: `Für Führerschein, Beruf und Alltag. ${GRUNDKURS}`,
    termine: [
      {
        id: DEMO_IDS.terminBenWithdraws,
        day: 5,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_1,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [2, 4, 3],
        praxisanleiter: [7],
      },
      {
        id: termin(12),
        day: 6,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_2,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [4, 5],
        praxisanleiter: [9],
      },
    ],
  },
  {
    id: kurs(3),
    title: "Erste-Hilfe-Grundkurs für Studierende",
    description: `Für Studierende aller Fachrichtungen. ${GRUNDKURS}`,
    termine: [
      {
        id: termin(13),
        day: 19,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_1,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [6],
      },
      {
        id: termin(14),
        day: 20,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_2,
        location: SAAL_1,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [6, 10],
        praxisanleiter: [11],
      },
    ],
  },
  {
    id: kurs(4),
    title: "Erste-Hilfe-Grundkurs (Wochenende)",
    description: `Samstag und Sonntag. ${GRUNDKURS}`,
    termine: [
      {
        id: termin(15),
        day: 40,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_1,
        location: SAAL_2,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
      },
      {
        id: termin(16),
        day: 41,
        startTime: "08:00",
        endTime: "16:00",
        topic: GK_TAG_2,
        location: SAAL_2,
        instruktorenNeeded: 2,
        praxisanleiterNeeded: 1,
        instruktoren: [8],
      },
    ],
  },
  {
    id: kurs(5),
    title: "Erste-Hilfe-Auffrischung (8 Stunden)",
    description: AUFFRISCHUNG,
    termine: [
      {
        id: DEMO_IDS.terminAnnaAdds,
        day: 12,
        startTime: "09:00",
        endTime: "17:00",
        topic: "Wiederbelebung, Defibrillator, häufige Notfälle",
        location: SAAL_2,
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 1,
        instruktoren: [5],
      },
    ],
  },
  {
    id: kurs(6),
    title: "Erste-Hilfe-Auffrischung für Lehrkräfte",
    description: `Mit Schwerpunkt auf Notfällen in der Schule. ${AUFFRISCHUNG}`,
    termine: [
      {
        id: termin(22),
        day: 33,
        startTime: "09:00",
        endTime: "17:00",
        topic: "Wiederbelebung, Defibrillator, Notfälle in der Schule",
        location: "Volksschule Am Bach, Turnsaal",
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 1,
        instruktoren: [15, 8],
        praxisanleiter: [14],
      },
    ],
  },
  {
    id: kurs(7),
    title: "Kindernotfallkurs für Eltern",
    description: KINDERNOTFALL,
    termine: [
      {
        id: DEMO_IDS.terminBenSignsUp,
        day: 9,
        startTime: "18:00",
        endTime: "22:00",
        topic: "Atemnot, Fieberkrampf, Unfälle im Haushalt",
        location: "Familienzentrum Süd",
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 1,
        praxisanleiter: [11],
      },
    ],
  },
  {
    id: kurs(8),
    title: "Kindernotfallkurs für Großeltern",
    description: KINDERNOTFALL,
    termine: [
      {
        id: termin(32),
        day: 26,
        startTime: "18:00",
        endTime: "22:00",
        topic: "Atemnot, Fieberkrampf, Unfälle im Haushalt",
        location: "Familienzentrum Süd",
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 1,
        instruktoren: [13],
        praxisanleiter: [7],
      },
    ],
  },
  {
    id: kurs(9),
    title: "Erste Hilfe im Betrieb",
    description:
      "Für betriebliche Ersthelferinnen und Ersthelfer, direkt vor Ort im Unternehmen.",
    termine: [
      {
        id: termin(41),
        day: 15,
        startTime: "08:00",
        endTime: "16:00",
        topic: "Notfallcheck, Wiederbelebung, Wundversorgung",
        location: "Gruber Metallbau, Schulungsraum",
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 2,
        instruktoren: [10],
        praxisanleiter: [9, 14],
      },
      {
        id: termin(42),
        day: 16,
        startTime: "08:00",
        endTime: "16:00",
        topic: "Verbrennungen, Knochenbrüche, Praxisübungen",
        location: "Gruber Metallbau, Schulungsraum",
        instruktorenNeeded: 1,
        praxisanleiterNeeded: 2,
        instruktoren: [10],
        praxisanleiter: [9],
      },
    ],
  },
];

export const DEMO_KURSE = KURSE.map(({ id, title, description }) => ({
  id,
  title,
  description,
}));

/** Termine with absolute dates, counted from `today` (YYYY-MM-DD, Vienna). */
export function demoTermine(addDays: (days: number) => string) {
  return KURSE.flatMap((k) =>
    k.termine.map((t) => ({
      id: t.id,
      kursId: k.id,
      date: addDays(t.day),
      startTime: t.startTime,
      endTime: t.endTime,
      topic: t.topic,
      location: t.location,
      instruktorenNeeded: t.instruktorenNeeded,
      praxisanleiterNeeded: t.praxisanleiterNeeded,
    })),
  );
}

/** Signups in order: positions run across both roles, as appendSignup does it. */
export function demoSignups() {
  return KURSE.flatMap((k) =>
    k.termine.flatMap((t) => {
      const ordered: { profileId: string; kind: Kind }[] = [
        ...(t.instruktoren ?? []).map((n) => ({
          profileId: person(n),
          kind: "instruktor" as const,
        })),
        ...(t.praxisanleiter ?? []).map((n) => ({
          profileId: person(n),
          kind: "praxisanleiter" as const,
        })),
      ];
      return ordered.map((s, index) => ({
        ...s,
        terminId: t.id,
        position: index + 1,
      }));
    }),
  );
}
