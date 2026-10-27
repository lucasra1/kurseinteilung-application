import { History } from "lucide-react";
import { Suspense } from "react";
import { moreHistory } from "@/app/(app)/actions";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { HistoryList } from "@/components/history-list";
import { SkeletonList } from "@/components/skeleton-list";
import { getHistory } from "@/lib/dal/audit";
import {
  BEREICH_LABEL,
  BEREICHE,
  type HistorySource,
} from "@/lib/history-source";
import { firstParam, hrefWith } from "@/lib/url";

export default function VerlaufPage({ searchParams }: PageProps<"/verlauf">) {
  return (
    <Suspense fallback={<SkeletonList rows={2} />}>
      <Verlauf searchParams={searchParams} />
    </Suspense>
  );
}

/** Everything that happened, newest first; admins only (via `getHistory`). */
async function Verlauf({
  searchParams,
}: Pick<PageProps<"/verlauf">, "searchParams">) {
  const param = firstParam((await searchParams).bereich);
  const bereich = BEREICHE.find((b) => b === param);
  const source: HistorySource = { scope: "all", bereich };
  const history = await getHistory(source);
  const chips = [
    { label: "Alle", href: "/verlauf", active: !bereich },
    ...BEREICHE.map((b) => ({
      label: BEREICH_LABEL[b],
      href: hrefWith("/verlauf", { bereich: b }),
      active: b === bereich,
    })),
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Verlauf
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Alles, was passiert ist, Neuestes oben
        </p>
      </div>

      <FilterChips chips={chips} />

      {history.groups.length === 0 ? (
        <EmptyState icon={History} title="Noch nichts protokolliert">
          {bereich
            ? `Unter „${BEREICH_LABEL[bereich]}“ gibt es noch keine Einträge.`
            : "Hier steht ab jetzt alles, was passiert: Eintragungen, Ausschreibungen und Änderungen an Kursen, Terminen und Personen."}
        </EmptyState>
      ) : (
        <section
          aria-label="Einträge"
          className="rounded-2xl border bg-card p-5"
        >
          <HistoryList
            key={`${bereich ?? "alle"}:${history.groups[0].actionId}`}
            initial={history}
            loadMore={moreHistory.bind(null, source)}
          />
        </section>
      )}
    </div>
  );
}
