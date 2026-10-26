import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { KursForm } from "@/components/kurs-form";
import { SkeletonList } from "@/components/skeleton-list";
import { StaffingBadge } from "@/components/staffing-badge";
import { TerminForm } from "@/components/termin-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminKurs } from "@/lib/dal/read-model";
import { formatTerminWhen } from "@/lib/dates";
import { addTermin, removeKurs } from "../actions";

export default function KursPage({ params }: PageProps<"/admin/kurse/[id]">) {
  return (
    <Suspense fallback={<SkeletonList />}>
      <KursDetail params={params} />
    </Suspense>
  );
}

async function KursDetail({
  params,
}: Pick<PageProps<"/admin/kurse/[id]">, "params">) {
  const { id } = await params;
  const kurs = await getAdminKurs(id);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:underline"
        >
          ← Übersicht
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{kurs.title}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kurs bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <KursForm kurs={kurs} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Termine</h2>
        {kurs.termine.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Termine.</p>
        )}
        <ul className="divide-y rounded-xl border">
          {kurs.termine.map((termin) => (
            <li
              key={termin.id}
              className="flex flex-wrap items-center justify-between gap-3 p-3"
            >
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {formatTerminWhen(termin)}
                  {termin.location && ` · ${termin.location}`}
                </p>
                <p className="font-medium">{termin.topic}</p>
                <StaffingBadge termin={termin} />
              </div>
              <Link
                href={`/admin/termine/${termin.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Verwalten
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Termin hinzufügen</CardTitle>
        </CardHeader>
        <CardContent>
          <TerminForm
            action={addTermin}
            fields={{ kursId: kurs.id }}
            submitLabel="Termin hinzufügen"
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        triggerLabel="Kurs löschen"
        title="Kurs löschen?"
        description="Alle Termine und Eintragungen dieses Kurses werden gelöscht. Eingetragene Personen werden per E-Mail informiert."
        confirmLabel="Kurs löschen"
        action={removeKurs}
        fields={{ id: kurs.id }}
      />
    </div>
  );
}
