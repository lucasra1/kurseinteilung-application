import { CalendarCheck, Info } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { SignupCta } from "@/components/signup-cta";
import { SkeletonList } from "@/components/skeleton-list";
import {
  Avatar,
  FestgeschriebenChip,
  kursLabel,
  RoleChip,
} from "@/components/termin-bits";
import { TerminListItem } from "@/components/termin-list-item";
import { TrainerTerminPanel } from "@/components/trainer-termin-panel";
import { buttonVariants } from "@/components/ui/button";
import { WithPanel } from "@/components/with-panel";
import { requireUser } from "@/lib/dal/auth";
import {
  findTermin,
  getUpcomingTermine,
  type TerminView,
} from "@/lib/dal/read-model";
import { formatDaysUntil, formatLongDate, formatTimeRange } from "@/lib/dates";
import { isBackup } from "@/lib/staffing";
import { firstParam, hrefWith } from "@/lib/url";

export default function MeinePage({ searchParams }: PageProps<"/meine">) {
  return (
    <Suspense fallback={<SkeletonList rows={2} />}>
      <Meine searchParams={searchParams} />
    </Suspense>
  );
}

async function Meine({
  searchParams,
}: Pick<PageProps<"/meine">, "searchParams">) {
  const [user, params, termine] = await Promise.all([
    requireUser(),
    searchParams,
    getUpcomingTermine(),
  ]);
  const mine = termine.filter((t) =>
    t.signups.some((s) => s.profileId === user.id),
  );
  const [next, ...later] = mine;
  const terminId = firstParam(params.termin);
  const selected = terminId
    ? (termine.find((t) => t.id === terminId) ?? (await findTermin(terminId)))
    : null;
  const href = (termin?: string) => hrefWith("/meine", { termin });

  return (
    <WithPanel
      panel={
        selected && (
          <TrainerTerminPanel
            key={selected.id}
            termin={selected}
            viewer={user}
            closeHref={href()}
          />
        )
      }
    >
      <div className="flex max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">
            Meine Termine
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {mine.length === 0
              ? "Du bist für keine kommenden Termine eingetragen."
              : `Du bist für ${mine.length} ${mine.length === 1 ? "kommenden Termin" : "kommende Termine"} eingetragen.`}
          </p>
        </div>

        {!next ? (
          <EmptyState
            icon={CalendarCheck}
            title="Noch nichts eingetragen"
            action={
              <Link href="/termine" className={buttonVariants()}>
                Termine ansehen
              </Link>
            }
          >
            Such dir einen Termin aus, an dem du Zeit hast.
          </EmptyState>
        ) : (
          <>
            <section className="flex flex-col gap-2.5">
              <h2 className="px-1 pt-2 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
                Als Nächstes
              </h2>
              <NextTermin
                termin={next}
                currentUserId={user.id}
                detailsHref={href(next.id)}
              />
            </section>
            {later.length > 0 && (
              <section className="flex flex-col gap-2.5">
                <h2 className="px-1 pt-2 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Später
                </h2>
                {later.map((termin) => (
                  <TerminListItem
                    key={termin.id}
                    termin={termin}
                    href={href(termin.id)}
                    currentUserId={user.id}
                    selected={termin.id === selected?.id}
                  />
                ))}
              </section>
            )}
          </>
        )}

        <div className="flex gap-2.5 rounded-2xl border bg-card p-3.5">
          <Info
            aria-hidden="true"
            className="mt-0.5 size-4.5 shrink-0 text-zinc-500"
          />
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Du kannst dich jederzeit austragen. Fällt jemand aus, rückt das
            erste Backup derselben Rolle automatisch nach und bekommt eine
            E-Mail.
          </p>
        </div>
      </div>
    </WithPanel>
  );
}

function NextTermin({
  termin,
  currentUserId,
  detailsHref,
}: {
  termin: TerminView;
  currentUserId: string;
  detailsHref: string;
}) {
  const me = termin.signups.find((s) => s.profileId === currentUserId);
  if (!me) return null;
  const others = termin.signups.filter((s) => s.profileId !== currentUserId);
  const team = others.filter((s) => !isBackup(s.role));
  const backups = others.filter((s) => isBackup(s.role));
  const names = (list: typeof others) =>
    new Intl.ListFormat("de", { type: "conjunction" }).format(
      list.map((p) => p.fullName),
    );

  return (
    <article className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-wrap items-center gap-2">
          <RoleChip role={me.role} prefix="" />
          <FestgeschriebenChip termin={termin} />
        </span>
        <span className="text-[13px] font-medium text-muted-foreground">
          {formatDaysUntil(termin.date)}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xl font-bold tracking-tight">
          {formatLongDate(termin.date)}
        </span>
        <span className="text-[15px] text-zinc-700">
          {formatTimeRange(termin)} Uhr
          {termin.location && ` · ${termin.location}`}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 rounded-xl bg-muted p-3">
        <span className="text-xs font-medium text-muted-foreground">
          {kursLabel(termin)}
        </span>
        <span className="text-[15px] font-semibold">{termin.topic}</span>
      </div>
      {others.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {team.slice(0, 3).map((person) => (
              <Avatar
                key={person.profileId}
                name={person.fullName}
                className="size-8 text-[11px] ring-2 ring-card"
              />
            ))}
          </div>
          <p className="text-sm leading-snug text-zinc-700">
            {team.length > 0 && `mit ${names(team)}`}
            {backups.length > 0 && (
              <span className="block text-muted-foreground">
                Backup: {names(backups)}
              </span>
            )}
          </p>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Link
          href={detailsHref}
          className={buttonVariants({ variant: "outline" })}
        >
          Details
        </Link>
        <SignupCta terminId={termin.id} mode="austragen" />
      </div>
    </article>
  );
}
