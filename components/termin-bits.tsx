import { Lock } from "lucide-react";
import { formatLongDate, formatWeekday } from "@/lib/dates";
import {
  isBackup,
  KIND_LABEL,
  KINDS,
  type Missing,
  type Needed,
  needed,
  ROLE_LABEL,
  type Role,
  staffingLabel,
} from "@/lib/staffing";
import { cn } from "@/lib/utils";

type Counts = Needed & {
  missing: Missing;
  isStaffed: boolean;
  signups: { role: Role }[];
};

/** "Erste Hilfe Grundkurs · Tag 1 von 2" */
export function kursLabel(t: {
  kursTitle: string;
  dayIndex: number;
  dayCount: number;
}): string {
  return t.dayCount > 1
    ? `${t.kursTitle} · Tag ${t.dayIndex} von ${t.dayCount}`
    : t.kursTitle;
}

/** "Anna Maria Huber" → "AH" */
export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (words[0][0] + last).toUpperCase();
}

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      title={name}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-foreground",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Weekday and day of month as a block; the month comes from the list heading. */
export function DateBlock({ date }: { date: string }) {
  return (
    <div className="flex w-12 shrink-0 flex-col items-center self-start rounded-xl bg-muted py-1.5">
      <span className="sr-only">{formatLongDate(date)}</span>
      <span
        aria-hidden="true"
        className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase"
      >
        {formatWeekday(date)}
      </span>
      <span aria-hidden="true" className="text-xl leading-tight font-bold">
        {date.slice(8, 10)}
      </span>
    </div>
  );
}

export function StatusChip({
  termin,
  className,
}: {
  termin: Counts;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full px-2.5 py-0.5 text-xs leading-tight font-semibold",
        termin.isStaffed
          ? "bg-green-100 text-green-800"
          : "bg-brand-100 text-brand-700",
        className,
      )}
    >
      {staffingLabel(termin.missing)}
    </span>
  );
}

/**
 * Lock with "Festgeschrieben" on an upcoming festgeschriebener Termin, nothing otherwise
 * (every past Termin is festgeschrieben, so the lock would say nothing there).
 */
export function FestgeschriebenChip({
  termin,
  className,
}: {
  termin: { festgeschrieben: boolean; isPast: boolean };
  className?: string;
}) {
  if (!termin.festgeschrieben || termin.isPast) return null;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full border border-zinc-300 px-2 text-xs font-semibold whitespace-nowrap text-zinc-700",
        className,
      )}
    >
      <Lock aria-hidden="true" className="size-3.5" />
      Festgeschrieben
    </span>
  );
}

/** The current person's own role, e.g. "Du: Instruktor". */
export function RoleChip({
  role,
  prefix = "Du: ",
  className,
}: {
  role: Role;
  prefix?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold whitespace-nowrap",
        isBackup(role)
          ? "border border-zinc-300 text-zinc-700"
          : "bg-foreground text-background",
        className,
      )}
    >
      {prefix}
      {ROLE_LABEL[role]}
    </span>
  );
}

/** Taken and free fixed places per needed role as dots, plus the number of backups. */
export function SlotDots({ termin }: { termin: Counts }) {
  const backups = termin.signups.filter((s) => isBackup(s.role)).length;
  return (
    <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
      {KINDS.filter((kind) => needed(termin, kind) > 0).map((kind) => (
        <Dots
          key={kind}
          label={KIND_LABEL[kind].many}
          filled={needed(termin, kind) - termin.missing[kind]}
          total={needed(termin, kind)}
        />
      ))}
      {backups > 0 && (
        <span>
          + {backups} {backups === 1 ? "Backup" : "Backups"}
        </span>
      )}
    </span>
  );
}

function Dots({
  label,
  filled,
  total,
}: {
  label: string;
  filled: number;
  total: number;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className="mr-0.5">{label}</span>
      <span className="sr-only">
        {filled} von {total}
      </span>
      {Array.from({ length: total }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per place
          key={i}
          aria-hidden="true"
          className={cn(
            "size-2.5 rounded-full",
            i < filled ? "bg-foreground" : "border-[1.5px] border-zinc-400",
          )}
        />
      ))}
    </span>
  );
}

/** Avatars for taken places and dashed circles for free ones (admin list). */
export function AvatarSlots({
  label,
  people,
  total,
}: {
  label: string;
  people: { profileId: string; fullName: string }[];
  total: number;
}) {
  const free = Math.max(total - people.length, 0);
  return (
    <span className="flex gap-1">
      <span className="sr-only">
        {label}:{" "}
        {people.length > 0
          ? people.map((p) => p.fullName).join(", ")
          : "niemand"}
        {free > 0 && `, ${free} frei`}
      </span>
      {people.map((person) => (
        <Avatar
          key={person.profileId}
          name={person.fullName}
          className="size-7 text-[11px]"
        />
      ))}
      {Array.from({ length: free }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one circle per free place
          key={i}
          aria-hidden="true"
          className="size-7 rounded-full border-[1.5px] border-dashed border-zinc-400"
        />
      ))}
    </span>
  );
}
