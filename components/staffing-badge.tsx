import type { StaffingStatus } from "@/lib/staffing";
import { cn } from "@/lib/utils";

const DOT: Record<StaffingStatus, string> = {
  voll: "bg-green-500",
  "backup-fehlt": "bg-amber-500",
  "trainer-fehlt": "bg-red-500",
};

const LABEL: Record<StaffingStatus, string> = {
  voll: "voll besetzt",
  "backup-fehlt": "Backup fehlt",
  "trainer-fehlt": "Trainer fehlt",
};

export function StaffingBadge({
  termin,
}: {
  termin: {
    status: StaffingStatus;
    trainerCount: number;
    trainersNeeded: number;
    backupCount: number;
    backupsNeeded: number;
  };
}) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <span
        role="img"
        aria-label={LABEL[termin.status]}
        title={LABEL[termin.status]}
        className={cn("size-2.5 shrink-0 rounded-full", DOT[termin.status])}
      />
      Trainer {termin.trainerCount}/{termin.trainersNeeded} · Backup{" "}
      {termin.backupCount}/{termin.backupsNeeded}
    </span>
  );
}
