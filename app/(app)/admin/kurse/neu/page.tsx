import { Suspense } from "react";
import { KursForm } from "@/components/kurs-form";
import { SkeletonList } from "@/components/skeleton-list";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/dal/auth";

export default function NeuerKursPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Neuer Kurs</h1>
      <Suspense fallback={<SkeletonList rows={1} />}>
        <NewKursCard />
      </Suspense>
    </div>
  );
}

async function NewKursCard() {
  await requireAdmin();
  return (
    <Card>
      <CardContent>
        <KursForm />
      </CardContent>
    </Card>
  );
}
