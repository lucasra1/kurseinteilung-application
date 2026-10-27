import Link from "next/link";
import { Suspense } from "react";
import { SkeletonList } from "@/components/skeleton-list";
import { buttonVariants } from "@/components/ui/button";
import { isValidInviteToken } from "@/lib/dal/settings";
import { DomainError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { InviteForm } from "./invite-form";

const STEPS = [
  "Name und E-Mail eingeben",
  "Link in der E-Mail öffnen",
  "Termine aussuchen",
];

export default function InvitePage({
  params,
}: PageProps<"/einladung/[token]">) {
  return (
    <Suspense fallback={<SkeletonList rows={1} />}>
      <InviteContent params={params} />
    </Suspense>
  );
}

async function InviteContent({
  params,
}: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;

  if (!(await isValidInviteToken(token))) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <h1 className="text-xl font-bold">Link ungültig</h1>
        <p className="text-[15px] text-muted-foreground">
          {new DomainError("einladung-ungueltig").message}
        </p>
        <Link
          href="/login"
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
        >
          Zum Login
        </Link>
      </section>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Schön, dass du dabei bist!
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Du wurdest eingeladen, Kurse als Trainer oder Backup zu übernehmen.
          Trag dich einmal ein, dann suchst du dir deine Termine selbst aus.
        </p>
      </div>
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((step, index) => (
          <li
            key={step}
            aria-current={index === 0 ? "step" : undefined}
            className={cn(
              "flex flex-col gap-1.5 rounded-xl border bg-card p-2.5",
              index === 0 && "border-primary ring-1 ring-primary",
            )}
          >
            <span
              className={cn(
                "flex size-[22px] items-center justify-center rounded-full text-xs font-bold",
                index === 0
                  ? "bg-primary text-primary-foreground"
                  : "bg-zinc-200 text-zinc-700",
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-xs leading-snug",
                index === 0 ? "font-semibold" : "text-zinc-700",
              )}
            >
              {step}
            </span>
          </li>
        ))}
      </ol>
      <section className="rounded-2xl border bg-card p-5">
        <InviteForm token={token} />
      </section>
      <p className="text-center text-sm text-muted-foreground">
        Schon registriert?{" "}
        <Link
          href="/login"
          className="font-semibold text-brand-700 hover:underline"
        >
          Hier anmelden
        </Link>
      </p>
    </>
  );
}
