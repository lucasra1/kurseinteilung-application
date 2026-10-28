"use client";

import { LayoutGrid, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { startDemoTour } from "@/components/demo/demo-tour-card";
import { TourControls, TourProgress } from "@/components/demo/tour-controls";
import { useDemoTour } from "@/components/demo/use-demo-tour";
import { todayInVienna } from "@/lib/dates";
import { TO_TOUR } from "@/lib/demo";
import { DEMO_IDS } from "@/lib/demo-data";
import { DEMO_START_WHO, type Device, demoTourSteps } from "@/lib/demo-tour";
import { cn } from "@/lib/utils";
import { resetDemoAction } from "../actions";

const SIZE = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 844 },
};
/** Browser bar above the laptop screen, bezel around the phone (unscaled px). */
const CHROME = { desktop: 34, phone: 14 };
const GAP = 40;
const LABEL = 36;
/** Below this width the two devices get too small: the in-app tour fits better. */
const MIN_WIDTH = 900;

const START_SRC: Record<Device, string> = {
  desktop: `/termine?als=${DEMO_IDS.anna}`,
  phone: `/termine?als=${DEMO_IDS.ben}`,
};

/**
 * The shop-window demo: the app on a laptop (Anna, Koordination) and a phone (whoever
 * the story is about) side by side, both live. The tour drives both; whatever happens
 * on one shows up on the other.
 */
