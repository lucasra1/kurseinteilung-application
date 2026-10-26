"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { toggleAdmin } from "./actions";

export function AdminToggle({
  profileId,
  isAdmin,
  isEnvAdmin,
}: {
  profileId: string;
  isAdmin: boolean;
  isEnvAdmin: boolean;
}) {
  const [result, formAction] = useActionState(toggleAdmin, null);
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      <input type="hidden" name="profileId" value={profileId} />
      <input type="hidden" name="isAdmin" value={isAdmin ? "false" : "true"} />
      <SubmitButton
        variant="outline"
        size="xs"
        disabled={isEnvAdmin}
        title={isEnvAdmin ? "fix eingetragen" : undefined}
      >
        {isAdmin ? "Admin entfernen" : "Zum Admin machen"}
      </SubmitButton>
      {result && !result.ok && <FormMessage result={result} />}
    </form>
  );
}
