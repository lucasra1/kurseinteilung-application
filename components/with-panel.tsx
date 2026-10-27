import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** List on the left, the Termin panel (when open) in a column on the right from `lg` on. */
export function WithPanel({
  panel,
  children,
}: {
  panel: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-6",
        panel && "lg:grid-cols-[minmax(0,1fr)_25rem]",
      )}
    >
      <div className="min-w-0">{children}</div>
      {panel}
    </div>
  );
}
