"use client";

import { useActionState } from "react";
import { changeSignup } from "@/app/(app)/termine/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export type SignupState = "eintragen" | "abmelden" | "ausgebucht";

export function SignupButton({
  terminId,
  state,
}: {
  terminId: string;
  state: SignupState;
}) {
  const [result, formAction] = useActionState(changeSignup, null);
  return (
    <form action={formAction} className="flex flex-col items-start gap-2">
      <input type="hidden" name="terminId" value={terminId} />
      <input
        type="hidden"
        name="intent"
        value={state === "abmelden" ? "abmelden" : "eintragen"}
      />
      {state === "abmelden" ? (
        <SubmitButton variant="outline" pendingText="Wird ausgetragen…">
          Abmelden
        </SubmitButton>
      ) : (
        <SubmitButton
          disabled={state === "ausgebucht"}
          pendingText="Wird eingetragen…"
        >
          {state === "ausgebucht" ? "Ausgebucht" : "Eintragen"}
        </SubmitButton>
      )}
      <FormMessage result={result} />
    </form>
  );
}
