import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton-list";
import { TerminColumnHeads } from "@/components/termin-fields";
import { getAdminKurs } from "@/lib/dal/read-model";
import { formatTime, nextDay } from "@/lib/dates";
import { removeKurs } from "../actions";
import { AddTerminRow } from "./add-termin-row";
import { KursEditForm } from "./kurs-edit-form";
import { TerminRowForm } from "./termin-row-form";

export default function KursPage({ params }: PageProps<"/kurse/[id]">) {
  return (
    <Suspense fallback={<SkeletonList rows={2} />}>
      <KursDetail params={params} />
    </Suspense>
  );
}

async function KursDetail({
  params,
}: Pick<PageProps<"/kurse/[id]">, "params">) {
  const { id } = await params;
  const kurs = await getAdminKurs(id);
  const last = kurs.termine.at(-1);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/kurse"
          className="flex h-8 items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Kurse
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          {kurs.title}
        </h1>
      </div>

      <div className="flex flex-col gap-5">
        <section
          aria-labelledby="kurs-heading"
          className="flex flex-col gap-4 rounded-2xl border bg-card p-5"
        >
          <h2 id="kurs-heading" className="text-[17px] font-semibold">
            Kurs
          </h2>
          <KursEditForm
            kurs={{
              id: kurs.id,
              title: kurs.title,
              description: kurs.description,
              trainersNeeded: kurs.trainersNeeded,
              backupsNeeded: kurs.backupsNeeded,
            }}
          />
          <div className="border-t pt-4">
            <ConfirmDialog
              triggerLabel="Kurs löschen"
              triggerSize="sm"
              title="Kurs löschen?"
              description="Alle Termine und Eintragungen dieses Kurses werden gelöscht. Eingetragene Personen werden per E-Mail informiert."
              confirmLabel="Kurs löschen"
              action={removeKurs}
              fields={{ id: kurs.id }}
            />
          </div>
        </section>

        <section
          aria-labelledby="termine-heading"
          className="flex min-w-0 flex-col gap-3.5 rounded-2xl border bg-card p-5"
        >
          <div className="flex items-baseline justify-between">
            <h2 id="termine-heading" className="text-[17px] font-semibold">
              Termine
            </h2>
            <span className="text-sm text-muted-foreground">
              {kurs.termine.length}{" "}
              {kurs.termine.length === 1 ? "Termin" : "Termine"}
            </span>
          </div>
          {kurs.termine.length > 0 && <TerminColumnHeads trailing="w-11" />}
          <ol className="flex flex-col gap-3">
            {kurs.termine.map((termin, index) => (
              <TerminRowForm
                key={termin.id}
                index={index}
                termin={{
                  id: termin.id,
                  date: termin.date,
                  startTime: formatTime(termin.startTime),
                  endTime: formatTime(termin.endTime),
                  topic: termin.topic,
                  location: termin.location ?? "",
                  isPast: termin.isPast,
                  status: termin.status,
                  trainerCount: termin.trainerCount,
                  backupCount: termin.backupCount,
                  trainersNeeded: termin.trainersNeeded,
                  backupsNeeded: termin.backupsNeeded,
                  signupCount: termin.signups.length,
                }}
              />
            ))}
          </ol>
          <AddTerminRow
            key={last?.id ?? "leer"}
            kursId={kurs.id}
            dayNumber={kurs.termine.length + 1}
            prefill={{
              date: last ? nextDay(last.date) : "",
              startTime: last ? formatTime(last.startTime) : "09:00",
              endTime: last ? formatTime(last.endTime) : "17:00",
              topic: "",
              location: last?.location ?? "",
            }}
          />
        </section>
      </div>
    </div>
  );
}
