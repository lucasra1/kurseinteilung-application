// German text for the Warndialog before an action that triggers an Ausschreibung or an
// Aufruf (spec 3). Pure.
import type { TerminSnapshot } from "@/lib/audit";
import { qualifiedCount, terminText } from "@/lib/audit-text";
import {
  isBackup,
  KIND_LABEL,
  type Kind,
  placesLabel,
  type Role,
} from "@/lib/staffing";

type WarnedTermin = Pick<
  TerminSnapshot,
  "kursTitle" | "topic" | "date" | "startTime"
> & { id: string };

/** What an action would trigger for one role; `qualified` is unknown in the UI. */
export type Warning = { termin: WarnedTermin; kind: Kind; places: number } & (
  | { type: "backups"; backups: number }
  | { type: "aufruf"; qualified?: number }
);

/** "wird 1 Instruktor-Platz ausgeschrieben. 2 Backups bekommen eine E-Mail." */
function roleText(warning: Warning): string {
  const { places, kind } = warning;
  const label = placesLabel(places, kind);
  if (warning.type === "backups") {
    const { backups } = warning;
    return `${places === 1 ? "wird" : "werden"} ${label} ausgeschrieben. ${backups === 1 ? "1 Backup bekommt" : `${backups} Backups bekommen`} eine E-Mail.`;
  }
  const missing = `${places === 1 ? "fehlt" : "fehlen"} ${label}.`;
  const { qualified } = warning;
  if (qualified === undefined) {
    return `${missing} Es gibt kein Backup: Die übrigen Qualifizierten bekommen eine E-Mail.`;
  }
  if (qualified === 0) {
    return `${missing} Es gibt kein Backup und sonst niemanden mit der Qualifikation.`;
  }
  return `${missing} Es gibt kein Backup: ${qualifiedCount(qualified)} ${qualified === 1 ? "bekommt" : "bekommen"} eine E-Mail.`;
}

/** The Warndialog text: one line per Termin, in date order. */
export function warningText(warnings: Warning[]): string {
  const byTermin = new Map<string, Warning[]>();
  for (const warning of warnings) {
    byTermin.set(warning.termin.id, [
      ...(byTermin.get(warning.termin.id) ?? []),
      warning,
    ]);
  }
  const at = ({ termin }: Warning) => `${termin.date} ${termin.startTime}`;
  return [...byTermin.values()]
    .sort((a, b) => at(a[0]).localeCompare(at(b[0])))
    .map((roles) => {
      const sentences = roles.map(
        (warning, i) =>
          `${i === 0 ? "Dadurch" : "Außerdem"} ${roleText(warning)}`,
      );
      return `Der Termin ${terminText(roles[0].termin)} ist festgeschrieben. ${sentences.join(" ")}`;
    })
    .join("\n");
}

/** "Ein Instruktor-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn." */
export function placesFreedText(kind: Kind, places: number): string {
  return places === 1
    ? `Ein ${KIND_LABEL[kind].one}-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn.`
    : `${placesLabel(places, kind)} sind frei geworden. Wer zuerst übernimmt, bekommt einen davon.`;
}

type ViewedTermin = WarnedTermin & {
  festgeschrieben: boolean;
  isPast: boolean;
  signups: { profileId: string; kind: Kind; role: Role }[];
};

/** The Warndialog text for withdrawing from the viewer's fixed place, if it triggers anything. */
export function selfWithdrawWarning(
  termin: ViewedTermin,
  viewerId: string,
): string | undefined {
  const mine = termin.signups.find((s) => s.profileId === viewerId);
  if (
    !mine ||
    isBackup(mine.role) ||
    !termin.festgeschrieben ||
    termin.isPast
  ) {
    return undefined;
  }
  const backups = termin.signups.filter(
    (s) => s.role === `backup-${mine.kind}`,
  ).length;
  return warningText([
    backups > 0
      ? { termin, kind: mine.kind, type: "backups", places: 1, backups }
      : { termin, kind: mine.kind, type: "aufruf", places: 1 },
  ]);
}
