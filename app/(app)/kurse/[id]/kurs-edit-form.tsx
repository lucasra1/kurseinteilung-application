"use client";

import { useActionState, useState } from "react";
import { saveKurs } from "@/app/(app)/kurse/actions";
import { FormMessage } from "@/components/form-message";
import { KursFields, type KursValues } from "@/components/kurs-fields";
import { SubmitButton } from "@/components/submit-button";

export function KursEditForm({ kurs }: { kurs: KursValues & { id: string } }) {
  const [values, setValues] = useState<KursValues>(kurs);
  const [result, formAction] = useActionState(saveKurs, null);
  const staffingChanged =
    values.trainersNeeded !== kurs.trainersNeeded ||
    values.backupsNeeded !== kurs.backupsNeeded;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={kurs.id} />
      <KursFields values={values} onChange={setValues} />
      {staffingChanged && (
        <p className="text-[13px] text-muted-foreground">
          Wessen Rolle sich dadurch ändert, bekommt eine E-Mail.
        </p>
      )}
      <FormMessage result={result} />
      <SubmitButton className="self-start" pendingText="Wird gespeichert…">
        Speichern
      </SubmitButton>
    </form>
  );
}
