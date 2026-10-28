"use client";

import { ChevronLeft, ChevronRight, Hand, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { useDemoTour } from "./use-demo-tour";

type Tour = ReturnType<typeof useDemoTour>;

const base =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40";
const quiet = "bg-white/10 text-white hover:bg-white/20";
const loud = "bg-primary text-white hover:bg-primary/90";

/** Zurück · Zeig's mir · Weiter, plus play/pause; for the dark tour surfaces. */
export function TourControls({
  tour,
  onFinish,
  finishLabel,
}: {
  tour: Tour;
  onFinish: () => void;
  finishLabel: string;
}) {
  const isLast = tour.index === tour.total - 1;
  const auto = tour.mode === "auto";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={auto ? tour.pause : tour.play}
        className={cn(base, quiet, "w-10 px-0")}
        aria-label={auto ? "Anhalten" : "Automatisch abspielen"}
        title={auto ? "Anhalten" : "Automatisch abspielen"}
      >
        {auto ? (
          <Pause aria-hidden="true" className="size-4" />
        ) : (
          <Play aria-hidden="true" className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={tour.back}
        disabled={tour.index === 0}
        className={cn(base, quiet, "w-10 px-0")}
        aria-label="Zurück"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      {tour.step.actions && !auto && (
        <button
          type="button"
          onClick={tour.showMe}
          disabled={tour.busy}
          className={cn(base, quiet)}
        >
          <Hand aria-hidden="true" className="size-4" />
          Zeig’s mir
        </button>
      )}
      {isLast ? (
        <button
          type="button"
          onClick={onFinish}
          className={cn(base, loud, "ml-auto")}
        >
          {finishLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={tour.next}
          disabled={tour.busy && !auto}
          className={cn(base, loud, "ml-auto")}
        >
          Weiter
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      )}
    </div>
  );
}

/** One dot per step; the current one is a bar. */
export function TourProgress({ tour }: { tour: Tour }) {
  return (
    <div
      role="progressbar"
      aria-label="Fortschritt"
      aria-valuemin={1}
      aria-valuemax={tour.total}
      aria-valuenow={tour.index + 1}
      className="flex items-center gap-1"
    >
      {Array.from({ length: tour.total }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per step
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === tour.index
              ? "w-5 bg-primary"
              : i < tour.index
                ? "w-1.5 bg-white/60"
                : "w-1.5 bg-white/20",
          )}
        />
      ))}
    </div>
  );
}
