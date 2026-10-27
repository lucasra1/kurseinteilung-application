"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { useActionState } from "react";
import { moveSignup } from "@/app/(app)/termine/actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

/** Moves a person one place up or down in the signup order of a Termin. */
export function MoveButtons({
  terminId,
  profileId,
  fullName,
  isFirst,
  isLast,
}: {
  terminId: string;
  profileId: string;
  fullName: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [result, formAction] = useActionState(moveSignup, null);
  return (
    <form action={formAction} className="flex shrink-0 flex-col items-end">
      <input type="hidden" name="terminId" value={terminId} />
      <input type="hidden" name="profileId" value={profileId} />
      <div className="flex">
        <SubmitButton
          name="direction"
          value="up"
          variant="ghost"
          size="icon"
          disabled={isFirst}
          aria-label={`${fullName} nach oben`}
        >
          <ArrowUp aria-hidden="true" />
        </SubmitButton>
        <SubmitButton
          name="direction"
          value="down"
          variant="ghost"
          size="icon"
          disabled={isLast}
          aria-label={`${fullName} nach unten`}
        >
          <ArrowDown aria-hidden="true" />
        </SubmitButton>
      </div>
      {result && !result.ok && <FormMessage result={result} />}
    </form>
  );
}
