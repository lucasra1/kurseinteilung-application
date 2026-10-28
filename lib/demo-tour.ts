// The demo tour: one story through the app, step by step. The Schaufenster plays it on a
// laptop and a phone side by side; on small screens it runs in the page itself.

import { addDays } from "@/lib/dates";
import {
  DEMO_INVITE_TOKEN,
  type DemoAction,
  type DemoTarget,
} from "@/lib/demo";
import { DEMO_IDS } from "@/lib/demo-data";

export type Device = "desktop" | "phone";

export type TourStep = {
  device: Device;
  /** Whom the window shows; null keeps whoever it shows (e.g. right after registering). */
  personaId: string | null;
  /** Shown under the device in the Schaufenster. */
  who: string;
  path: string;
  title: string;
  text: string;
  highlight?: DemoTarget;
  /** What "Zeig's mir" and the automatic mode do. */
  actions?: DemoAction[];
  /**
   * Later steps build on this one, so "Weiter" does the actions as well, unless the
   * person already did it themselves (then the first target is gone).
   */
  required?: boolean;
};

export const DEMO_START_WHO: Record<Device, string> = {
  desktop: "Anna Berger · Praxisanleiterkoordinatorin",
  phone: "Ben Huber · Instruktor",
};

const ANNA = "Anna Berger · Praxisanleiterkoordinatorin";
const BEN = "Ben Huber · Instruktor";
const CLARA = "Clara Wimmer · Instruktorin";
const panel: DemoTarget = { css: '[aria-labelledby="termin-panel-title"]' };
const termin = (path: string, id: string) => `${path}?termin=${id}`;

