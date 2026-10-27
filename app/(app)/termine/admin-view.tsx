import {
  CalendarDays,
  Check,
  CircleAlert,
  Plus,
  UserRoundPlus,
} from "lucide-react";
import Link from "next/link";
import { AdminTerminPanel } from "@/components/admin-termin-panel";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { AvatarSlots, kursLabel, StatusChip } from "@/components/termin-bits";
import { buttonVariants } from "@/components/ui/button";
import { WithPanel } from "@/components/with-panel";
import { listPeople } from "@/lib/dal/profiles";
import {
  type AdminSignupView,
  findAdminTermin,
  getAdminTermine,
  type TerminView,
} from "@/lib/dal/read-model";
import { formatTimeRange, formatWeekday, groupByMonth } from "@/lib/dates";
import type { StaffingStatus } from "@/lib/staffing";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import { KursFilter } from "./kurs-filter";

type StatusFilter = StaffingStatus | "offen";
const STATUS_FILTERS: StatusFilter[] = [
  "offen",
  "trainer-fehlt",
  "backup-fehlt",
  "voll",
];

const STAT_CARDS = [
  {
    status: "trainer-fehlt",
    label: "Trainer fehlt",
    icon: CircleAlert,
    tone: "bg-brand-100 text-brand-700",
  },
  {
    status: "backup-fehlt",
    label: "Backup fehlt",
    icon: UserRoundPlus,
    tone: "bg-amber-100 text-amber-800",
  },
  {
    status: "voll",
    label: "Voll besetzt",
    icon: Check,
    tone: "bg-green-100 text-green-800",
  },
] as const;

