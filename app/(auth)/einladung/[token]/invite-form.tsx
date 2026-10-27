"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register } from "./actions";

export function InviteForm({ token }: { token: string }) {
  const [result, formAction] = useActionState(register, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fullName" className="text-sm font-semibold">
          Vor- und Nachname
        </Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="z. B. Julia Steiner"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email" className="text-sm font-semibold">
          E-Mail
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="name@beispiel.at"
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
          autoComplete="tel"
          placeholder="+43 …"
          aria-describedby="phone-hint"
        />
        <span id="phone-hint" className="text-[13px] text-muted-foreground">
          Sehen nur Admins, falls kurzfristig etwas ist.
        </span>
      </div>
      <FormMessage result={result} />
      <SubmitButton size="lg" className="w-full" pendingText="Wird gesendet…">
        Login-Link schicken
      </SubmitButton>
    </form>
  );
}
