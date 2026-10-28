"use client";

import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { DemoBar } from "./demo-bar";
import { DemoBridge } from "./demo-bridge";
import type { DemoMailView } from "./demo-mailbox";
import { DemoTourCard } from "./demo-tour-card";

type Person = { id: string; fullName: string };

const noSubscription = () => () => {};

/** Everything the demo adds to the app window; the /demo pages bring their own. */
export function DemoClient({
  framed: framedOnServer,
  persona,
  people,
  mails,
}: {
  framed: boolean;
  persona: Person | null;
  people: Person[];
  mails: DemoMailView[];
}) {
  const pathname = usePathname();
  // The server only guesses from the request; the browser knows.
  const framed = useSyncExternalStore(
    noSubscription,
    () => window.self !== window.top,
    () => framedOnServer,
  );
  return (
    <>
      <DemoBridge personaId={persona?.id ?? null} />
      {!framed && <DemoTourCard />}
      {!pathname.startsWith("/demo") && (
        <DemoBar
          framed={framed}
          persona={persona}
          people={people}
          mails={mails}
        />
      )}
    </>
  );
}
