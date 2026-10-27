"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";
import { buttonVariants } from "@/components/ui/button";

/**
 * Shows a Termin next to the list: a sheet from the bottom on phones, a sticky column
 * from `lg` on. Its open state lives in the URL (`?termin=`), so closing navigates to
 * `closeHref`. Render it with `key={terminId}` so switching Termine moves focus to it.
 */
export function TerminPanel({
  closeHref,
  title,
  eyebrow,
  children,
  footer,
}: {
  closeHref: string;
  title: string;
  eyebrow: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Dialogs opened from the panel render outside it and handle Escape themselves.
      if (
        event.key !== "Escape" ||
        !panelRef.current?.contains(document.activeElement)
      ) {
        return;
      }
      router.push(closeHref, { scroll: false });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeHref, router]);

  return (
    <>
      <Link
        href={closeHref}
        scroll={false}
        tabIndex={-1}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-zinc-950/50 lg:hidden"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby="termin-panel-title"
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-3xl bg-card shadow-2xl outline-none lg:sticky lg:top-22 lg:z-auto lg:max-h-[calc(100dvh-7rem)] lg:rounded-2xl lg:border lg:shadow-none"
      >
        <div className="flex justify-center pt-2.5 lg:hidden">
          <span
            aria-hidden="true"
            className="h-1 w-10 rounded-full bg-zinc-300"
          />
        </div>
        <div className="flex items-start gap-3 px-5 pt-3 lg:pt-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] font-medium text-muted-foreground">
              {eyebrow}
            </span>
            <h2
              id="termin-panel-title"
              className="text-xl leading-snug font-bold tracking-tight"
            >
              {title}
            </h2>
          </div>
          <Link
            href={closeHref}
            scroll={false}
            aria-label="Schließen"
            className={buttonVariants({
              variant: "secondary",
              size: "icon",
              className: "rounded-full",
            })}
          >
            <X aria-hidden="true" className="size-5" />
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-5">{children}</div>
        {footer && (
          <div className="shrink-0 border-t px-5 pt-3.5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
