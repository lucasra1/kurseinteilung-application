import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getInviteToken } from "@/lib/dal/settings";
import { env } from "@/lib/env";
import { newInviteLink } from "./actions";
import { CopyButton } from "./copy-button";

export default function EinstellungenPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
      <Card>
        <CardHeader>
          <CardTitle>Einladungslink</CardTitle>
          <CardDescription>
            Schick diesen Link an neue Trainer:innen. Wer ihn hat, kann sich
            registrieren.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SkeletonList rows={1} />}>
            <InviteLink />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

async function InviteLink() {
  const link = `${env.APP_URL}/einladung/${await getInviteToken()}`;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input value={link} readOnly aria-label="Einladungslink" />
        <CopyButton text={link} />
      </div>
      <ConfirmDialog
        triggerLabel="Neuen Link erzeugen"
        title="Neuen Einladungslink erzeugen?"
        description="Der bisherige Link funktioniert danach nicht mehr."
        confirmLabel="Neuen Link erzeugen"
        action={newInviteLink}
        fields={{}}
        destructive={false}
      />
    </div>
  );
}
