"use client";

import { Plus } from "lucide-react";
import { useActionState, useState } from "react";
import { addTermin } from "@/app/(app)/kurse/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { TerminFields, type TerminValues } from "@/components/termin-fields";
import { Button } from "@/components/ui/button";

/** "Weiterer Tag": a prefilled row (next day, same time, place and staffing) to add one more Termin. */
export function AddTerminRow({
  kursId,
  dayNumber,
  prefill,
}: {
  kursId: string;
  dayNumber: number;
  prefill: TerminValues;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(prefill);
  const [result, formAction] = useActionState(addTermin, null);

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        <Button
          type="button"
          variant="outline"
          className="border-dashed"
          onClick={() => setOpen(true)}
        >
          <Plus aria-hidden="true" />
          Weiterer Tag
        </Button>
        <span className="text-[13px] text-muted-foreground">
          Übernimmt Uhrzeit, Ort und Besetzung, Datum einen Tag später.
        </span>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-dashed border-zinc-300 p-3"
    >
      <input type="hidden" name="kursId" value={kursId} />
      <div className="flex items-start gap-3">
        <span className="mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 md:mt-2">
          {dayNumber}
        </span>
        <TerminFields
          idPrefix="neuer-termin"
          rowLabel={`Tag ${dayNumber}`}
          values={values}
          onChange={setValues}
        />
      </div>
      <FormMessage result={result} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Abbrechen
        </Button>
        <SubmitButton pendingText="Wird angelegt…">
          Termin hinzufügen
        </SubmitButton>
      </div>
    </form>
  );
}
