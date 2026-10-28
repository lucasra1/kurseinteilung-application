"use client";

import { useEffect, useRef, useState } from "react";
import { type FromBridge, TO_BRIDGE, TO_TOUR, type ToBridge } from "@/lib/demo";
import type { Device, TourStep } from "@/lib/demo-tour";

export type TourMode = "auto" | "manual";

/** Back to the start after this long without anyone touching it (automatic mode only). */
const IDLE_RESTART_MS = 90_000;

function post(target: Window | null, message: ToBridge): void {
  target?.postMessage({ demo: TO_BRIDGE, ...message }, window.location.origin);
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Long enough to read the step's text aloud, at least four seconds. */
function readingTime(step: TourStep): number {
  return Math.max(4000, (step.title.length + step.text.length) * 45);
}

/**
 * Plays the tour through the app windows that DemoBridge runs in. Automatic mode reads,
 * acts and moves on by itself; a click in an app window switches to manual mode, where
 * "Weiter" and "Zeig's mir" drive it. Started in automatic mode, it starts over by
 * itself when nobody has touched it for a while, like a demo phone in a shop.
 */
export function useDemoTour({
  steps,
  windowOf,
  restart,
}: {
  steps: TourStep[];
  /** The app window showing the device, or null if it isn't there (yet). */
  windowOf: (device: Device) => Window | null;
  /** Resets the demo data and brings the windows back to the start. */
  restart: () => Promise<void>;
}) {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<TourMode>("manual");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const run = useRef(0);
  const nextRequestId = useRef(1);
  const pending = useRef(new Map<number, () => void>());
  const startedAuto = useRef(false);
  const lastActivity = useRef(Date.now());
  const modeRef = useRef<TourMode>("manual");
  // The latest options and start(), for the long-running async flows and timers below.
  const latest = useRef({ steps, windowOf, restart, start });
  useEffect(() => {
    latest.current = { steps, windowOf, restart, start };
    modeRef.current = mode;
  });

  const devices: Device[] = ["desktop", "phone"];

  function send(device: Device, message: ToBridge): void {
    post(latest.current.windowOf(device), message);
  }

  /** Sends a request and waits for its "done" (or gives up after a while). */
  function request(
    device: Device,
    message:
      | Omit<Extract<ToBridge, { kind: "navigate" }>, "id">
      | Omit<Extract<ToBridge, { kind: "run" }>, "id">,
  ): Promise<void> {
    const id = nextRequestId.current++;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pending.current.delete(id);
        resolve();
      }, 60_000);
      pending.current.set(id, () => {
        clearTimeout(timeout);
        resolve();
      });
      send(device, { ...message, id } as ToBridge);
    });
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.demo !== TO_TOUR
      ) {
        return;
      }
      const source = (["desktop", "phone"] as const).find(
        (device) => latest.current.windowOf(device) === event.source,
      );
      if (!source) return;
      const message = event.data as FromBridge;
      if (message.kind === "done") {
        pending.current.get(message.id)?.();
        pending.current.delete(message.id);
      } else if (message.kind === "interaction") {
        lastActivity.current = Date.now();
        if (modeRef.current === "auto") {
          run.current++;
          setMode("manual");
          setBusy(false);
        }
      } else if (message.kind === "mutated") {
        for (const device of ["desktop", "phone"] as const) {
          if (device !== source) {
            post(latest.current.windowOf(device), { kind: "refresh" });
          }
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  async function enter(i: number, auto: boolean): Promise<void> {
    const token = ++run.current;
    const stale = () => token !== run.current;
    const step = latest.current.steps[i];
    setIndex(i);
    setBusy(true);
    for (const device of devices)
      send(device, { kind: "highlight", target: null });
    await request(step.device, {
      kind: "navigate",
      path: step.path,
      personaId: step.personaId,
    });
    if (stale()) return;
    if (step.highlight) {
      send(step.device, { kind: "highlight", target: step.highlight });
    }
    setBusy(false);
    if (!auto) return;

    await sleep(readingTime(step));
    if (stale()) return;
    if (step.actions) {
      setBusy(true);
      await request(step.device, { kind: "run", actions: step.actions });
      if (stale()) return;
      setBusy(false);
    }
    await sleep(2500);
    if (stale()) return;
    if (i + 1 < latest.current.steps.length) {
      void enter(i + 1, true);
    } else {
      await sleep(8000);
      if (!stale()) void start("auto");
    }
  }

  async function start(startMode: TourMode): Promise<void> {
    const token = ++run.current;
    startedAuto.current = startMode === "auto";
    lastActivity.current = Date.now();
    setRunning(true);
    setMode(startMode);
    setBusy(true);
    setIndex(0);
    for (const device of devices)
      send(device, { kind: "highlight", target: null });
    await latest.current.restart();
    if (token !== run.current) return;
    void enter(0, startMode === "auto");
  }

  // Shop-window mode: nobody there anymore, so start over.
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      if (
        startedAuto.current &&
        mode === "manual" &&
        Date.now() - lastActivity.current > IDLE_RESTART_MS
      ) {
        void latest.current.start("auto");
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [running, mode]);

  function touch(): void {
    lastActivity.current = Date.now();
  }

  return {
    index,
    step: steps[index],
    total: steps.length,
    mode,
    busy,
    running,
    start,
    /** Manual mode: does the step's actions, as a person would. */
    async showMe() {
      touch();
      const token = ++run.current;
      setMode("manual");
      const step = steps[index];
      if (!step.actions) return;
      setBusy(true);
      await request(step.device, {
        kind: "navigate",
        path: step.path,
        personaId: step.personaId,
      });
      if (token !== run.current) return;
      await request(step.device, { kind: "run", actions: step.actions });
      if (token === run.current) setBusy(false);
    },
    async next() {
      touch();
      const token = ++run.current;
      setMode("manual");
      const step = steps[index];
      if (step.required && step.actions) {
        setBusy(true);
        await request(step.device, {
          kind: "navigate",
          path: step.path,
          personaId: step.personaId,
        });
        if (token !== run.current) return;
        await request(step.device, { kind: "run", actions: step.actions });
        if (token !== run.current) return;
      }
      if (index + 1 < steps.length) void enter(index + 1, false);
      else setBusy(false);
    },
    back() {
      touch();
      setMode("manual");
      if (index > 0) void enter(index - 1, false);
    },
    play() {
      touch();
      setMode("auto");
      void enter(index, true);
    },
    pause() {
      touch();
      run.current++;
      setMode("manual");
      setBusy(false);
    },
    stop() {
      run.current++;
      startedAuto.current = false;
      setRunning(false);
      setBusy(false);
      for (const device of devices)
        send(device, { kind: "highlight", target: null });
    },
  };
}
