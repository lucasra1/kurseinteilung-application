"use client";

import { type ReactNode, useActionState, useState } from "react";
import { FormMessage } from "@/components/form-message";
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

/** Asks for confirmation in an in-app dialog, then posts `fields` to `action`. */
export function ConfirmDialog({
  triggerLabel,
  title,
  description,
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
  const [result, formAction] = useActionState(
    async (prev: ActionResult, formData: FormData) => {
      const next = await action(prev, formData);
      if (next?.ok) setOpen(false);
      return next;
    },
    null,
  );
  const variant = destructive ? "destructive" : "outline";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <FormMessage result={result} />
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <form action={formAction}>
            {Object.entries(fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <SubmitButton variant={variant} className="w-full">
              {confirmLabel}
            </SubmitButton>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
