import { CalendarDays, Clock, Lock, MapPin, Plus } from "lucide-react";
import type { ReactNode } from "react";
import {
  SignupCta,
  type SignupCtaProps,
  type SignupOption,
} from "@/components/signup-cta";
import { Avatar, kursLabel } from "@/components/termin-bits";
import { TerminPanel } from "@/components/termin-panel";
import type { SignupView, TerminView } from "@/lib/dal/read-model";
import { formatLongDate, formatTimeRange } from "@/lib/dates";
import {
  ausgeschrieben,
  canClaimPlace,
  fixedPlaces,
  hasQualification,
  isBackup,
  KIND_LABEL,
  KINDS,
  type Kind,
  kindOf,
  needed,
  nextRole,
  placesLabel,
  type Qualifications,
  ROLE_LABEL,
} from "@/lib/staffing";
import { cn } from "@/lib/utils";
import { selfWithdrawWarning } from "@/lib/warning-text";

type Viewer = Qualifications & { id: string };

/** The Termin panel as trainers see it: who is in, what is free, one clear action per role. */
export function TrainerTerminPanel({
  termin,
  viewer,
  closeHref,
}: {
  termin: TerminView;
  viewer: Viewer;
  closeHref: string;
}) {
  const mine = termin.signups.find((s) => s.profileId === viewer.id);
  const options = mine || termin.isPast ? [] : signupOptions(termin, viewer);

  return (
    <TerminPanel
      closeHref={closeHref}
      eyebrow={kursLabel(termin)}
      title={termin.topic}
      footer={<SignupCta {...cta(termin, viewer, mine, options)} />}
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2.5 text-[15px]">
          <MetaLine icon={CalendarDays}>{formatLongDate(termin.date)}</MetaLine>
          <MetaLine icon={Clock}>{formatTimeRange(termin)} Uhr</MetaLine>
          {termin.location && (
            <MetaLine icon={MapPin}>{termin.location}</MetaLine>
          )}
          {termin.festgeschrieben && !termin.isPast && (
            <MetaLine icon={Lock}>Festgeschrieben</MetaLine>
          )}
        </ul>
        {termin.kursDescription && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {termin.kursDescription}
          </p>
        )}
        {KINDS.filter((kind) => needed(termin, kind) > 0).map((kind) => (
          <KindSection
            key={kind}
            kind={kind}
            termin={termin}
            viewerId={viewer.id}
            offerFree={options.some((o) => o.kind === kind && o.primary)}
          />
        ))}
      </div>
    </TerminPanel>
  );
}

/** One option per role the Termin needs and the viewer is qualified for; free fixed places first. */
function signupOptions(termin: TerminView, viewer: Viewer): SignupOption[] {
  const kinds = KINDS.filter(
    (kind) => needed(termin, kind) > 0 && hasQualification(viewer, kind),
  );
  return kinds
    .map((kind) => {
      const fixed = !isBackup(nextRole(termin.signups, termin, kind));
      const label = fixed
        ? `Als ${KIND_LABEL[kind].one} eintragen`
        : kinds.length > 1
          ? `Als Backup (${KIND_LABEL[kind].one}) eintragen`
          : "Als Backup eintragen";
      return { kind, label, primary: fixed };
    })
    .sort((a, b) => Number(b.primary) - Number(a.primary))
    .map((option, index) => ({ ...option, primary: index === 0 }));
}

function cta(
  termin: TerminView,
  viewer: Viewer,
  mine: SignupView | undefined,
  options: SignupOption[],
): SignupCtaProps {
  const terminId = termin.id;
  if (mine && termin.isPast) {
    return {
      terminId,
      mode: "disabled",
      label: "Termin ist vorbei",
      hint: `Du warst als ${ROLE_LABEL[mine.role]} eingetragen.`,
    };
  }
  if (mine) {
    const held = ausgeschrieben(termin, mine.kind);
    if (canClaimPlace(termin, mine.profileId)) {
      return {
        terminId,
        mode: "uebernehmen",
        hint:
          held === 1
            ? `Ein ${KIND_LABEL[mine.kind].one}-Platz ist frei geworden. Wer zuerst übernimmt, bekommt ihn.`
            : `${placesLabel(held, mine.kind)} sind frei geworden. Wer zuerst übernimmt, bekommt einen davon.`,
      };
    }
    const many = KIND_LABEL[mine.kind].many;
    if (isBackup(mine.role)) {
      const hint = `Du bist Backup ${mine.rank - fixedPlaces(termin, mine.kind)} bei den ${many} und rückst nach, wenn jemand ausfällt.`;
      return { terminId, mode: "austragen", hint };
    }
    // Only a fixed place on a festgeschriebenen Termin triggers an Ausschreibung.
    const warning = selfWithdrawWarning(termin, viewer.id);
    const hint = `Du bist als ${KIND_LABEL[mine.kind].one} eingetragen.${warning ? " Der Termin ist festgeschrieben. Wenn du dich austrägst, wird dein Platz ausgeschrieben." : ""}`;
    return { terminId, mode: "austragen", hint, warning };
  }
  if (termin.isPast) {
    return { terminId, mode: "disabled", label: "Termin ist vorbei" };
  }
  if (options.length === 0) {
    const wanted = KINDS.filter((kind) => needed(termin, kind) > 0)
      .map((kind) => KIND_LABEL[kind].many)
      .join(" und ");
    return {
      terminId,
      mode: "disabled",
      label: `Nur für ${wanted}`,
      hint:
        hasQualification(viewer, "instruktor") ||
        hasQualification(viewer, "praxisanleiter")
          ? "Dafür fehlt dir die passende Qualifikation."
          : "Bei dir ist noch keine Qualifikation eingetragen. Melde dich bei einer Praxisanleiterkoordinator:in.",
    };
  }
  return {
    terminId,
    mode: "eintragen",
    options,
    hint: optionHint(termin, options),
  };
}

