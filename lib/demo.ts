// Demo mode (DEMO_MODE): names shared by the server, the proxy and the browser, and the
// messages between the tour and the app windows it drives. Kept small on purpose:
// instrumentation-client.ts ships it to every page.

/** Cookie holding the profile id the demo shows the app as. */
export const DEMO_COOKIE = "demo_persona";

/**
 * Request header that overrides the cookie. The Schaufenster frames send it on every
 * request (see instrumentation-client.ts), so the laptop and the phone can show two
 * different people side by side.
 */
export const DEMO_PERSONA_HEADER = "x-demo-persona";

/** `window.name` prefix of a Schaufenster frame; the rest is the profile id. */
export const DEMO_FRAME_PREFIX = "kurseinteilung-demo:";

/** The invite link always works with this token in the demo. */
export const DEMO_INVITE_TOKEN = "demo";

/** An element on the page: a CSS selector, optionally narrowed to an exact text. */
export type DemoTarget = { css: string; text?: string };

/** What the tour does in a window, the way a person would: click and type. */
export type DemoAction =
  | { click: DemoTarget }
  | { type: DemoTarget; text: string }
  | { fill: DemoTarget; value: string }
  | { wait: number }
  | { mailbox: true };

/** Tour → app window. */
export type ToBridge =
  | { kind: "navigate"; id: number; path: string; personaId: string | null }
  /** Skipped if the first element isn't there: then it was already done, e.g. by hand. */
  | { kind: "run"; id: number; actions: DemoAction[] }
  | { kind: "highlight"; target: DemoTarget | null }
  | { kind: "refresh" };

/** App window → tour. */
export type FromBridge =
  | { kind: "ready" }
  | { kind: "done"; id: number }
  /** A person clicked or typed in the window (not the tour). */
  | { kind: "interaction" }
  /** A Server Action ran: the other windows should refresh. */
  | { kind: "mutated" };

export const TO_BRIDGE = "kurseinteilung-demo:to-bridge";
export const TO_TOUR = "kurseinteilung-demo:to-tour";
