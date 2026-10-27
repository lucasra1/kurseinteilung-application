import { CalendarDays, Clock, MapPin, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { SignupCta, type SignupCtaProps } from "@/components/signup-cta";
import { Avatar, kursLabel } from "@/components/termin-bits";
import { TerminPanel } from "@/components/termin-panel";
import type { SignupView, TerminView } from "@/lib/dal/read-model";
import { formatLongDate, formatTimeRange } from "@/lib/dates";
import { nextRole, ROLE_LABEL, type Role } from "@/lib/staffing";
import { cn } from "@/lib/utils";

/** The Termin panel as trainers see it: who is in, what is free, one clear action. */
export function TrainerTerminPanel({
  termin,
  currentUserId,
  closeHref,
}: {
  termin: TerminView;
  currentUserId: string;
  closeHref: string;
}) {
  const mine = termin.signups.find((s) => s.profileId === currentUserId);
  const openRole =
    mine || termin.isPast ? null : nextRole(termin.signups.length, termin);
  const byRole = (role: Role) => termin.signups.filter((s) => s.role === role);
  const extra = byRole("ueberzaehlig");

  return (
    <TerminPanel
      closeHref={closeHref}
      eyebrow={kursLabel(termin)}
      title={termin.topic}
      footer={<SignupCta {...cta(termin, mine)} />}
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-2.5 text-[15px]">
          <MetaLine icon={CalendarDays}>{formatLongDate(termin.date)}</MetaLine>
          <MetaLine icon={Clock}>{formatTimeRange(termin)} Uhr</MetaLine>
          {termin.location && (
            <MetaLine icon={MapPin}>{termin.location}</MetaLine>
          )}
        </ul>
        {termin.kursDescription && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
            {termin.kursDescription}
          </p>
        )}
        <SlotSection
          title="Trainer"
          people={byRole("trainer")}
          total={termin.trainersNeeded}
          currentUserId={currentUserId}
          offerFree={openRole === "trainer"}
        />
        {(termin.backupsNeeded > 0 || byRole("backup").length > 0) && (
          <SlotSection
            title="Backup"
            people={byRole("backup")}
            total={termin.backupsNeeded}
            currentUserId={currentUserId}
            offerFree={openRole === "backup"}
          />
        )}
        {extra.length > 0 && (
          <SlotSection
            title="Überzählig"
            people={extra}
            total={extra.length}
            currentUserId={currentUserId}
            offerFree={false}
          />
        )}
      </div>
    </TerminPanel>
  );
}

function cta(termin: TerminView, mine: SignupView | undefined): SignupCtaProps {
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
    const hint =
      mine.role === "trainer"
        ? "Du bist als Trainer eingetragen."
        : mine.role === "backup"
          ? `Du bist Backup (Platz ${mine.rank - termin.trainersNeeded}) und rückst nach, wenn ein Trainer ausfällt.`
          : "Du stehst über der geplanten Besetzung (Überzählig).";
    return { terminId, mode: "austragen", hint };
  }
  if (termin.isPast) {
    return { terminId, mode: "disabled", label: "Termin ist vorbei" };
  }
  const role = nextRole(termin.signups.length, termin);
  if (!role) {
    return {
      terminId,
      mode: "disabled",
      label: "Ausgebucht",
      hint: "Alle Plätze sind vergeben.",
    };
  }
  const freeTrainers = termin.trainersNeeded - termin.trainerCount;
  const hint =
    role === "backup"
      ? "Alle Trainer-Plätze sind vergeben. Als Backup rückst du nach, wenn jemand ausfällt."
      : freeTrainers === 1
        ? "Du übernimmst den letzten freien Trainer-Platz."
        : `Noch ${freeTrainers} Trainer-Plätze frei.`;
  return {
    terminId,
    mode: "eintragen",
    label: `Als ${ROLE_LABEL[role]} eintragen`,
    hint,
  };
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

function SlotSection({
  title,
  people,
  total,
  currentUserId,
  offerFree,
}: {
  title: string;
  people: SignupView[];
  total: number;
  currentUserId: string;
  /** Highlights the first free place as the one this person would get. */
  offerFree: boolean;
}) {
  const free = Math.max(total - people.length, 0);
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <span className="text-[13px] text-muted-foreground">
          {people.length} von {total}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {people.map((person) => (
          <li key={person.profileId} className="flex items-center gap-3 py-1">
            <Avatar name={person.fullName} />
            <span className="text-[15px]">{person.fullName}</span>
            {person.profileId === currentUserId && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                Du
              </span>
            )}
          </li>
        ))}
        {Array.from({ length: free }, (_, i) => {
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
    </section>
  );
}
