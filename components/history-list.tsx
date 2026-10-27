"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { HistoryGroup } from "@/lib/audit-text";

export type HistoryView = { groups: HistoryGroup[]; nextCursor: string | null };

/**
 * Verlauf entries, newest first, with what followed from each action indented below.
 * "Mehr anzeigen" appends older entries. Render with a `key` that changes when new
 * entries arrive, so appended pages don't outlive a refresh.
 */
export function HistoryList({
  initial,
  loadMore,
}: {
  initial: HistoryView;
  loadMore: (cursor: string) => Promise<HistoryView>;
}) {
  const [older, setOlder] = useState<HistoryView[]>([]);
  const [pending, startTransition] = useTransition();
  const pages = [initial, ...older];
  const groups = pages.flatMap((page) => page.groups);
  const cursor = pages.at(-1)?.nextCursor;

  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
    );
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <ol className="flex flex-col gap-2.5 text-sm">
        {groups.map((group) => (
          <li key={group.actionId}>
            <p>
              <span className="font-semibold">{group.time}</span> · {group.text}
            </p>
            {group.consequences.length > 0 && (
              <ul className="mt-0.5 flex flex-col gap-0.5 pl-4 text-muted-foreground">
                {group.consequences.map((text, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed list per action
                  <li key={i}>
                    <span aria-hidden="true">→ </span>
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {cursor && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const page = await loadMore(cursor);
              startTransition(() => setOlder((pages) => [...pages, page]));
            })
          }
        >
          Mehr anzeigen
        </Button>
      )}
    </div>
  );
}
