import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { requireAdmin } from "@/lib/dal/auth";
import { KursCreateForm } from "./kurs-create-form";

export default function NeuerKursPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/kurse"
          className="flex h-8 items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          Kurse
        </Link>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Neuer Kurs
        </h1>
      </div>
      <Suspense fallback={<SkeletonList rows={1} />}>
        <AdminOnly />
      </Suspense>
    </div>
  );
}

async function AdminOnly() {
  await requireAdmin();
  return <KursCreateForm />;
}
