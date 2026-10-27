"use client";

import { Search } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSignup } from "@/app/(app)/termine/actions";
import { FormMessage } from "@/components/form-message";
import { Avatar } from "@/components/termin-bits";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import type { Kind } from "@/lib/staffing";
import { cn } from "@/lib/utils";

type Person = { id: string; fullName: string; upcomingSignups: number };

export type AddPersonOption = {
  kind: Kind;
  label: string;
  /** Where the person ends up, e.g. "als Instruktor auf Platz 3". */
  placement: string;
  /** Qualified for this role and not signed up yet. */
  people: Person[];
};

/** Admin: pick the role (if the Termin needs both), find a qualified person, sign them up. */
export function AddPersonSearch({
  terminId,
  options,
}: {
  terminId: string;
  options: AddPersonOption[];
}) {
  const [kind, setKind] = useState(options[0].kind);
  const [query, setQuery] = useState("");
  const [result, formAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const next = await addSignup(prev, formData);
      if (next?.ok) setQuery("");
      return next;
    },
    null,
  );
  const option = options.find((o) => o.kind === kind) ?? options[0];
  const needle = query.trim().toLocaleLowerCase("de");
  const matches = needle
    ? option.people
        .filter((p) => p.fullName.toLocaleLowerCase("de").includes(needle))
        .slice(0, 6)
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="terminId" value={terminId} />
      <input type="hidden" name="kind" value={option.kind} />
      <span id="add-person-label" className="text-sm font-semibold">
        Person hinzufügen
      </span>
      {options.length > 1 && (
        <fieldset className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
          <legend className="sr-only">Als</legend>
          {options.map((o) => (
            <label
              key={o.kind}
              className={cn(
                "flex h-9 cursor-pointer items-center justify-center rounded-lg text-sm font-medium text-zinc-700 has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
                o.kind === option.kind &&
                  "bg-card font-semibold text-foreground shadow-xs",
              )}
            >
              <input
                type="radio"
                name="add-person-kind"
                value={o.kind}
                checked={o.kind === option.kind}
                onChange={() => setKind(o.kind)}
                className="sr-only"
              />
              {o.label}
            </label>
          ))}
        </fieldset>
      )}
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter would add the first match without the admin choosing it.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={`${option.label} suchen`}
          autoComplete="off"
          aria-labelledby="add-person-label"
          aria-describedby="add-person-hint"
          className="pl-10"
        />
      </div>
      {needle &&
        (matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Niemand mit dieser Qualifikation gefunden.
          </p>
        ) : (
          <ul
            aria-label="Suchergebnisse"
            className="divide-y overflow-hidden rounded-xl border"
          >
            {matches.map((person) => (
              <li key={person.id}>
                <PersonOption person={person} />
              </li>
            ))}
          </ul>
        ))}
      <p id="add-person-hint" className="text-[13px] text-muted-foreground">
        Kommt {option.placement} und wird per E-Mail informiert.
      </p>
      <FormMessage result={result} />
    </form>
  );
}

function PersonOption({ person }: { person: Person }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="profileId"
      value={person.id}
      disabled={pending}
      className="flex min-h-12 w-full items-center gap-3 px-3 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:bg-muted disabled:opacity-50"
    >
      <Avatar name={person.fullName} className="size-8 text-[11px]" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{person.fullName}</span>
        <span className="text-xs text-muted-foreground">
          {person.upcomingSignups === 0
            ? "Noch keine Termine"
            : person.upcomingSignups === 1
              ? "1 kommender Termin"
              : `${person.upcomingSignups} kommende Termine`}
        </span>
      </span>
      <span className="text-sm font-semibold text-primary">Eintragen</span>
    </button>
  );
}
