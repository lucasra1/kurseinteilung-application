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
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">E-Mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <FormMessage result={result} />
      <SubmitButton className="w-full" pendingText="Wird gesendet…">
        Login-Link senden
      </SubmitButton>
    </form>
  );
}
