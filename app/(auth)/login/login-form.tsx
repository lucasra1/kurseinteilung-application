"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestLoginLink } from "./actions";

export function LoginForm() {
  const [result, formAction] = useActionState(requestLoginLink, null);
  return (
    <form action={formAction} className="flex flex-col gap-4">
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
      <FormMessage result={result} />
      <SubmitButton size="lg" className="w-full" pendingText="Wird gesendet…">
        Login-Link schicken
      </SubmitButton>
    </form>
  );
}
