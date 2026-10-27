import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SkeletonList } from "@/components/skeleton-list";
import { buttonVariants } from "@/components/ui/button";
import { getAdminKurse } from "@/lib/dal/read-model";
import { formatDate } from "@/lib/dates";

export default function KursePage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Kurse
        </h1>
        <Link href="/kurse/neu" className={buttonVariants()}>
          <Plus aria-hidden="true" />
          Neuer Kurs
        </Link>
      </div>
      <Suspense fallback={<SkeletonList rows={2} />}>
        <KursList />
      </Suspense>
    </div>
  );
}

async function KursList() {
  const kurse = await getAdminKurse();
  if (kurse.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Noch keine Kurse"
        action={
          <Link href="/kurse/neu" className={buttonVariants()}>
            Ersten Kurs anlegen
          </Link>
        }
      >
        Leg einen Kurs mit seinen Terminen an. Danach können sich alle über den
        Einladungslink eintragen.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {kurse.map((kurs) => {
        const upcoming = kurs.termine.filter((t) => !t.isPast);
        const withGaps = upcoming.filter((t) => t.status !== "voll").length;
        const next = upcoming[0];
        return (
          <Link
            key={kurs.id}
            href={`/kurse/${kurs.id}`}
            className="flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors hover:border-zinc-300"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-lg leading-snug font-semibold">
                {kurs.title}
              </h2>
              {kurs.description && (
                <p className="line-clamp-2 text-sm text-muted-foreground">
                  {kurs.description}
                </p>
              )}
            </div>
            <p className="text-sm text-zinc-700">
              {kurs.trainersNeeded} Trainer · {kurs.backupsNeeded} Backup pro
              Termin
            </p>
            <div className="mt-auto flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
              {upcoming.length === 0 ? (
                <span className="rounded-full bg-muted px-2.5 py-1 font-semibold text-zinc-700">
                  Keine kommenden Termine
                </span>
              ) : withGaps > 0 ? (
                <span className="rounded-full bg-brand-100 px-2.5 py-1 font-semibold text-brand-700">
                  {withGaps} {withGaps === 1 ? "Termin" : "Termine"} mit Lücken
                </span>
              ) : (
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-semibold text-green-800">
                  Alles besetzt
                </span>
              )}
              {upcoming.length > 0 && (
                <span>
                  {upcoming.length} kommende · nächster {formatDate(next.date)}
                </span>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
