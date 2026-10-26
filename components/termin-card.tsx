import { SignupButton, type SignupState } from "@/components/signup-button";
import { StaffingBadge } from "@/components/staffing-badge";
import { Card, CardContent } from "@/components/ui/card";
import type { TerminView } from "@/lib/dal/read-model";
import { formatTerminWhen } from "@/lib/dates";
import { ROLE_LABEL, type Role } from "@/lib/staffing";

const ROLES: Role[] = ["trainer", "backup", "ueberzaehlig"];

export function TerminCard({
  termin,
  currentUserId,
}: {
  termin: TerminView;
  currentUserId: string;
}) {
  const isMine = termin.signups.some((s) => s.profileId === currentUserId);
  const state: SignupState = isMine
    ? "abmelden"
    : termin.isFull
      ? "ausgebucht"
      : "eintragen";

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {formatTerminWhen(termin)}
            {termin.location && ` · ${termin.location}`}
          </p>
          <p className="font-medium">{termin.topic}</p>
          <StaffingBadge termin={termin} />
          <dl className="space-y-1 text-sm">
            {ROLES.map((role) => {
              const people = termin.signups.filter((s) => s.role === role);
              if (role === "ueberzaehlig" && people.length === 0) return null;
              if (
                role === "backup" &&
                termin.backupsNeeded === 0 &&
                people.length === 0
              ) {
                return null;
              }
              return (
                <div key={role} className="flex gap-2">
                  <dt className="w-24 shrink-0 text-muted-foreground">
                    {ROLE_LABEL[role]}
                  </dt>
                  <dd>
                    {people.length === 0
                      ? "–"
                      : people
                          .map((s) =>
                            s.profileId === currentUserId
                              ? `${s.fullName} (du)`
                              : s.fullName,
                          )
                          .join(", ")}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
        <div className="shrink-0">
          <SignupButton terminId={termin.id} state={state} />
        </div>
      </CardContent>
    </Card>
  );
}
