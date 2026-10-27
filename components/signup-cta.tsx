"use client";

import { useActionState } from "react";
import { changeSignup } from "@/app/(app)/termine/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import type { Kind } from "@/lib/staffing";

export type SignupOption = { kind: Kind; label: string; primary: boolean };

export type SignupCtaProps = { terminId: string; hint?: string } & (
  | { mode: "eintragen"; options: SignupOption[] }
  /** `warning`: what withdrawing triggers (`selfWithdrawWarning`), if the UI knows already. */
  | { mode: "austragen"; warning?: string }
  /** A backup of a role with an ausgeschriebenen place: take it, or still withdraw. */
  | { mode: "uebernehmen" }
  | { mode: "disabled"; label: string }
);

/** The main action at the bottom of the Termin panel. */
export function SignupCta(props: SignupCtaProps) {
  const [result, formAction] = useActionState(changeSignup, null);
  return (
    <div className="flex flex-col gap-2.5">
      {props.hint && (
        <p className="text-center text-[13px] leading-snug text-muted-foreground">
          {props.hint}
        </p>
      )}
      {props.mode === "eintragen" && (
        <form action={formAction} className="flex flex-col gap-2">
          <input type="hidden" name="terminId" value={props.terminId} />
          <input type="hidden" name="intent" value="eintragen" />
          {props.options.map((option) => (
            <SubmitButton
              key={option.kind}
              name="kind"
              value={option.kind}
              size="lg"
              variant={option.primary ? "default" : "outline"}
              className="w-full"
              pendingText="Wird eingetragen…"
            >
              {option.label}
            </SubmitButton>
          ))}
        </form>
      )}
      {props.mode === "uebernehmen" && (
        <form action={formAction}>
          <input type="hidden" name="terminId" value={props.terminId} />
          <input type="hidden" name="intent" value="uebernehmen" />
          <SubmitButton
            size="lg"
            className="w-full"
            pendingText="Wird übernommen…"
          >
            Platz übernehmen
          </SubmitButton>
        </form>
      )}
      {(props.mode === "austragen" || props.mode === "uebernehmen") && (
        <ConfirmDialog
          triggerLabel="Austragen"
          triggerSize="default"
          triggerClassName="w-full"
          destructive={false}
          title="Wirklich austragen?"
          description="Wer nach dir eingetragen ist, rückt nach. Die Praxisanleiterkoordinator:innen bekommen eine E-Mail."
          warning={props.mode === "austragen" ? props.warning : undefined}
          confirmLabel="Austragen"
          action={changeSignup}
          fields={{ terminId: props.terminId, intent: "abmelden" }}
        />
      )}
      {props.mode === "disabled" && (
        <Button size="lg" variant="secondary" className="w-full" disabled>
          {props.label}
        </Button>
      )}
      <FormMessage result={result} />
    </div>
  );
}