/** Admins: gaps at a glance, then fix them in the panel without leaving the list. */
export async function AdminView({
  query,
}: {
  query: {
    termin?: string;
    kurs?: string;
    status?: string;
    vergangen?: string;
  };
}) {
  const includePast = query.vergangen === "1";
  const all = await getAdminTermine({ includePast });

  const kurse = [...new Map(all.map((t) => [t.kursId, t.kursTitle])).entries()]
    .map(([id, title]) => ({ id, title }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const kursId = kurse.some((k) => k.id === query.kurs)
    ? query.kurs
    : undefined;
  const status = STATUS_FILTERS.find((s) => s === query.status);

  const inKurs = kursId ? all.filter((t) => t.kursId === kursId) : all;
  const upcoming = inKurs.filter((t) => !t.isPast);
  const countOf = (s: StaffingStatus) =>
    upcoming.filter((t) => t.status === s).length;
  const open = upcoming.filter((t) => t.status !== "voll").length;
  const visible = inKurs.filter((t) =>
    !status
      ? true
      : status === "offen"
        ? t.status !== "voll"
        : t.status === status,
  );

  const [selected, people] = query.termin
    ? await Promise.all([
        all.find((t) => t.id === query.termin) ?? findAdminTermin(query.termin),
        listPeople(),
      ])
    : [null, []];

  const filters = {
    kurs: kursId,
    status,
    vergangen: includePast ? "1" : undefined,
  };
  const href = (changes: Record<string, string | undefined>) =>
    hrefWith("/termine", { ...filters, ...changes });
  const kursCount = new Set(upcoming.map((t) => t.kursId)).size;

  return (
    <WithPanel
      panel={
        selected && (
          <AdminTerminPanel
            key={selected.id}
            termin={selected}
            people={people}
            closeHref={href({})}
          />
        )
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] leading-tight font-bold tracking-tight">
              Termine
            </h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              {upcoming.length} kommende{" "}
              {upcoming.length === 1 ? "Termin" : "Termine"} in {kursCount}{" "}
              {kursCount === 1 ? "Kurs" : "Kursen"}
            </p>
          </div>
          <Link href="/kurse/neu" className={buttonVariants()}>
            <Plus aria-hidden="true" />
            Neuer Kurs
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {STAT_CARDS.map((card) => {
            const active = status === card.status;
            const count = countOf(card.status);
            return (
              <Link
                key={card.status}
                href={href({ status: active ? undefined : card.status })}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3.5 rounded-2xl border bg-card p-4 transition-colors hover:border-zinc-300",
                  active && "border-foreground ring-1 ring-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl",
                    card.tone,
                  )}
                >
                  <card.icon aria-hidden="true" className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-xl font-bold">
                    {count} {count === 1 ? "Termin" : "Termine"}
                  </span>
                  <span className="text-sm font-medium text-zinc-700">
                    {card.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChips
            chips={[
              {
                label: "Alle",
                href: href({ status: undefined }),
                active: !status,
                count: inKurs.length,
              },
              {
                label: "Braucht Leute",
                href: href({ status: "offen" }),
                active: status === "offen",
                count: open,
              },
            ]}
          />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <Link
              href={href({ vergangen: includePast ? undefined : "1" })}
              scroll={false}
              className={buttonVariants({ variant: "ghost" })}
            >
              {includePast ? "Vergangene ausblenden" : "Vergangene anzeigen"}
            </Link>
            <KursFilter
              kurse={kurse}
              value={kursId}
              hrefs={Object.fromEntries([
                ["", href({ kurs: undefined })],
                ...kurse.map((k) => [k.id, href({ kurs: k.id })]),
              ])}
            />
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title={all.length === 0 ? "Noch keine Termine" : "Nichts gefunden"}
            action={
              all.length === 0 && (
                <Link href="/kurse/neu" className={buttonVariants()}>
                  Ersten Kurs anlegen
                </Link>
              )
            }
          >
            {all.length === 0
              ? "Leg einen Kurs mit seinen Terminen an, dann können sich alle eintragen."
              : "Für diesen Filter gibt es keine Termine."}
          </EmptyState>
        ) : (
          <section
            aria-label="Terminliste"
            className="overflow-hidden rounded-2xl border bg-card"
          >
            <div
              aria-hidden="true"
              className="hidden grid-cols-[3rem_minmax(0,1fr)_7rem_4rem_8.5rem] gap-4 border-b px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase md:grid"
            >
              <span>Datum</span>
              <span>Termin</span>
              <span>Trainer</span>
              <span>Backup</span>
              <span>Status</span>
            </div>
            {groupByMonth(visible).map((group) => (
              <div key={group.month}>
                <h2 className="border-b bg-zinc-50 px-4 py-2.5 text-[13px] font-semibold text-zinc-700">
                  {group.month}
                </h2>
                {group.items.map((termin) => (
                  <AdminTerminRow
                    key={termin.id}
                    termin={termin}
                    href={href({ termin: termin.id })}
                    selected={termin.id === selected?.id}
                  />
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </WithPanel>
  );
}

function AdminTerminRow({
  termin,
  href,
  selected,
}: {
  termin: TerminView<AdminSignupView>;
  href: string;
  selected: boolean;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 gap-y-2.5 border-b px-4 py-3.5 transition-colors outline-none last:border-b-0 hover:bg-zinc-50 focus-visible:bg-zinc-50 md:grid-cols-[3rem_minmax(0,1fr)_7rem_4rem_8.5rem] md:items-center",
        selected &&
          "bg-brand-50 ring-1 ring-brand-200 ring-inset hover:bg-brand-50",
        termin.isPast && "text-muted-foreground",
      )}
    >
      <span className="flex flex-col self-start md:self-center">
        <span className="text-xs font-semibold text-muted-foreground">
          {formatWeekday(termin.date)}
        </span>
        <span className="text-base font-bold">
          {termin.date.slice(8, 10)}.{termin.date.slice(5, 7)}.
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {kursLabel(termin)}
        </span>
        <span className="truncate text-[15px] font-semibold">
          {termin.topic}
        </span>
        <span className="text-[13px] text-muted-foreground">
          {formatTimeRange(termin)}
          {termin.location && ` · ${termin.location}`}
        </span>
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-3 md:contents">
        <AvatarSlots
          label="Trainer"
          people={termin.signups.filter((s) => s.role === "trainer")}
          total={termin.trainersNeeded}
        />
        {termin.backupsNeeded > 0 ? (
          <AvatarSlots
            label="Backup"
            people={termin.signups.filter((s) => s.role === "backup")}
            total={termin.backupsNeeded}
          />
        ) : (
          <span />
        )}
        <span className="ml-auto md:ml-0">
          <StatusChip termin={termin} />
        </span>
      </span>
    </Link>
  );
}
