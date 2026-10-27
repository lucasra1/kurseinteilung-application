"use client";

import { type ReactNode, useActionState, useState } from "react";
import { confirmationOf, FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { ActionResult } from "@/lib/action-result";

/** "Trotzdem austragen" for "Austragen". */
function insist(label: string): string {
  return `Trotzdem ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/**
 * Asks for confirmation in an in-app dialog, then posts `fields` to `action`. If the action
 * answers with a Warndialog text (`confirm`), the dialog shows it instead of `description`
 * and "Trotzdem …" sends the fields again with `bestaetigt=1`; Abbrechen leaves it at that.
 */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
  warning,
  confirmLabel,
  action,
  fields,
  destructive = true,
  triggerSize = "default",
  triggerIcon,
  iconOnly = false,
  triggerClassName,
}: {
  triggerLabel: string;
  title: string;
  description: string;
  /**
   * A Warndialog text known before asking: shown instead of `description`, confirmed
   * right away with `bestaetigt=1`.
   */
  warning?: string;
  confirmLabel: string;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  destructive?: boolean;
  triggerSize?: "default" | "sm" | "xs";
  triggerIcon?: ReactNode;
  /** Shows only `triggerIcon`; `triggerLabel` becomes the accessible name. */
  iconOnly?: boolean;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [serverWarning, setServerWarning] = useState<string | null>(null);
  const [result, formAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const next = await action(prev, formData);
      if (next?.ok) setOpen(false);
      setServerWarning(confirmationOf(next));
      return next;
    },
    null,
  );
  const variant = destructive ? "destructive" : "outline";
  const shown = serverWarning ?? warning;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setServerWarning(null);
      }}
    >
      <AlertDialogTrigger
        render={
          <Button
            variant={iconOnly ? "ghost" : variant}
            size={iconOnly ? "icon" : triggerSize}
            aria-label={iconOnly ? triggerLabel : undefined}
            className={triggerClassName}
          />
        }
      >
        {triggerIcon}
        {!iconOnly && triggerLabel}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">
            {shown ?? description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <FormMessage result={result} />
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <form action={formAction}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            {shown && <input type="hidden" name="bestaetigt" value="1" />}
            <SubmitButton variant={variant} className="w-full">
              {shown ? insist(confirmLabel) : confirmLabel}
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
