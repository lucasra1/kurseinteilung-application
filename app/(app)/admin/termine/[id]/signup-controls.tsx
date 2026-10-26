"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Label } from "@/components/ui/label";
import { addSignup, moveSignup } from "../actions";

export function MoveButtons({
  terminId,
  profileId,
  isFirst,
  isLast,
}: {
  terminId: string;
  profileId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [result, formAction] = useActionState(moveSignup, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="terminId" value={terminId} />
      <input type="hidden" name="profileId" value={profileId} />
      <div className="inline-flex gap-1">
        <SubmitButton
          name="direction"
          value="up"
          variant="outline"
          size="xs"
          disabled={isFirst}
          aria-label="Nach oben"
        >
          ↑
        </SubmitButton>
        <SubmitButton
          name="direction"
          value="down"
          variant="outline"
          size="xs"
          disabled={isLast}
          aria-label="Nach unten"
        >
          ↓
        </SubmitButton>
      </div>
      {result && !result.ok && <FormMessage result={result} />}
    </form>
  );
}

export function AddPersonForm({
  terminId,
  people,
  isFull,
}: {
  terminId: string;
  people: { id: string; fullName: string }[];
  isFull: boolean;
}) {
  const [result, formAction] = useActionState(addSignup, null);
  if (isFull) {
    return (
      <p className="text-sm text-muted-foreground">
        Ausgebucht – erhöhe zuerst die Besetzung im Kurs.
      </p>
    );
  }
  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="terminId" value={terminId} />
      <Label htmlFor="profileId">Person hinzufügen</Label>
      <div className="flex flex-wrap gap-2">
        <select
          id="profileId"
          name="profileId"
          defaultValue=""
          className="h-8 min-w-48 rounded-lg border border-input bg-transparent px-2 text-sm"
        >
          <option value="" disabled>
            Person auswählen…
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName}
            </option>
          ))}
        </select>
        <SubmitButton pendingText="Wird eingetragen…">Eintragen</SubmitButton>
      </div>
      <FormMessage result={result} />
    </form>
  );
}
