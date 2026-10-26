"use client";

import { useActionState, useState } from "react";
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
}: {
  triggerLabel: string;
  title: string;
  description: string;
  confirmLabel: string;
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  fields: Record<string, string>;
  destructive?: boolean;
  triggerSize?: "default" | "sm" | "xs";
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
        render={<Button variant={variant} size={triggerSize} />}
      >
        {triggerLabel}
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
