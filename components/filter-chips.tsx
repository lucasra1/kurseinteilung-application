import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterChip = {
  label: string;
  href: string;
  active: boolean;
  count?: number;
  /** Red tint when active, for "where you are needed". */
  brand?: boolean;
};

export function FilterChips({ chips }: { chips: FilterChip[] }) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {chips.map((chip) => (
        <Link
          key={chip.href}
          href={chip.href}
          scroll={false}
          aria-current={chip.active ? "true" : undefined}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300",
            chip.active &&
              (chip.brand
                ? "border-brand-200 bg-brand-100 font-semibold text-brand-700 hover:border-brand-200"
                : "border-foreground bg-foreground font-semibold text-background hover:border-foreground"),
          )}
        >
          {chip.label}
          {chip.count !== undefined && (
            <span
              className={cn(
                "text-[13px]",
                chip.active ? "opacity-80" : "text-muted-foreground",
              )}
            >
              {chip.count}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}
