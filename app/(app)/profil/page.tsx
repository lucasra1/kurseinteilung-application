import { LogOut } from "lucide-react";
import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { Avatar } from "@/components/termin-bits";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/dal/auth";
import {
  hasQualification,
  KIND_LABEL,
  KINDS,
  type Qualifications,
} from "@/lib/staffing";
import { COORDINATOR } from "@/lib/wording";
import { logout } from "../actions";
import { ProfileForm } from "./profile-form";

export default function ProfilPage() {
  return (
    <div className="flex max-w-lg flex-col gap-5">
      <h1 className="text-[28px] leading-tight font-bold tracking-tight">
        Profil
      </h1>
      <Suspense fallback={<SkeletonList rows={1} />}>
        <Profile />
      </Suspense>
    </div>
  );
}

async function Profile() {
  const user = await requireUser();
  return (
    <>
      <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3.5">
          <Avatar name={user.fullName} className="size-12 text-sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-base font-semibold">
              {user.fullName}
            </span>
            <span className="text-sm text-muted-foreground">
              {qualificationText(user)}
              {user.isAdmin && ` · ${COORDINATOR.one}`}
            </span>
          </div>
        </div>
        <ProfileForm
          fullName={user.fullName}
          email={user.email}
          phone={user.phone}
        />
      </section>
      <p className="text-[13px] text-muted-foreground">
        Deine Qualifikation ändern kann eine Praxisanleiterkoordinator:in unter
        Personen.
      </p>
      <form action={logout}>
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          <LogOut aria-hidden="true" />
          Abmelden
        </Button>
      </form>
    </>
  );
}

function qualificationText(q: Qualifications): string {
  const kinds = KINDS.filter((kind) => hasQualification(q, kind));
  return kinds.length > 0
    ? kinds.map((kind) => KIND_LABEL[kind].one).join(" und ")
    : "Noch keine Qualifikation";
}
