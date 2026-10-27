"use client";

import { Check, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { removeTermin, saveTermin } from "@/app/(app)/kurse/actions";
import { ConfirmContent, ConfirmDialog } from "@/components/confirm-dialog";
import { confirmationOf, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { StatusChip } from "@/components/termin-bits";
import { TerminFields, type TerminValues } from "@/components/termin-fields";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";
import type { Missing, Role } from "@/lib/staffing";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";

/** One existing Termin as an editable row; "Speichern" lights up once something changed. */
export function TerminRowForm({
  index,
  termin,
}: {
  index: number;
  termin: TerminValues & {
    id: string;
    isPast: boolean;
    missing: Missing;
    isStaffed: boolean;
    signups: { role: Role }[];
  };
}) {
  const saved: TerminValues = {
    date: termin.date,
    startTime: termin.startTime,
    endTime: termin.endTime,
    topic: termin.topic,
    location: termin.location,
    instruktorenNeeded: termin.instruktorenNeeded,
    praxisanleiterNeeded: termin.praxisanleiterNeeded,
  };
  const [values, setValues] = useState(saved);
  const [warning, setWarning] = useState({ text: "", open: false });
  const [result, formAction, pending] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const next = await saveTermin(prev, formData);
      const text = confirmationOf(next);
      // Keeps the last text while the dialog closes.
      setWarning((was) => ({ text: text ?? was.text, open: text !== null }));
      return next;
    },
    null,
  );
  const dirty = (Object.keys(saved) as (keyof TerminValues)[]).some(
    (key) => values[key] !== saved[key],
  );
  const rowLabel = `Tag ${index + 1}`;

  const formId = `termin-form-${termin.id}`;

  return (
    <li
      id={`termin-${termin.id}`}
      className={cn(
        "flex scroll-mt-24 flex-col gap-2.5 rounded-xl border p-3 target:border-brand-200 target:bg-brand-50 md:border-0 md:p-0 md:target:rounded-none md:target:ring-8 md:target:ring-brand-50",
        termin.isPast && "opacity-70",
      )}
    >
      <form id={formId} action={formAction} className="flex items-start gap-3">
        <input type="hidden" name="id" value={termin.id} />
        <span className="mt-1.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold md:mt-2">
          {index + 1}
        </span>
        <TerminFields
          idPrefix={`termin-${termin.id}`}
          rowLabel={rowLabel}
          values={values}
          onChange={setValues}
        />
        <SubmitButton
          variant={dirty ? "default" : "ghost"}
          size="icon"
          disabled={!dirty}
          aria-label={`${rowLabel} speichern`}
          className="hidden md:inline-flex"
        >
          <Check aria-hidden="true" />
        </SubmitButton>
      </form>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 md:pl-10">
        <StatusChip
          termin={{
            ...termin,
            instruktorenNeeded: Number(saved.instruktorenNeeded),
            praxisanleiterNeeded: Number(saved.praxisanleiterNeeded),
          }}
        />
        <Link
          href={hrefWith("/termine", { termin: termin.id })}
          className="text-[13px] font-medium text-zinc-700 underline-offset-4 hover:underline"
        >
          Besetzung ansehen
        </Link>
        {termin.isPast && (
          <span className="text-[13px] text-muted-foreground">vorbei</span>
        )}
        <FormMessage result={result} />
        <div className="ml-auto flex items-center gap-1">
          {dirty && (
            <Button type="submit" form={formId} size="sm" className="md:hidden">
              Speichern
            </Button>
          )}
          <ConfirmDialog
            iconOnly
            triggerLabel={`${rowLabel} löschen`}
            triggerIcon={<Trash2 aria-hidden="true" />}
            title={`${rowLabel} löschen?`}
            description={
              termin.signups.length > 0
                ? "Eingetragene Personen werden per E-Mail informiert."
                : "Für diesen Termin hat sich noch niemand eingetragen."
            }
            confirmLabel="Termin löschen"
            action={removeTermin}
            fields={{ id: termin.id }}
          />
        </div>
      </div>
      <AlertDialog
        open={warning.open}
        onOpenChange={(open) => setWarning((was) => ({ ...was, open }))}
      >
        {/* Sends the row's form again, now confirmed. */}
        <ConfirmContent
          title={`${rowLabel} speichern?`}
          text={warning.text}
          confirmLabel="Speichern"
          warned
          formId={formId}
          pending={pending}
        />
      </AlertDialog>
    </li>
  );
}
