import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { env } from "@/lib/env";
import { Stage } from "./stage";

export const metadata: Metadata = { title: "Schaufenster · Kurseinteilung" };

export default function SchaufensterPage() {
  if (!env.DEMO_MODE) notFound();
  return (
    <Suspense fallback={<div className="h-dvh bg-zinc-950" />}>
      <Stage />
    </Suspense>
  );
}
