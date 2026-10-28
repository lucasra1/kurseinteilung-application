"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, useState } from "react";
import { resetDemoAction } from "@/app/demo/actions";
import { todayInVienna } from "@/lib/dates";
import { demoTourSteps } from "@/lib/demo-tour";
import { TourControls, TourProgress } from "./tour-controls";
import { type TourMode, useDemoTour } from "./use-demo-tour";

/** `window` event that starts the tour in this window (detail.mode), e.g. from the bar. */
export const TOUR_START_EVENT = "kurseinteilung-demo:tour";

export function startDemoTour(mode: TourMode): void {
  window.dispatchEvent(new CustomEvent(TOUR_START_EVENT, { detail: { mode } }));
}

/**
 * The tour on small screens: plays in this very window and switches the person as it
 * goes. A card on top (phones) or bottom left (larger screens) tells the story.
 */
export function DemoTourCard() {
  const [steps] = useState(() => demoTourSteps(todayInVienna()));
  const [collapsed, setCollapsed] = useState(false);
  const tour = useDemoTour({
    steps,
    windowOf: () => window,
    restart: resetDemoAction,
  });
  const { start } = tour;

  useEffect(() => {
    function onStart(event: Event) {
      void start((event as CustomEvent<{ mode: TourMode }>).detail.mode);
    }
    window.addEventListener(TOUR_START_EVENT, onStart);
    return () => window.removeEventListener(TOUR_START_EVENT, onStart);
  }, [start]);

  if (!tour.running) return null;

  return (
    <section
      data-demo-ui
      aria-label="Rundgang"
      className="fixed inset-x-3 top-3 z-[90] flex flex-col gap-2.5 rounded-2xl bg-zinc-900 p-4 text-white shadow-2xl ring-1 ring-white/10 md:inset-x-auto md:top-auto md:bottom-6 md:left-6 md:w-[26rem]"
    >
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-zinc-400">
          Schritt {tour.index + 1} von {tour.total}
        </span>
        <TourProgress tour={tour} />
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Text anzeigen" : "Text ausblenden"}
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10 md:hidden"
          >
            {collapsed ? (
              <ChevronDown aria-hidden="true" className="size-4" />
            ) : (
              <ChevronUp aria-hidden="true" className="size-4" />
            )}
          </button>
          <button
            type="button"
            onClick={tour.stop}
            aria-label="Rundgang beenden"
            className="flex size-8 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/10"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>
      <div aria-live="polite">
        <h2 className="text-[17px] leading-snug font-semibold">
          {tour.step.title}
        </h2>
        {!collapsed && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">
            {tour.step.text}
          </p>
        )}
      </div>
      <TourControls tour={tour} onFinish={tour.stop} finishLabel="Fertig" />
    </section>
  );
}
