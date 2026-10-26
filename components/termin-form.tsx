"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/action-result";
import { formatTime } from "@/lib/dates";

/** Create or edit a Termin; `fields` carries the hidden kursId (create) or id (edit). */
export function TerminForm({
  action,
  fields,
  termin,
  submitLabel,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  termin?: {
    date: string;
    startTime: string;
    endTime: string;
    topic: string;
    location: string | null;
  };
  submitLabel: string;
}) {
  const [result, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className="space-y-4">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="date">Datum</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={termin?.date}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="startTime">Beginn</Label>
          <Input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue={termin ? formatTime(termin.startTime) : undefined}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="endTime">Ende</Label>
          <Input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue={termin ? formatTime(termin.endTime) : undefined}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="topic">Thema</Label>
        <Input id="topic" name="topic" defaultValue={termin?.topic} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">Ort (optional)</Label>
        <Input
          id="location"
          name="location"
          defaultValue={termin?.location ?? ""}
        />
      </div>
      <FormMessage result={result} />
      <SubmitButton pendingText="Wird gespeichert…">{submitLabel}</SubmitButton>
    </form>
  );
}