/** `today` is YYYY-MM-DD in Vienna; the new Kurs is planned two months ahead. */
export function demoTourSteps(today: string): TourStep[] {
  const signUpButton: DemoTarget = {
    css: 'button[name="kind"][value="instruktor"]',
  };
  const withdrawButton: DemoTarget = {
    css: '[aria-labelledby="termin-panel-title"] button',
    text: "Austragen",
  };
  const claimButton: DemoTarget = {
    css: '[aria-labelledby="termin-panel-title"] button[type="submit"]',
    text: "Platz übernehmen",
  };
  const field = (id: string): DemoTarget => ({ css: `#${id}` });
  /** A field of the n-th Termin row in "Neuer Kurs" (row ids aren't predictable). */
  const row = (n: number, name: string): DemoTarget => ({
    css: `main ol > li:nth-child(${n}) input[name="${name}"]`,
  });

  return [
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/termine",
      title: "Alles auf einen Blick",
      text: "Anna koordiniert die Kurse. Sie sieht sofort, wo noch Instruktoren oder Praxisanleiter fehlen, ohne Excel-Liste und ohne Rundruf.",
      highlight: { css: '[data-demo="kennzahlen"]' },
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/termine",
      title: "Nur das, was noch zu tun ist",
      text: "Ein Klick auf „Braucht Leute“ zeigt nur die Termine mit Lücken. Jede Zeile sagt in Worten, was fehlt.",
      highlight: { css: 'a[href*="status=offen"]' },
      actions: [{ click: { css: 'a[href*="status=offen"]' } }, { wait: 800 }],
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/kurse/neu",
      title: "Ein Kurs mit allen Terminen, ein Formular",
      text: "Anna legt einen Abendkurs an. „Weiterer Tag“ übernimmt Uhrzeit, Ort und Besetzung. Für jeden Termin legt sie fest, wie viele Instruktoren und Praxisanleiter es braucht.",
      actions: [
        { type: field("title"), text: "Erste-Hilfe-Grundkurs (Abendkurs)" },
        { fill: row(1, "date"), value: addDays(today, 60) },
        { fill: row(1, "startTime"), value: "18:00" },
        { fill: row(1, "endTime"), value: "22:00" },
        {
          type: row(1, "topic"),
          text: "Notruf, Bewusstlosigkeit, stabile Seitenlage",
        },
        {
          type: row(1, "location"),
          text: "Schulungszentrum Mitte, Saal 1",
        },
        { fill: row(1, "praxisanleiterNeeded"), value: "1" },
        { click: { css: "main button", text: "Weiterer Tag" } },
        {
          type: row(2, "topic"),
          text: "Wiederbelebung und Defibrillator",
        },
        { click: { css: 'main button[type="submit"]' } },
        { wait: 1500 },
      ],
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/personen",
      title: "Neue Leute kommen über einen Link",
      text: "Statt Konten anzulegen, schickt Anna diesen Link herum, etwa per WhatsApp. Wer ihn öffnet, registriert sich selbst.",
      highlight: { css: 'section[aria-labelledby="invite-heading"]' },
    },
    {
      device: "phone",
      personaId: null,
      who: "Sophie Neumann · neu dabei",
      path: `/einladung/${DEMO_INVITE_TOKEN}`,
      title: "Registriert in einer Minute",
      text: "So sieht der Link am Handy aus. Sophie gibt Namen und E-Mail ein und kreuzt ihre Qualifikation an. Ein Passwort gibt es nicht: Zum Anmelden kommt ein Link per E-Mail, in der Demo geht es direkt weiter.",
      actions: [
        { type: field("fullName"), text: "Sophie Neumann" },
        { type: field("email"), text: "sophie.neumann@example.org" },
        { click: { css: 'input[name="isInstruktor"]' } },
        { click: { css: 'button[type="submit"]' } },
        { wait: 1500 },
      ],
      required: true,
    },
    {
      device: "phone",
      personaId: null,
      who: "Sophie Neumann · Instruktorin",
      path: "/termine",
      title: "Sofort sehen, wo man gebraucht wird",
      text: "Sophie sieht zuerst die Termine, bei denen in ihrer Qualifikation noch jemand fehlt. Alle anderen sind einen Tipp entfernt.",
      highlight: { css: 'main a[href*="termin="]' },
    },
    {
      device: "phone",
      personaId: DEMO_IDS.ben,
      who: BEN,
      path: termin("/termine", DEMO_IDS.terminBenSignsUp),
      title: "Eintragen mit einem Tipp",
      text: "Ben ist Instruktor. Beim Kindernotfallkurs fehlt genau einer. Ein Tipp auf „Als Instruktor eintragen“, fertig. Anna muss dafür nichts tun.",
      highlight: signUpButton,
      actions: [{ click: signUpButton }, { wait: 1200 }],
      required: true,
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: termin("/termine", DEMO_IDS.terminBenSignsUp),
      title: "Die Koordination sieht es sofort",
      text: "Bei Anna ist der Kindernotfallkurs jetzt voll besetzt. Niemand musste nachtelefonieren oder eine Liste abgleichen.",
      highlight: panel,
    },
    {
      device: "phone",
      personaId: DEMO_IDS.ben,
      who: BEN,
      path: termin("/meine", DEMO_IDS.terminBenWithdraws),
      title: "Kurzfristig verhindert?",
      text: "Ben kann beim Grundkurs in fünf Tagen doch nicht und trägt sich selbst aus. Der Termin ist festgeschrieben, deshalb sagt ihm die App vorher, was passiert: Sein Platz wird ausgeschrieben.",
      highlight: withdrawButton,
      actions: [
        { click: withdrawButton },
        { wait: 2500 },
        { click: { css: '[role="alertdialog"] button[type="submit"]' } },
        { wait: 1200 },
      ],
      required: true,
    },
    {
      device: "phone",
      personaId: DEMO_IDS.clara,
      who: CLARA,
      path: "/meine",
      title: "Platz frei: Wer zuerst kommt",
      text: "Clara ist bei diesem Termin Backup. Sie bekommt sofort eine Mail: Ein Platz ist frei geworden, wer zuerst übernimmt, bekommt ihn.",
      highlight: { css: "main article" },
      actions: [{ wait: 1500 }, { mailbox: true }, { wait: 3000 }],
    },
    {
      device: "phone",
      personaId: DEMO_IDS.clara,
      who: CLARA,
      path: termin("/meine", DEMO_IDS.terminBenWithdraws),
      title: "Ein Tipp, und der Platz ist besetzt",
      text: "Clara tippt auf „Platz übernehmen“ und ist fix eingeteilt. Niemand musste herumtelefonieren.",
      highlight: claimButton,
      actions: [{ click: claimButton }, { wait: 1500 }],
      required: true,
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: termin("/termine", DEMO_IDS.terminBenWithdraws),
      title: "Die Koordination weiß Bescheid",
      text: "Anna bekommt zu jeder Änderung eine Mail: wer sich ausgetragen hat, wer angeschrieben wurde, wer übernommen hat. Zu tun hat sie nichts, der Termin ist wieder voll besetzt.",
      highlight: panel,
      actions: [{ wait: 1500 }, { mailbox: true }, { wait: 3000 }],
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: termin("/termine", DEMO_IDS.terminAnnaAdds),
      title: "Lücken gezielt schließen",
      text: "Bei der Auffrischung fehlt ein Praxisanleiter. Die Suche zeigt nur Leute mit passender Qualifikation und wie viele Termine sie schon haben. Markus bekommt automatisch eine Mail.",
      highlight: { css: 'input[type="search"]' },
      actions: [
        { type: { css: 'input[type="search"]' }, text: "Markus" },
        { wait: 600 },
        { click: { css: 'button[name="profileId"]' } },
        { wait: 1500 },
      ],
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/verlauf",
      title: "Alles nachvollziehbar",
      text: "Im Verlauf steht jede Änderung: wer wann was getan hat, was daraus folgte und wer angeschrieben wurde. Das gibt es auch für jeden Termin, jeden Kurs und jede Person.",
      highlight: { css: 'section[aria-label="Einträge"]' },
    },
    {
      device: "desktop",
      personaId: DEMO_IDS.anna,
      who: ANNA,
      path: "/termine",
      title: "Jetzt du",
      text: "Das war die Kurzfassung. Probier jetzt selbst alles aus. Alle Namen sind erfunden, E-Mails landen nur im Demo-Postfach, und alles lässt sich jederzeit auf den Anfang zurücksetzen.",
    },
  ];
}
