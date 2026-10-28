"use client";

import { LayoutGrid, Map as MapIcon, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { resetDemoAction, switchPersona } from "@/app/demo/actions";
import { DEMO_PERSONAS } from "@/lib/demo-data";
import { DemoMailbox, type DemoMailView } from "./demo-mailbox";
import { startDemoTour } from "./demo-tour-card";

type Person = { id: string; fullName: string };

const barButton =
  "flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-zinc-100 hover:bg-white/10 disabled:opacity-50";

/**
 * The strip above the app in the demo: whom you see the app as, their mailbox, the tour
 * and a reset. In a Schaufenster frame only the mailbox, since the tour picks the person.
 */
export function DemoBar({
  framed,
  persona,
  people,
  mails,
}: {
  framed: boolean;
  persona: Person | null;
  people: Person[];
  mails: DemoMailView[];
}) {
  const [pending, startTransition] = useTransition();
  const personaIds = new Set<string>(DEMO_PERSONAS.map((p) => p.id));
  const others = people.filter((p) => !personaIds.has(p.id));
  const nameOf = (id: string) =>
    people.find((p) => p.id === id)?.fullName ?? "";

  if (framed) {
    return (
      <div
        data-demo-ui
        className="flex h-9 items-center gap-2 bg-zinc-900 px-3 text-white"
      >
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
          Demo
        </span>
        <span className="truncate text-[13px] text-zinc-300">
          {persona?.fullName ?? "Nicht angemeldet"}
        </span>
        <div className="ml-auto">
          <DemoMailbox
            personaId={persona?.id ?? null}
            mails={mails}
            tone="dark"
          />
        </div>
      </div>
    );
  }

  return (
    <div data-demo-ui className="bg-zinc-900 text-white">
      <div className="mx-auto flex min-h-11 w-full max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-1.5">
        <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase">
          Demo
        </span>
        <label
          htmlFor="demo-persona"
          className="hidden text-[13px] text-zinc-400 sm:inline"
        >
          Ansehen als
        </label>
        <select
          id="demo-persona"
          value={persona?.id ?? ""}
          disabled={pending}
          onChange={(event) => {
            const id = event.target.value;
            startTransition(() => switchPersona(id));
          }}
          className="h-8 max-w-[13rem] rounded-lg border border-white/15 bg-zinc-800 px-2 text-[13px] font-medium text-white"
        >
          {!persona && <option value="">Niemand angemeldet</option>}
          <optgroup label="Im Rundgang">
            {DEMO_PERSONAS.map((p) => (
              <option key={p.id} value={p.id}>
                {nameOf(p.id)} · {p.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Weitere Personen">
            {others.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </optgroup>
        </select>
        <div className="ml-auto flex items-center">
          <DemoMailbox
            personaId={persona?.id ?? null}
            mails={mails}
            tone="dark"
          />
          <button
            type="button"
            onClick={() => startDemoTour("manual")}
            className={barButton}
          >
            <MapIcon aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Rundgang</span>
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => resetDemoAction())}
            className={barButton}
            title="Alle Daten auf den Anfang zurücksetzen"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
            <span className="hidden sm:inline">Zurücksetzen</span>
          </button>
          <Link href="/demo" className={barButton} title="Demo-Übersicht">
            <LayoutGrid aria-hidden="true" className="size-4" />
            <span className="sr-only">Demo-Übersicht</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
