"use client";

import { Mail, X } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { markMailsRead } from "@/app/demo/actions";
import { cn } from "@/lib/utils";

/** `window` event that opens (detail.open) or closes the mailbox, sent by the tour. */
export const MAILBOX_EVENT = "kurseinteilung-demo:mailbox";

export type DemoMailView = {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  isRead: boolean;
};

const relativeTime = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

function formatAge(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "gerade eben";
  if (minutes < 60) return relativeTime.format(-minutes, "minute");
  return relativeTime.format(-Math.round(minutes / 60), "hour");
}

/** Links to this app become in-app links; everything else stays text. */
function linkify(text: string, onNavigate: () => void): ReactNode[] {
  return text.split(/(https?:\/\/\S+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) return part;
    const url = new URL(part);
    return url.origin === window.location.origin ? (
      <Link
        // biome-ignore lint/suspicious/noArrayIndexKey: parts of one fixed text
        key={index}
        href={url.pathname + url.search}
        onClick={onNavigate}
        className="font-medium text-primary underline underline-offset-2"
      >
        In der App öffnen
      </Link>
    ) : (
      part
    );
  });
}

/**
 * The demo's stand-in for the inbox: what the app would have emailed this person. New
 * mails pop up as a banner, like a notification on the phone.
 */
export function DemoMailbox({
  personaId,
  mails,
  tone,
}: {
  personaId: string | null;
  mails: DemoMailView[];
  tone: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const [banner, setBanner] = useState<DemoMailView | null>(null);
  const seen = useRef<{ personaId: string | null; ids: Set<string> } | null>(
    null,
  );
  const unread = mails.filter((m) => !m.isRead).length;

  // Only mails that arrive while you look get a banner, not those already there.
  useEffect(() => {
    if (seen.current?.personaId !== personaId) {
      seen.current = { personaId, ids: new Set(mails.map((m) => m.id)) };
      setBanner(null);
      return;
    }
    const fresh = mails.filter((m) => !seen.current?.ids.has(m.id));
    for (const mail of fresh) seen.current.ids.add(mail.id);
    if (fresh.length > 0 && !open) setBanner(fresh[0]);
  }, [mails, personaId, open]);

  useEffect(() => {
    if (!banner) return;
    const timeout = setTimeout(() => setBanner(null), 6000);
    return () => clearTimeout(timeout);
  }, [banner]);

  useEffect(() => {
    function onToggle(event: Event) {
      setOpen((event as CustomEvent<{ open: boolean }>).detail.open);
    }
    window.addEventListener(MAILBOX_EVENT, onToggle);
    return () => window.removeEventListener(MAILBOX_EVENT, onToggle);
  }, []);

  useEffect(() => {
    if (open) setBanner(null);
    if (open && unread > 0) void markMailsRead();
  }, [open, unread]);

  return (
    <>
      <button
        type="button"
        data-demo-ui
        onClick={() => setOpen(true)}
        className={cn(
          "relative flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium",
          tone === "dark"
            ? "text-zinc-100 hover:bg-white/10"
            : "text-zinc-700 hover:bg-zinc-200",
        )}
      >
        <Mail aria-hidden="true" className="size-4" />
        Postfach
        {unread > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white">
            {unread}
            <span className="sr-only"> ungelesen</span>
          </span>
        )}
      </button>

      {banner && (
        <button
          type="button"
          data-demo-ui
          onClick={() => setOpen(true)}
          className="fixed inset-x-3 top-3 z-[95] mx-auto flex max-w-sm animate-in items-start gap-3 rounded-2xl border bg-card/95 p-3 text-left text-foreground shadow-2xl backdrop-blur duration-300 slide-in-from-top-4 fade-in"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
            <Mail aria-hidden="true" className="size-4.5" />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-xs text-muted-foreground">
              Neue E-Mail · jetzt
            </span>
            <span className="truncate text-sm font-semibold">
              {banner.subject}
            </span>
            <span className="line-clamp-2 text-[13px] text-zinc-700">
              {banner.body.replace(/\s+/g, " ")}
            </span>
          </span>
        </button>
      )}

      {open && (
        <div data-demo-ui className="fixed inset-0 z-[85] flex justify-end">
          <button
            type="button"
            aria-label="Postfach schließen"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-zinc-950/40"
          />
          <section
            aria-labelledby="demo-mailbox-title"
            className="relative flex h-full w-full max-w-md animate-in flex-col bg-background text-foreground shadow-2xl duration-300 slide-in-from-right-8"
          >
            <div className="flex items-center gap-3 border-b bg-card px-5 py-4">
              <div className="flex-1">
                <h2
                  id="demo-mailbox-title"
                  className="text-lg font-bold tracking-tight"
                >
                  Postfach
                </h2>
                <p className="text-[13px] text-muted-foreground">
                  Was die App per E-Mail geschickt hätte
                </p>
              </div>
              <button
                type="button"
                aria-label="Schließen"
                onClick={() => setOpen(false)}
                className="flex size-10 items-center justify-center rounded-full bg-muted"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {mails.length === 0 ? (
                <p className="py-10 text-center text-[15px] text-muted-foreground">
                  Noch keine E-Mails.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {mails.map((mail) => (
                    <li
                      key={mail.id}
                      className="flex flex-col gap-2 rounded-2xl border bg-card p-4"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-xs font-medium text-muted-foreground">
                          Kurseinteilung
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {formatAge(mail.createdAt)}
                        </span>
                      </div>
                      <h3 className="text-[15px] font-semibold">
                        {!mail.isRead && (
                          <span
                            aria-hidden="true"
                            className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle"
                          />
                        )}
                        {mail.subject}
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700">
                        {linkify(mail.body, () => setOpen(false))}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
