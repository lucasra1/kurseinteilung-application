"use client";

import { Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormMessage } from "@/components/form-message";
import { Avatar } from "@/components/termin-bits";
import { Input } from "@/components/ui/input";
import { KIND_LABEL, KINDS, type Kind } from "@/lib/staffing";
import { cn } from "@/lib/utils";
import { COORDINATOR } from "@/lib/wording";
import { deletePerson, toggleAdmin, toggleQualification } from "./actions";

type Person = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  isEnvAdmin: boolean;
  isInstruktor: boolean;
  isPraxisanleiter: boolean;
  upcomingSignups: number;
};

const COLUMNS =
  "md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_8.5rem_14rem_5rem_4.5rem_2.75rem]";

export function PeopleList({
  people,
  currentUserId,
}: {
  people: Person[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const needle = query.trim().toLocaleLowerCase("de");
  const visible = needle
    ? people.filter((p) =>
        `${p.fullName} ${p.email}`.toLocaleLowerCase("de").includes(needle),
      )
    : people;

  return (
    <section
      aria-label="Personenliste"
      className="overflow-hidden rounded-2xl border bg-card"
    >
      <div className="border-b p-4">
        <div className="relative max-w-sm">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            aria-label="Personen suchen"
            placeholder="Name oder E-Mail suchen"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      <div
        aria-hidden="true"
        className={cn(
          "hidden items-end gap-4 border-b px-4 py-2.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase md:grid",
          COLUMNS,
        )}
      >
        <span>Name</span>
        <span>E-Mail</span>
        <span>Telefon</span>
        <span>Qualifikation</span>
        <span>Termine</span>
        {/* Spans the empty action column too; the soft hyphen lets it wrap. */}
        <span className="col-span-2">Praxisanleiter&shy;koordinator:in</span>
      </div>
      {visible.length === 0 && (
        <p className="p-4 text-sm text-muted-foreground">Niemand gefunden.</p>
      )}
      <ul>
        {visible.map((person) => (
          <li
            key={person.id}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b px-4 py-3 last:border-b-0 md:py-2",
              COLUMNS,
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <Link
                href={`/personen?person=${person.id}`}
                scroll={false}
                className="flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <Avatar name={person.fullName} className="size-8 text-[11px]" />
                <span className="truncate text-sm font-medium">
                  {person.fullName}
                  <span className="sr-only">: Verlauf anzeigen</span>
                </span>
              </Link>
              {person.id === currentUserId && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                  Du
                </span>
              )}
            </span>
            <span className="col-start-1 truncate pl-[2.625rem] text-sm text-zinc-700 md:col-start-auto md:pl-0">
              <a href={`mailto:${person.email}`} className="hover:underline">
                {person.email}
              </a>
            </span>
            <span className="col-start-1 pl-[2.625rem] text-sm text-zinc-700 md:col-start-auto md:pl-0">
              {person.phone ? (
                <a href={`tel:${person.phone}`} className="hover:underline">
                  {person.phone}
                </a>
              ) : (
                <span className="hidden text-muted-foreground md:inline">
                  –
                </span>
              )}
            </span>
            <span className="col-start-1 flex flex-wrap gap-1.5 pl-[2.625rem] md:col-start-auto md:pl-0">
              {KINDS.map((kind) => (
                <QualificationToggle key={kind} person={person} kind={kind} />
              ))}
            </span>
            <span className="col-start-1 pl-[2.625rem] text-sm text-zinc-700 md:col-start-auto md:pl-0">
              {person.upcomingSignups === 0 ? "keine" : person.upcomingSignups}
              <span className="md:sr-only"> kommende Termine</span>
            </span>
            <span className="col-start-2 row-span-2 row-start-1 flex items-center md:col-start-auto md:row-span-1 md:row-start-auto">
              <AdminSwitch person={person} />
            </span>
            <span className="col-start-2 row-span-2 flex justify-end md:col-start-auto md:row-span-1">
              {person.id !== currentUserId && !person.isEnvAdmin && (
                <ConfirmDialog
                  iconOnly
                  triggerLabel={`${person.fullName} entfernen`}
                  triggerIcon={<Trash2 aria-hidden="true" />}
                  title={`${person.fullName} entfernen?`}
                  description="Die Person und alle ihre Eintragungen werden gelöscht. Wer dahinter steht, rückt nach und bekommt eine E-Mail."
                  confirmLabel="Entfernen"
                  action={deletePerson}
                  fields={{ profileId: person.id }}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function QualificationToggle({ person, kind }: { person: Person; kind: Kind }) {
  const [result, formAction] = useActionState(toggleQualification, null);
  const on =
    kind === "instruktor" ? person.isInstruktor : person.isPraxisanleiter;
  return (
    <form action={formAction}>
      <input type="hidden" name="profileId" value={person.id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="value" value={on ? "false" : "true"} />
      <QualificationButton
        on={on}
        label={KIND_LABEL[kind].one}
        name={person.fullName}
      />
      {result && !result.ok && <FormMessage result={result} />}
    </form>
  );
}

function QualificationButton({
  on,
  label,
  name,
}: {
  on: boolean;
  label: string;
  name: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      aria-pressed={on}
      aria-label={`${label}: ${name}`}
      disabled={pending}
      className={cn(
        "flex h-9 items-center rounded-full border px-3 text-xs font-semibold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        on
          ? "border-foreground bg-foreground text-background"
          : "border-dashed border-zinc-300 text-muted-foreground hover:border-zinc-400 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function AdminSwitch({ person }: { person: Person }) {
  const [result, formAction] = useActionState(toggleAdmin, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="profileId" value={person.id} />
      <input
        type="hidden"
        name="isAdmin"
        value={person.isAdmin ? "false" : "true"}
      />
      <SwitchButton person={person} />
      {result && !result.ok && <FormMessage result={result} />}
    </form>
  );
}

function SwitchButton({ person }: { person: Person }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      role="switch"
      aria-checked={person.isAdmin}
      aria-label={`${COORDINATOR.one}: ${person.fullName}`}
      title={
        person.isEnvAdmin ? `Fix als ${COORDINATOR.one} eingetragen` : undefined
      }
      disabled={pending || person.isEnvAdmin}
      className="group flex h-11 w-11 items-center outline-none disabled:opacity-50"
    >
      <span
        className={cn(
          "relative block h-6 w-10 rounded-full transition-colors group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
          person.isAdmin ? "bg-primary" : "bg-zinc-300",
        )}
      >
        <span
          className={cn(
            "absolute top-[3px] size-[18px] rounded-full bg-white shadow-sm transition-[left]",
            person.isAdmin ? "left-[19px]" : "left-[3px]",
          )}
        />
      </span>
    </button>
  );
}
