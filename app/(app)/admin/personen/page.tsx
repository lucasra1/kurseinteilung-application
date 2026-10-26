import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton-list";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/dal/auth";
import { listPeople } from "@/lib/dal/profiles";
import { deletePerson } from "./actions";
import { AdminToggle } from "./admin-toggle";

export default function PersonenPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Personen</h1>
      <Suspense fallback={<SkeletonList />}>
        <PeopleTable />
      </Suspense>
    </div>
  );
}

async function PeopleTable() {
  const [currentUser, people] = await Promise.all([
    requireAdmin(),
    listPeople(),
  ]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>E-Mail</TableHead>
          <TableHead>Telefon</TableHead>
          <TableHead>Admin</TableHead>
          <TableHead>Kommende Termine</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {people.map((person) => (
          <TableRow key={person.id}>
            <TableCell>{person.fullName}</TableCell>
            <TableCell>
              <a href={`mailto:${person.email}`} className="hover:underline">
                {person.email}
              </a>
            </TableCell>
            <TableCell>{person.phone ?? "–"}</TableCell>
            <TableCell>{person.isAdmin ? "Ja" : "Nein"}</TableCell>
            <TableCell>{person.upcomingSignups}</TableCell>
            <TableCell>
              <div className="flex items-start justify-end gap-2">
                <AdminToggle
                  profileId={person.id}
                  isAdmin={person.isAdmin}
                  isEnvAdmin={person.isEnvAdmin}
                />
                {person.id !== currentUser.id && !person.isEnvAdmin && (
                  <ConfirmDialog
                    triggerLabel="Entfernen"
                    triggerSize="xs"
                    title={`${person.fullName} entfernen?`}
                    description="Die Person und alle ihre Eintragungen werden gelöscht."
                    confirmLabel="Entfernen"
                    action={deletePerson}
                    fields={{ profileId: person.id }}
                  />
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
