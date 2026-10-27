import { Clock } from "lucide-react";
import Link from "next/link";
import {
  DateBlock,
  FestgeschriebenChip,
  kursLabel,
  RoleChip,
  SlotDots,
  StatusChip,
} from "@/components/termin-bits";
import type { TerminView } from "@/lib/dal/read-model";
import { formatTimeRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

/** One Termin in the timeline; opens the Termin panel. */
export function TerminListItem({
  termin,
  href,
  currentUserId,
  selected,
}: {
  termin: TerminView;
  href: string;
  currentUserId: string;
  selected: boolean;
}) {
  const mine = termin.signups.find((s) => s.profileId === currentUserId);
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors outline-none hover:border-zinc-300 focus-visible:ring-3 focus-visible:ring-ring/50",
        selected && "border-brand-200 bg-brand-50 hover:border-brand-200",
      )}
    >
      <DateBlock date={termin.date} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {kursLabel(termin)}
        </span>
        <span className="text-[15px] leading-snug font-semibold">
          {termin.topic}
        </span>
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <Clock aria-hidden="true" className="size-3.5 shrink-0" />
          {formatTimeRange(termin)}
          {termin.location && ` · ${termin.location}`}
        </span>
        <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <SlotDots termin={termin} />
          <FestgeschriebenChip termin={termin} />
          {mine ? (
            <RoleChip role={mine.role} className="ml-auto" />
          ) : (
            <StatusChip termin={termin} className="ml-auto" />
          )}
        </div>
      </div>
    </Link>
  );
}
