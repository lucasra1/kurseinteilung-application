import type { FestschreibungResult } from "@/lib/staffing";

/** A noun in singular and plural. */
export type Noun = { one: string; many: string };

/** The admin role as users read it; code keeps `isAdmin`. */
export const COORDINATOR: Noun = {
  one: "Praxisanleiterkoordinator:in",
  many: "Praxisanleiterkoordinator:innen",
};

/** "1 Person", "2 Personen", "0 Personen". */
export function countOf(n: number, noun: Noun): string {
  return `${n} ${n === 1 ? noun.one : noun.many}`;
}

const termineCount = (n: number) =>
  countOf(n, { one: "Termin", many: "Termine" });

/** The feedback after Festschreiben (`value` true) or Aufheben. */
export function festschreibungMessage(
  value: boolean,
  { changed, automatisch }: FestschreibungResult,
): string {
  if (value) {
    return changed === 0
      ? "Die Auswahl war schon festgeschrieben."
      : `${termineCount(changed)} festgeschrieben.`;
  }
  const lifted =
    changed === 0
      ? "In der Auswahl war nichts manuell festgeschrieben."
      : `Festschreibung bei ${countOf(changed, { one: "Termin", many: "Terminen" })} aufgehoben.`;
  if (automatisch === 0) return lifted;
  return `${lifted} ${termineCount(automatisch)} ${automatisch === 1 ? "bleibt" : "bleiben"} automatisch festgeschrieben (weniger als 3 Monate).`;
}
