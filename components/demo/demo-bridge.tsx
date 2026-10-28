"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { switchPersona } from "@/app/demo/actions";
import {
  DEMO_FRAME_PREFIX,
  type DemoAction,
  type DemoTarget,
  type FromBridge,
  TO_BRIDGE,
  TO_TOUR,
  type ToBridge,
} from "@/lib/demo";
import { MAILBOX_EVENT } from "./demo-mailbox";

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function isFramed(): boolean {
  return window.self !== window.top;
}

/** Messages go to the tour: the Schaufenster around the frame, or this very window. */
function post(message: FromBridge): void {
  (isFramed() ? window.parent : window).postMessage(
    { demo: TO_TOUR, ...message },
    window.location.origin,
  );
}

function findNow(target: DemoTarget): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(target.css)) {
    if (target.text !== undefined && el.textContent?.trim() !== target.text) {
      continue;
    }
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

/** Waits for the element, since pages stream in; null if it doesn't show up. */
async function find(
  target: DemoTarget,
  timeoutMs: number,
): Promise<HTMLElement | null> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const el = findNow(target);
    if (el || Date.now() > end) return el;
    await sleep(100);
  }
}

function targetOf(action: DemoAction): DemoTarget | undefined {
  if ("click" in action) return action.click;
  if ("type" in action) return action.type;
  if ("fill" in action) return action.fill;
  return undefined;
}

/** Sets a controlled input's value so React's onChange sees it. */
function setValue(el: HTMLElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

type Cursor = { x: number; y: number; pressed: boolean };

/**
 * Runs inside every app window in the demo and does what the tour asks: navigate as a
 * person, highlight an element, click and type like a person would. Reports real clicks
 * back, so the tour can pause when someone takes over.
 */
export function DemoBridge({ personaId }: { personaId: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [spot, setSpot] = useState<DemoTarget | null>(null);
  const [cursor, setCursor] = useState<Cursor | null>(null);
  const personaRef = useRef(personaId);

  useEffect(() => {
    personaRef.current = personaId;
  }, [personaId]);

  // `?als=` switches the person, e.g. right after registering via the invite link.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    const als = params.get("als");
    if (!als) return;
    if (isFramed()) window.name = DEMO_FRAME_PREFIX + als;
    params.delete("als");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
    // Navigations keep the root layout; the demo bar there shows the person too.
    router.refresh();
  }, [pathname, searchParams, router]);

  useEffect(() => {
    function onUserInput(event: Event) {
      if (!event.isTrusted) return;
      const target = event.target as Element | null;
      if (target?.closest?.("[data-demo-ui]")) return;
      post({ kind: "interaction" });
    }
    window.addEventListener("pointerdown", onUserInput, true);
    window.addEventListener("keydown", onUserInput, true);
    return () => {
      window.removeEventListener("pointerdown", onUserInput, true);
      window.removeEventListener("keydown", onUserInput, true);
    };
  }, []);

  useEffect(() => {
    async function moveTo(el: HTMLElement): Promise<void> {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      await sleep(450);
      const rect = el.getBoundingClientRect();
      setCursor((current) => {
        const start = current ?? {
          x: window.innerWidth / 2,
          y: window.innerHeight - 40,
          pressed: false,
        };
        return { ...start, pressed: false };
      });
      await sleep(30);
      setCursor({
        x: rect.left + Math.min(rect.width / 2, 48),
        y: rect.top + rect.height / 2,
        pressed: false,
      });
      await sleep(550);
    }

    async function press(): Promise<void> {
      setCursor((c) => c && { ...c, pressed: true });
      await sleep(160);
      setCursor((c) => c && { ...c, pressed: false });
    }

    async function perform(action: DemoAction): Promise<void> {
      if ("wait" in action) return sleep(action.wait);
      if ("mailbox" in action) {
        window.dispatchEvent(
          new CustomEvent(MAILBOX_EVENT, { detail: { open: true } }),
        );
        return;
      }
      const target = targetOf(action);
      const el = target && (await find(target, 5000));
      if (!el) return;
      await moveTo(el);
      if ("click" in action) {
        await press();
        el.click();
        await sleep(350);
      } else if ("fill" in action) {
        await press();
        el.focus();
        setValue(el, action.value);
        await sleep(250);
      } else {
        await press();
        el.focus();
        setValue(el, "");
        for (let i = 1; i <= action.text.length; i++) {
          setValue(el, action.text.slice(0, i));
          await sleep(28);
        }
        await sleep(200);
      }
    }

    async function navigate(path: string, personaId: string | null) {
      window.dispatchEvent(
        new CustomEvent(MAILBOX_EVENT, { detail: { open: false } }),
      );
      let switched = false;
      if (personaId && isFramed()) {
        switched = window.name !== DEMO_FRAME_PREFIX + personaId;
        window.name = DEMO_FRAME_PREFIX + personaId;
      } else if (personaId && personaId !== personaRef.current) {
        switched = true;
        await switchPersona(personaId);
      }
      const here = () => window.location.pathname + window.location.search;
      if (here() !== path) router.push(path);
      // Navigations keep the root layout, where the demo bar shows the person.
      if (switched) router.refresh();
      const end = Date.now() + 8000;
      while (here() !== path && Date.now() < end) await sleep(100);
      await sleep(switched ? 1200 : 700);
    }

    async function onMessage(event: MessageEvent) {
      if (
        event.origin !== window.location.origin ||
        event.data?.demo !== TO_BRIDGE
      ) {
        return;
      }
      const message = event.data as ToBridge;
      if (message.kind === "refresh") {
        router.refresh();
      } else if (message.kind === "highlight") {
        setSpot(message.target);
      } else if (message.kind === "navigate") {
        await navigate(message.path, message.personaId);
        post({ kind: "done", id: message.id });
      } else if (message.kind === "run") {
        const first = message.actions.map(targetOf).find(Boolean);
        if (!first || (await find(first, 1500))) {
          for (const action of message.actions) await perform(action);
        }
        setCursor(null);
        post({ kind: "done", id: message.id });
      }
    }

    window.addEventListener("message", onMessage);
    post({ kind: "ready" });
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  return (
    <>
      {spot && <Spotlight target={spot} />}
      {cursor && (
        <span
          aria-hidden="true"
          className="pointer-events-none fixed z-[96] -mt-3 -ml-3 size-6 rounded-full border-2 border-white bg-primary/80 shadow-lg transition-[left,top,scale] duration-500 ease-out"
          style={{
            left: cursor.x,
            top: cursor.y,
            scale: cursor.pressed ? "0.7" : "1",
          }}
        />
      )}
    </>
  );
}

/** Dims the page around the element and follows it while it moves or scrolls. */
function Spotlight({ target }: { target: DemoTarget }) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    let frame = 0;
    let cancelled = false;
    let el: HTMLElement | null = null;
    (async () => {
      el = await find(target, 6000);
      if (cancelled || !el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      let last = "";
      const track = () => {
        if (el?.isConnected) {
          const next = el.getBoundingClientRect();
          const key = `${next.left},${next.top},${next.width},${next.height}`;
          if (key !== last) {
            last = key;
            setRect(next);
          }
        } else {
          el = findNow(target);
        }
        frame = requestAnimationFrame(track);
      };
      track();
    })();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [target]);

  if (!rect) return null;
  const pad = 6;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none fixed z-[80] animate-in rounded-2xl ring-4 ring-primary duration-300 fade-in"
      style={{
        left: rect.left - pad,
        top: rect.top - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: "0 0 0 9999px rgb(24 24 27 / 0.35)",
      }}
    />
  );
}
