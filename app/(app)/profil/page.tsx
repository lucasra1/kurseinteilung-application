import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/dal/auth";
import { ProfileForm } from "./profile-form";

export default function ProfilPage() {
  return (
    <div className="max-w-md space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Profil</h1>
      <Suspense fallback={<SkeletonList rows={1} />}>
        <ProfileCard />
      </Suspense>
    </div>
  );
}

async function ProfileCard() {
  const user = await requireUser();
  return (
    <Card>
      <CardContent>
        <ProfileForm
          fullName={user.fullName}
          email={user.email}
          phone={user.phone}
        />
      </CardContent>
    </Card>
  );
}
