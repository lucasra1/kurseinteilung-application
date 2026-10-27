import { CalendarCheck } from "lucide-react";

export function Logo() {
  return (
    <span className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-[10px] bg-primary text-primary-foreground"
      >
        <CalendarCheck className="size-[18px]" strokeWidth={2.2} />
      </span>
      Kurseinteilung
    </span>
  );
}