export function Stage() {
  const searchParams = useSearchParams();
  const startMode =
    searchParams.get("modus") === "schritte" ? "manual" : "auto";
  const [steps] = useState(() => demoTourSteps(todayInVienna()));
  const frames = useRef<Record<Device, HTMLIFrameElement | null>>({
    desktop: null,
    phone: null,
  });
  const [generation, setGeneration] = useState(0);
  const ready = useRef(new Set<Device>());
  const readyWaiters = useRef<(() => void)[]>([]);
  const [who, setWho] = useState(DEMO_START_WHO);
  const stageRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(
    null,
  );

  const tour = useDemoTour({
    steps,
    windowOf: (device) => frames.current[device]?.contentWindow ?? null,
    restart: async () => {
      await resetDemoAction();
      // Fresh frames at the start, then wait until both apps are up.
      ready.current.clear();
      setWho(DEMO_START_WHO);
      setGeneration((g) => g + 1);
      await new Promise<void>((resolve) => {
        readyWaiters.current.push(resolve);
      });
    },
  });

  useEffect(() => {
    if (tour.running)
      setWho((w) => ({ ...w, [tour.step.device]: tour.step.who }));
  }, [tour.running, tour.step]);

  // Frames say "ready" once the app inside has started.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.demo !== TO_TOUR ||
        event.data.kind !== "ready"
      ) {
        return;
      }
      for (const device of ["desktop", "phone"] as const) {
        if (frames.current[device]?.contentWindow === event.source) {
          ready.current.add(device);
        }
      }
      if (ready.current.size === 2) {
        for (const resolve of readyWaiters.current.splice(0)) resolve();
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setBox({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { start } = tour;
  const tooSmall = box !== null && box.width < MIN_WIDTH - 48;
  useEffect(() => {
    if (box && !tooSmall && !tour.running) void start(startMode);
  }, [box, tooSmall, tour.running, start, startMode]);

  const scale = box && scaleFor(box);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950 text-white">
      <header className="flex h-14 shrink-0 items-center gap-4 px-6">
        <span className="text-[15px] font-semibold">Kurseinteilung</span>
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
          Demo
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => void tour.start(tour.mode)}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            Neu starten
          </button>
          <Link
            href="/demo"
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white"
          >
            <LayoutGrid aria-hidden="true" className="size-4" />
            Übersicht
          </Link>
        </div>
      </header>

      <div ref={stageRef} className="min-h-0 flex-1 px-6">
        {tooSmall ? (
          <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center gap-4 text-center">
            <p className="text-lg font-semibold">
              Für Laptop und Handy nebeneinander ist der Bildschirm zu klein.
            </p>
            <p className="text-[15px] text-zinc-400">
              Der Rundgang direkt in der App zeigt dieselbe Geschichte.
            </p>
            <button
              type="button"
              onClick={() => startDemoTour("manual")}
              className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold"
            >
              Rundgang starten
            </button>
          </div>
        ) : (
          scale &&
          generation > 0 && (
            <div className="flex h-full items-center justify-center gap-10">
              {(["desktop", "phone"] as const).map((device) => (
                <DeviceFrame
                  key={device}
                  device={device}
                  scale={scale[device]}
                  label={who[device]}
                  active={tour.running && tour.step.device === device}
                >
                  <iframe
                    key={generation}
                    ref={(el) => {
                      frames.current[device] = el;
                    }}
                    name={device}
                    src={START_SRC[device]}
                    title={device === "desktop" ? "Laptop" : "Handy"}
                    className="block border-0 bg-background"
                    style={SIZE[device]}
                  />
                </DeviceFrame>
              ))}
            </div>
          )
        )}
      </div>

      {tour.running && !tooSmall && (
        <footer
          aria-live="polite"
          className="mx-auto flex w-full max-w-4xl shrink-0 flex-col gap-3 px-6 pt-2 pb-6"
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">
              Schritt {tour.index + 1} von {tour.total}
              {tour.mode === "auto" && " · läuft von selbst"}
            </span>
            <TourProgress tour={tour} />
          </div>
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div className="min-w-0 flex-[1_1_28rem]">
              <h1 className="text-xl font-bold tracking-tight">
                {tour.step.title}
              </h1>
              {/* Room for three lines, so the devices don't jump between steps. */}
              <p className="mt-1 min-h-[4.6rem] text-[15px] leading-relaxed text-zinc-300">
                {tour.step.text}
              </p>
            </div>
            <div className="flex-[0_0_auto]">
              <TourControls
                tour={tour}
                onFinish={() => void tour.start("auto")}
                finishLabel="Nochmal abspielen"
              />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

/** Scales both devices to the same height budget and fits them side by side. */
function scaleFor(box: { width: number; height: number }) {
  const height = box.height - LABEL;
  const phoneH = SIZE.phone.height + CHROME.phone * 2;
  const phoneW = SIZE.phone.width + CHROME.phone * 2;
  const phone = Math.min(1, height / phoneH);
  const desktopH = SIZE.desktop.height + CHROME.desktop;
  const desktop = Math.min(
    1,
    height / desktopH,
    (box.width - phoneW * phone - GAP) / SIZE.desktop.width,
  );
  return { desktop, phone };
}

function DeviceFrame({
  device,
  scale,
  label,
  active,
  children,
}: {
  device: Device;
  scale: number;
  label: string;
  active: boolean;
  children: ReactNode;
}) {
  const { width, height } = SIZE[device];
  const outerW = device === "desktop" ? width : width + CHROME.phone * 2;
  const outerH =
    device === "desktop" ? height + CHROME.desktop : height + CHROME.phone * 2;

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: outerW * scale, height: outerH * scale }}>
        <div
          className={cn(
            "origin-top-left overflow-hidden shadow-2xl ring-2 transition-shadow duration-500",
            device === "desktop"
              ? "rounded-xl bg-zinc-800"
              : "rounded-[56px] bg-zinc-800 p-[14px]",
            active ? "ring-primary/70" : "ring-white/10",
          )}
          style={{ width: outerW, height: outerH, scale: String(scale) }}
        >
          {device === "desktop" && (
            <div
              aria-hidden="true"
              className="flex items-center gap-2 px-4"
              style={{ height: CHROME.desktop }}
            >
              <span className="size-3 rounded-full bg-zinc-600" />
              <span className="size-3 rounded-full bg-zinc-600" />
              <span className="size-3 rounded-full bg-zinc-600" />
              <span className="mx-auto h-5 w-80 rounded-md bg-zinc-700" />
            </div>
          )}
          <div
            className={cn(
              "overflow-hidden",
              device === "phone" && "rounded-[42px]",
            )}
          >
            {children}
          </div>
        </div>
      </div>
      <span
        className={cn(
          "flex h-6 items-center gap-2 text-sm transition-colors",
          active ? "font-semibold text-white" : "text-zinc-400",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full",
            active ? "bg-primary" : "bg-zinc-600",
          )}
        />
        {device === "desktop" ? "Laptop" : "Handy"} · {label}
      </span>
    </div>
  );
}
