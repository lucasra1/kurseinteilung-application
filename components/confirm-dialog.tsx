"use client";

import {
  type ComponentProps,
  type ReactNode,
  useActionState,
  useId,
  useState,
} from "react";
import { confirmationOf, FormMessage } from "@/components/form-message";
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
 * A confirmation's content: `text` under `title`, then Abbrechen and the button that submits
 * the form `formId`. After a Warndialog text (`warned`) it reads "Trotzdem …" and sends
 * `bestaetigt=1`.
 */
export function ConfirmContent({
  title,
  text,
  confirmLabel,
  warned,
  formId,
  pending,
  variant,
  children,
}: {
  title: string;
  text: string;
  confirmLabel: string;
  warned: boolean;
  formId: string;
  pending: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
  /** Between the text and the buttons. */
  children?: ReactNode;
}) {
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription className="whitespace-pre-line">
          {text}
        </AlertDialogDescription>
      </AlertDialogHeader>
      {children}
      <AlertDialogFooter>
        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
        <Button
          type="submit"
          form={formId}
          variant={variant}
          disabled={pending}
          name={warned ? "bestaetigt" : undefined}
          value={warned ? "1" : undefined}
        >
          {warned ? insist(confirmLabel) : confirmLabel}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
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
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [serverWarning, setServerWarning] = useState<string | null>(null);
  const [result, formAction, pending] = useActionState(
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
      <ConfirmContent
        title={title}
        text={shown ?? description}
        confirmLabel={confirmLabel}
        warned={Boolean(shown)}
        formId={formId}
        pending={pending}
        variant={variant}
      >
        <FormMessage result={result} />
        <form id={formId} action={formAction} hidden>
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
        </form>
      </ConfirmContent>
    </AlertDialog>
  );
}
