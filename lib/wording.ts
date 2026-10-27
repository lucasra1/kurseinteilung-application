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
