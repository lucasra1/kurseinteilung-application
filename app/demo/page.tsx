import { Monitor, MousePointerClick, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/logo";
import { DEMO_PEOPLE, DEMO_PERSONAS } from "@/lib/demo-data";
import { env } from "@/lib/env";
import { enterAs } from "./actions";
import { ResetButton, StartTourButton } from "./hub-buttons";

export const metadata: Metadata = { title: "Demo · Kurseinteilung" };

const PERSONA_TEXT: Record<(typeof DEMO_PERSONAS)[number]["key"], string> = {
  anna: "Legt Kurse an, sieht alle Lücken, trägt Leute ein und lädt neue ein.",
  ben: "Sucht sich am Handy Termine aus und trägt sich ein oder aus.",
  clara: "Kann beides und steht bei einem Termin als Backup bereit.",
};

export default function DemoPage() {
  if (!env.DEMO_MODE) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 md:py-14">
      <div className="flex flex-col gap-4">
        <Logo />
        <div className="flex flex-col gap-2">
          <h1 className="text-[32px] leading-tight font-bold tracking-tight md:text-[40px]">
            Kurseinteilung ausprobieren
          </h1>
          <p className="max-w-2xl text-[17px] leading-relaxed text-muted-foreground">
            Instruktoren und Praxisanleiter tragen sich selbst für Kurstermine
            ein, die Koordination sieht auf einen Blick, wo noch jemand fehlt.
            Das hier ist die echte App mit erfundenen Personen und Kursen. Nur
            der Login ist abgekürzt, und E-Mails landen in einem Demo-Postfach.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-4 rounded-3xl bg-zinc-900 p-6 text-white">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary">
            <Monitor aria-hidden="true" className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold">Schaufenster</h2>
            <p className="text-[15px] leading-relaxed text-zinc-300">
              Laptop und Handy nebeneinander: Die Koordination und die
              Instruktoren in derselben Geschichte, in drei Minuten. Läuft von
              selbst. Sobald du in ein Gerät klickst, übernimmst du.
            </p>
            <p className="text-[13px] text-zinc-400">
              Am besten auf einem großen Bildschirm.
            </p>
          </div>
          <div className="mt-auto flex flex-wrap gap-2">
            <a
              href="/demo/schaufenster"
              className="inline-flex h-11 items-center rounded-xl bg-primary px-4 text-[15px] font-semibold hover:bg-primary/90"
            >
              Abspielen
            </a>
            <a
              href="/demo/schaufenster?modus=schritte"
              className="inline-flex h-11 items-center rounded-xl bg-white/10 px-4 text-[15px] font-semibold hover:bg-white/20"
            >
              Schritt für Schritt
            </a>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-3xl border bg-card p-6">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Smartphone aria-hidden="true" className="size-6" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold">Rundgang in der App</h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Dieselbe Geschichte direkt in der App, Schritt für Schritt und in
              deinem Tempo. Passt auch aufs Handy.
            </p>
          </div>
          <div className="mt-auto">
            <StartTourButton />
          </div>
        </section>
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <MousePointerClick
            aria-hidden="true"
            className="size-5 text-muted-foreground"
          />
          <h2 className="text-xl font-bold">Selbst ausprobieren als …</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {DEMO_PERSONAS.map((persona) => {
            const person = DEMO_PEOPLE.find((p) => p.id === persona.id);
            return (
              <form key={persona.id} action={enterAs}>
                <input type="hidden" name="profileId" value={persona.id} />
                <button
                  type="submit"
                  className="flex h-full w-full flex-col gap-1 rounded-2xl border bg-card p-5 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50"
                >
                  <span className="text-[17px] font-semibold">
                    {person?.fullName}
                  </span>
                  <span className="text-sm font-medium text-primary">
                    {persona.label}
                  </span>
                  <span className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {PERSONA_TEXT[persona.key]}
                  </span>
                </button>
              </form>
            );
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          Oben in der App wechselst du jederzeit die Person. Alles, was du
          änderst, lässt sich zurücksetzen.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3 border-t pt-6">
        <ResetButton />
        <p className="text-[13px] text-muted-foreground">
          Die Demo startet außerdem jede Nacht neu.
        </p>
      </div>
    </main>
  );
}
