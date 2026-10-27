"use client";

import { Lock, LockOpen } from "lucide-react";
import {
  type ReactNode,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { changeFestschreibung } from "./actions";

/**
 * The selection mode of the coordinator timeline: wraps the list, whose rows carry
 * checkboxes named `terminId`, and adds "Alle auswählen" plus a bar at the bottom to
 * festschreiben or aufheben what is selected. `total` is the number of checkboxes, i.e. the
 * upcoming Termine in the current filter. Render it with a key per filter, so a new filter
 * starts with an empty selection.
 */
export function FestschreibungForm({
  total,
  children,
}: {
  total: number;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const allRef = useRef<HTMLInputElement>(null);
  const [count, setCount] = useState(0);
  const [result, formAction] = useActionState(changeFestschreibung, null);

  const boxes = () => [
    ...(formRef.current?.querySelectorAll<HTMLInputElement>(
      'input[name="terminId"]',
    ) ?? []),
  ];
  const recount = () => setCount(boxes().filter((box) => box.checked).length);

  useEffect(() => {
    if (allRef.current) {
      allRef.current.indeterminate = count > 0 && count < total;
    }
  }, [count, total]);

  return (
    <form
      ref={formRef}
      action={formAction}
      onChange={recount}
      // React resets the form after the action; the checkboxes are then all cleared.
      onReset={() => setCount(0)}
      className="flex flex-col gap-3"
    >
      <label className="flex min-h-11 items-center gap-3 self-start rounded-xl border bg-card px-4 text-sm font-medium has-disabled:opacity-50">
        <input
          ref={allRef}
          type="checkbox"
          checked={total > 0 && count === total}
          disabled={total === 0}
          onChange={(event) => {
            for (const box of boxes()) box.checked = event.target.checked;
            recount();
          }}
          className="size-5 accent-foreground"
        />
        Alle auswählen
        <span className="text-muted-foreground">({total})</span>
      </label>

      {children}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 md:bottom-4">
        <div className="flex flex-col gap-2 rounded-2xl border bg-card p-3 shadow-lg">
          <div className="flex flex-wrap items-center gap-2">
            <span aria-live="polite" className="pl-1 text-sm font-semibold">
              {count} ausgewählt
            </span>
            {/* On phones the buttons share a row of their own. */}
            <div className="grid w-full grid-cols-2 gap-2 sm:ml-auto sm:flex sm:w-auto">
              <SubmitButton
                name="intent"
                value="festschreiben"
                disabled={count === 0}
              >
                <Lock aria-hidden="true" className="hidden sm:block" />
                Festschreiben
              </SubmitButton>
              <SubmitButton
                name="intent"
                value="aufheben"
                variant="outline"
                disabled={count === 0}
              >
                <LockOpen aria-hidden="true" className="hidden sm:block" />
                Aufheben
              </SubmitButton>
            </div>
          </div>
          <FormMessage result={result} />
        </div>
      </div>
    </form>
  );
}
