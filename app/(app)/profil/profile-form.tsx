"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveProfile } from "./actions";

export function ProfileForm({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string | null;
}) {
  const [result, formAction] = useActionState(saveProfile, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName" className="text-sm font-semibold">
          Vor- und Nachname
        </Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone" className="text-sm font-semibold">
          Telefon{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          autoComplete="tel"
          aria-describedby="phone-hint"
        />
        <span id="phone-hint" className="text-[13px] text-muted-foreground">
          Sehen nur Praxisanleiterkoordinator:innen, falls kurzfristig etwas
          ist.
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-sm font-semibold">
          E-Mail
        </Label>
        <Input id="email" value={email} readOnly disabled />
      </div>
      <FormMessage result={result} />
      <SubmitButton className="self-start" pendingText="Wird gespeichert…">
        Speichern
      </SubmitButton>
    </form>
  );
}
