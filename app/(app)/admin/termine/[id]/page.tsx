import Link from "next/link";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton-list";
import { StaffingBadge } from "@/components/staffing-badge";
import { TerminForm } from "@/components/termin-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listPeople } from "@/lib/dal/profiles";
import { getAdminTermin } from "@/lib/dal/read-model";
import { formatTerminWhen } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/staffing";
import { removeTermin, saveTermin } from "../../kurse/actions";
import { removeSignupAction } from "../actions";
import { AddPersonForm, MoveButtons } from "./signup-controls";

export default function TerminPage({
  params,
}: PageProps<"/admin/termine/[id]">) {
  return (
    <Suspense fallback={<SkeletonList />}>
      <TerminDetail params={params} />
    </Suspense>
  );
}

async function TerminDetail({
  params,
}: Pick<PageProps<"/admin/termine/[id]">, "params">) {
  const { id } = await params;
  const [{ kurs, termin }, people] = await Promise.all([
    getAdminTermin(id),
    listPeople(),
  ]);
  const signedUp = new Set(termin.signups.map((s) => s.profileId));
  const addable = people.filter((p) => !signedUp.has(p.id));

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link
          href={`/admin/kurse/${kurs.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          ← {kurs.title}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {termin.topic}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatTerminWhen(termin)}
          {termin.location && ` · ${termin.location}`}
        </p>
        <StaffingBadge termin={termin} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Eintragungen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {termin.signups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch niemand eingetragen.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {termin.signups.map((signup, index) => (
                  <TableRow key={signup.profileId}>
                    <TableCell>{signup.rank}</TableCell>
                    <TableCell>{signup.fullName}</TableCell>
                    <TableCell>{ROLE_LABEL[signup.role]}</TableCell>
                    <TableCell>
                      <a
                        href={`mailto:${signup.email}`}
                        className="hover:underline"
                      >
                        {signup.email}
                      </a>
                    </TableCell>
                    <TableCell>{signup.phone ?? "–"}</TableCell>
                    <TableCell>
                      <div className="flex items-start justify-end gap-2">
                        <MoveButtons
                          terminId={termin.id}
                          profileId={signup.profileId}
                          isFirst={index === 0}
                          isLast={index === termin.signups.length - 1}
                        />
                        <ConfirmDialog
                          triggerLabel="Austragen"
                          triggerSize="xs"
                          title={`${signup.fullName} austragen?`}
                          description="Die Person wird per E-Mail informiert. Alle dahinter rücken nach."
                          confirmLabel="Austragen"
                          action={removeSignupAction}
                          fields={{
                            terminId: termin.id,
                            profileId: signup.profileId,
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <AddPersonForm
            terminId={termin.id}
            people={addable}
            isFull={termin.isFull}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Termin bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <TerminForm
            action={saveTermin}
            fields={{ id: termin.id }}
            termin={termin}
            submitLabel="Speichern"
          />
        </CardContent>
      </Card>

      <ConfirmDialog
        triggerLabel="Termin löschen"
        title="Termin löschen?"
        description="Eingetragene Personen werden per E-Mail informiert."
        confirmLabel="Termin löschen"
        action={removeTermin}
        fields={{ id: termin.id }}
      />
    </div>
  );
}
