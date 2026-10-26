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
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input id="email" value={email} readOnly disabled />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fullName">Name</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Telefon (optional)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          defaultValue={phone ?? ""}
          autoComplete="tel"
        />
      </div>
      <FormMessage result={result} />
      <SubmitButton pendingText="Wird gespeichert…">Speichern</SubmitButton>
    </form>
  );
}
