// Which Verlauf entries a panel, page or sheet reads, the Bereiche `/verlauf` filters by,
// and where the Termine, Kurse and people the entries are about are shown. Pure.
import type { AuditType } from "@/lib/audit";
import { hrefWith } from "@/lib/url";

/** What an entry can be about, and whose Verlauf a panel, page or sheet shows. */
export const SUBJECT_KINDS = ["termin", "kurs", "person"] as const;

export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/** Where a Verlauf is shown: a Termin's panel, a Kurs page, a person's sheet, or `/verlauf`. */
export type HistoryScope = SubjectKind | "all";

/** Which entries to read: those of one Termin, Kurs or person, or all (of one Bereich). */
export type HistorySource =
  | { scope: SubjectKind; id: string }
  | { scope: "all"; bereich?: Bereich };

/** Ids of the Termine, Kurse and people that still exist. */
export type ExistingSubjects = Record<SubjectKind, ReadonlySet<string>>;

const SUBJECT_HREF: Record<SubjectKind, (id: string) => string> = {
  termin: (id) => hrefWith("/termine", { termin: id }),
  kurs: (id) => `/kurse/${id}`,
  person: (id) => hrefWith("/personen", { person: id }),
};

/** The Termin panel, Kurs page or Personen sheet of a subject. */
export function subjectHref(kind: SubjectKind, id: string): string {
  return SUBJECT_HREF[kind](id);
}

/** The filters on the Verlauf page, in chip order; see `bereicheOf`. */
export const BEREICHE = ["besetzung", "termine-kurse", "personen"] as const;

export type Bereich = (typeof BEREICHE)[number];

export const BEREICH_LABEL: Record<Bereich, string> = {
  besetzung: "Besetzung",
  "termine-kurse": "Termine & Kurse",
  personen: "Personen",
};

/** Each entry type's own Bereich. */
const BEREICH_OF: Record<AuditType, Bereich> = {
  "signup.created": "besetzung",
  "signup.removed": "besetzung",
  "signup.moved": "besetzung",
  "signup.role_changed": "besetzung",
  "signup.claimed": "besetzung",
  "signup.place_given": "besetzung",
  "place.ausgeschrieben": "besetzung",
  "place.aufruf": "besetzung",
  "termin.created": "termine-kurse",
  "termin.updated": "termine-kurse",
  "termin.deleted": "termine-kurse",
  "termin.festgeschrieben": "termine-kurse",
  "termin.aufgehoben": "termine-kurse",
  "kurs.created": "termine-kurse",
  "kurs.updated": "termine-kurse",
  "kurs.deleted": "termine-kurse",
  "person.registered": "personen",
  "person.updated": "personen",
  "person.qualification_changed": "personen",
  "person.koordination_changed": "personen",
  "person.removed": "personen",
};

/**
 * Removing a person takes them off each Termin they were on, so there that entry is also
 * Besetzung. A deleted Termin or Kurs needs no rule: it writes a `signup.role_changed` for
 * everyone it takes off.
 */
const ALSO_BESETZUNG_ON_TERMIN: ReadonlySet<AuditType> = new Set([
  "person.removed",
]);

/**
 * The Bereiche of an entry. A part of an action (its entries on one Termin, or those on
 * none) shows under the Bereiche of all its entries, so under Besetzung whenever it changed
 * someone's signup.
 */
export function bereicheOf(entry: {
  type: AuditType;
  terminId?: string | null;
}): Bereich[] {
  const bereich = BEREICH_OF[entry.type];
  return entry.terminId && ALSO_BESETZUNG_ON_TERMIN.has(entry.type)
    ? [bereich, "besetzung"]
    : [bereich];
}

/** The entry types of a Bereich (see `bereicheOf`), for entries on no Termin and on one. */
export function bereichTypes(bereich: Bereich): {
  withoutTermin: AuditType[];
  onTermin: AuditType[];
} {
  const types = (terminId: string | null) =>
    (Object.keys(BEREICH_OF) as AuditType[]).filter((type) =>
      bereicheOf({ type, terminId }).includes(bereich),
    );
  return { withoutTermin: types(null), onTermin: types("termin") };
}
