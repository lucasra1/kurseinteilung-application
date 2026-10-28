import { DEMO_FRAME_PREFIX, DEMO_PERSONA_HEADER, TO_TOUR } from "@/lib/demo";

// Demo Schaufenster (app/demo/schaufenster): the laptop and the phone are two frames of
// the same origin, so they share the demo cookie. Instead, each frame keeps its person in
// `window.name` and sends it as a header on every request the app makes. The first load
// carries it as `?als=`. The server ignores the header unless DEMO_MODE is set.
if (window.self !== window.top) {
  const als = new URLSearchParams(window.location.search).get("als");
  if (als) window.name = DEMO_FRAME_PREFIX + als;

  if (window.name.startsWith(DEMO_FRAME_PREFIX)) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      const personaId = window.name.slice(DEMO_FRAME_PREFIX.length);
      if (url.origin !== window.location.origin || !personaId) {
        return originalFetch(input, init);
      }
      const headers = new Headers(
        input instanceof Request ? input.headers : undefined,
      );
      new Headers(init?.headers).forEach((value, key) => {
        headers.set(key, value);
      });
      headers.set(DEMO_PERSONA_HEADER, personaId);
      const response = await originalFetch(input, { ...init, headers });
      // A Server Action changed something: the other frame should show it too.
      if (headers.has("next-action")) {
        window.parent.postMessage(
          { demo: TO_TOUR, kind: "mutated" },
          window.location.origin,
        );
      }
      return response;
    };
  }
}
