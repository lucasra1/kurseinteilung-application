"use client";

import { useActionState } from "react";
import { saveKurs } from "@/app/(app)/admin/kurse/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function KursForm({
  kurs,
}: {
  kurs?: {
    id: string;
    title: string;
    description: string;
    trainersNeeded: number;
    backupsNeeded: number;
  };
}) {
  const [result, formAction] = useActionState(saveKurs, null);
  return (
    <form action={formAction} className="space-y-4">
      {kurs && <input type="hidden" name="id" value={kurs.id} />}
      <div className="space-y-2">
        <Label htmlFor="title">Titel</Label>
        <Input id="title" name="title" defaultValue={kurs?.title} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Beschreibung</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={kurs?.description}
          rows={3}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="trainersNeeded">Trainer pro Termin</Label>
          <Input
            id="trainersNeeded"
            name="trainersNeeded"
            type="number"
            min={1}
            defaultValue={kurs?.trainersNeeded ?? 3}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="backupsNeeded">Backups pro Termin</Label>
          <Input
            id="backupsNeeded"
            name="backupsNeeded"
            type="number"
            min={0}
            defaultValue={kurs?.backupsNeeded ?? 2}
            required
          />
        </div>
      </div>
      <FormMessage result={result} />
      <SubmitButton pendingText="Wird gespeichert…">
        {kurs ? "Speichern" : "Kurs anlegen"}
      </SubmitButton>
    </form>
  );
}
