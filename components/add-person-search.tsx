"use client";

import { Search } from "lucide-react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { addSignup } from "@/app/(app)/termine/actions";
import { FormMessage } from "@/components/form-message";
import { Avatar } from "@/components/termin-bits";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";

type Person = { id: string; fullName: string; upcomingSignups: number };

/** Admin: find a person by name and sign them up for the Termin. */
export function AddPersonSearch({
  terminId,
  people,
  placement,
}: {
  terminId: string;
  people: Person[];
  /** Where the person ends up, e.g. "als Trainer auf Platz 3". */
  placement: string;
}) {
  const [query, setQuery] = useState("");
  const [result, formAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const next = await addSignup(prev, formData);
      if (next?.ok) setQuery("");
      return next;
    },
    null,
  );
  const needle = query.trim().toLocaleLowerCase("de");
  const matches = needle
    ? people
        .filter((p) => p.fullName.toLocaleLowerCase("de").includes(needle))
        .slice(0, 6)
    : [];

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="terminId" value={terminId} />
      <Label htmlFor="add-person" className="text-sm font-semibold">
        Person hinzufügen
      </Label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id="add-person"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            // Enter would add the first match without the admin choosing it.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder="Name suchen"
          autoComplete="off"
          aria-describedby="add-person-hint"
          className="pl-10"
        />
      </div>
      {needle &&
        (matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niemand gefunden.</p>
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
        Kommt {placement} und wird per E-Mail informiert.
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