function optionHint(termin: TerminView, options: SignupOption[]): string {
  if (options.length > 1) {
    return "Du hast beide Qualifikationen. Wähl, als was du dich einträgst.";
  }
  const { kind, primary } = options[0];
  const { one, many } = KIND_LABEL[kind];
  if (!primary) {
    return `Alle ${many}-Plätze sind vergeben. Als Backup rückst du nach, wenn jemand ausfällt.`;
  }
  const free = termin.missing[kind];
  return free === 1
    ? `Du übernimmst den letzten freien ${one}-Platz.`
    : `Noch ${free} ${many}-Plätze frei.`;
}

function MetaLine({
  icon: Icon,
  children,
}: {
  icon: typeof Clock;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <Icon aria-hidden="true" className="size-4.5 shrink-0 text-zinc-500" />
      {children}
    </li>
  );
}

function KindSection({
  kind,
  termin,
  viewerId,
  offerFree,
}: {
  kind: Kind;
  termin: TerminView;
  viewerId: string;
  /** Highlights the first free place as the one this person would get. */
  offerFree: boolean;
}) {
  const fixed = termin.signups.filter((s) => s.role === kind);
  const backups = termin.signups.filter(
    (s) => isBackup(s.role) && kindOf(s.role) === kind,
  );
  const total = needed(termin, kind);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold">{KIND_LABEL[kind].many}</h3>
        <span className="text-[13px] text-muted-foreground">
          {fixed.length} von {total}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {fixed.map((person) => (
          <PersonRow
            key={person.profileId}
            person={person}
            viewerId={viewerId}
          />
        ))}
        {Array.from({ length: termin.missing[kind] }, (_, i) => {
          const offered = offerFree && i === 0;
          return (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: one row per free place
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-xl border-[1.5px] border-dashed py-1.5 pr-2.5 pl-1.5",
                offered ? "border-brand-200 bg-brand-50" : "border-zinc-300",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-9 items-center justify-center rounded-full border-[1.5px] border-dashed",
                  offered
                    ? "border-brand-200 text-brand-700"
                    : "border-zinc-400",
                )}
              >
                {offered && <Plus className="size-4" />}
              </span>
              <span
                className={cn(
                  "text-[15px]",
                  offered
                    ? "font-medium text-brand-700"
                    : "text-muted-foreground",
                )}
              >
                {offered ? "Frei: dein Platz" : "Frei"}
              </span>
            </li>
          );
        })}
      </ul>
      {backups.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-muted/70 px-3 py-2">
          <span className="text-[13px] font-medium text-muted-foreground">
            Backups, in dieser Reihenfolge
          </span>
          <ol className="flex flex-col gap-1">
            {backups.map((person) => (
              <PersonRow
                key={person.profileId}
                person={person}
                viewerId={viewerId}
                small
              />
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

function PersonRow({
  person,
  viewerId,
  small = false,
}: {
  person: SignupView;
  viewerId: string;
  small?: boolean;
}) {
  return (
    <li className={cn("flex items-center gap-3", small ? "py-0.5" : "py-1")}>
      <Avatar
        name={person.fullName}
        className={small ? "size-7 text-[11px]" : undefined}
      />
      <span className={small ? "text-sm" : "text-[15px]"}>
        {person.fullName}
      </span>
      {person.profileId === viewerId && (
        <span className="rounded-full bg-card px-2 py-0.5 text-xs font-semibold ring-1 ring-border">
          Du
        </span>
      )}
    </li>
  );
}
