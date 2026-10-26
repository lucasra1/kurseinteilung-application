import Link from "next/link";
import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { StaffingBadge } from "@/components/staffing-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminKurse } from "@/lib/dal/read-model";
import { formatDate, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Übersicht</h1>
        <Link href="/admin/kurse/neu" className={buttonVariants()}>
          Neuer Kurs
        </Link>
      </div>
      <Suspense fallback={<SkeletonList />}>
        <Overview searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Overview({
  searchParams,
}: Pick<PageProps<"/admin">, "searchParams">) {
  const { alle } = await searchParams;
  const includePast = alle === "1";
  const kurse = await getAdminKurse({ includePast });

  return (
    <>
      <Link
        href={includePast ? "/admin" : "/admin?alle=1"}
        className={buttonVariants({ variant: "ghost", size: "sm" })}
      >
        {includePast ? "Nur kommende Termine" : "Vergangene anzeigen"}
      </Link>

      {kurse.length === 0 && (
        <p className="text-muted-foreground">
          Noch keine Kurse. Lege mit „Neuer Kurs“ den ersten an.
        </p>
      )}

      {kurse.map((kurs) => (
        <section key={kurs.id} className="space-y-2">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <Link
              href={`/admin/kurse/${kurs.id}`}
              className="text-lg font-semibold hover:underline"
            >
              {kurs.title}
            </Link>
            <span className="text-sm text-muted-foreground">
              {kurs.trainersNeeded} Trainer · {kurs.backupsNeeded} Backup pro
              Termin
            </span>
          </div>
          {kurs.termine.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {includePast ? "Noch keine Termine." : "Keine kommenden Termine."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Thema</TableHead>
                  <TableHead>Besetzung</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {kurs.termine.map((termin) => (
                  <TableRow
                    key={termin.id}
                    className={cn(termin.isPast && "text-muted-foreground")}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatDate(termin.date)}, {formatTime(termin.startTime)}
                    </TableCell>
                    <TableCell>{termin.topic}</TableCell>
                    <TableCell>
                      <StaffingBadge termin={termin} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/termine/${termin.id}`}
                        className={buttonVariants({
                          variant: "outline",
                          size: "sm",
                        })}
                      >
                        Verwalten
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      ))}
    </>
  );
}
