import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { requireUser } from "@/lib/dal/auth";
import { firstParam } from "@/lib/url";
import { AdminView } from "./admin-view";
import { TrainerView } from "./trainer-view";

export default function TerminePage({ searchParams }: PageProps<"/termine">) {
  return (
    <Suspense fallback={<SkeletonList />}>
      <Termine searchParams={searchParams} />
    </Suspense>
  );
}

async function Termine({
  searchParams,
}: Pick<PageProps<"/termine">, "searchParams">) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const query = {
    ansicht: firstParam(params.ansicht),
    termin: firstParam(params.termin),
    kurs: firstParam(params.kurs),
    status: firstParam(params.status),
    vergangen: firstParam(params.vergangen),
    auswahl: firstParam(params.auswahl),
  };
  return user.isAdmin ? (
    <AdminView query={query} />
  ) : (
    <TrainerView user={user} query={query} />
  );
}
