import Link from "next/link";
import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { TerminCard } from "@/components/termin-card";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/dal/auth";
import { getUpcomingKurse } from "@/lib/dal/read-model";

export default function TerminePage({ searchParams }: PageProps<"/termine">) {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Termine</h1>
      <Suspense fallback={<SkeletonList />}>
        <TermineList searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TermineList({
  searchParams,
}: Pick<PageProps<"/termine">, "searchParams">) {
  const [user, kurse, { meine }] = await Promise.all([
    requireUser(),
    getUpcomingKurse(),
    searchParams,
  ]);
  const onlyMine = meine === "1";

  const visible = kurse
    .map((kurs) => ({
      ...kurs,
      termine: onlyMine
        ? kurs.termine.filter((t) =>
            t.signups.some((s) => s.profileId === user.id),
          )
        : kurs.termine,
    }))
    .filter((kurs) => kurs.termine.length > 0);

  return (
    <>
      <div className="flex gap-2">
        <Link
          href="/termine"
          className={buttonVariants({
            variant: onlyMine ? "ghost" : "secondary",
            size: "sm",
          })}
        >
          Alle
        </Link>
        <Link
          href="/termine?meine=1"
          className={buttonVariants({
            variant: onlyMine ? "secondary" : "ghost",
            size: "sm",
          })}
        >
          Meine Termine
        </Link>
      </div>

      {visible.length === 0 && (
        <p className="text-muted-foreground">
          {onlyMine
            ? "Du bist aktuell für keine Termine eingetragen."
            : "Aktuell sind keine Termine geplant."}
        </p>
      )}

      {visible.map((kurs) => (
        <section key={kurs.id} className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">{kurs.title}</h2>
            {kurs.description && (
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {kurs.description}
              </p>
            )}
          </div>
          <div className="space-y-3">
            {kurs.termine.map((termin) => (
              <TerminCard
                key={termin.id}
                termin={termin}
                currentUserId={user.id}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
