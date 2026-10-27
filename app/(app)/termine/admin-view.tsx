import {
  CalendarDays,
  Check,
  GraduationCap,
  HeartPulse,
  ListChecks,
  Plus,
  X,
} from "lucide-react";
import Link from "next/link";
import { AdminTerminPanel } from "@/components/admin-termin-panel";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import {
  AvatarSlots,
  FestgeschriebenChip,
  kursLabel,
  StatusChip,
} from "@/components/termin-bits";
import { buttonVariants } from "@/components/ui/button";
import { WithPanel } from "@/components/with-panel";
import { getHistory } from "@/lib/dal/audit";
import { listPeople } from "@/lib/dal/profiles";
import {
  type AdminSignupView,
  findAdminTermin,
  getAdminTermine,
  type TerminView,
} from "@/lib/dal/read-model";
import {
  formatDate,
  formatTimeRange,
  formatWeekday,
  groupByMonth,
} from "@/lib/dates";
import { isBackup, KIND_LABEL, type Kind } from "@/lib/staffing";
import { hrefWith } from "@/lib/url";
import { cn } from "@/lib/utils";
import { FestschreibungForm } from "./festschreibung-form";
import { KursFilter } from "./kurs-filter";

type StatusFilter =
  | "offen"
  | "instruktor-fehlt"
  | "praxisanleiter-fehlt"
  | "voll";
const STATUS_FILTERS: StatusFilter[] = [
  "offen",
  "instruktor-fehlt",
  "praxisanleiter-fehlt",
  "voll",
];

function matches(
  termin: TerminView<AdminSignupView>,
  status: StatusFilter,
): boolean {
  if (status === "offen") return !termin.isStaffed;
  if (status === "voll") return termin.isStaffed;
  return (
    termin.missing[
      status === "instruktor-fehlt" ? "instruktor" : "praxisanleiter"
    ] > 0
  );
}

const STAT_CARDS = [
  {
    status: "instruktor-fehlt",
    label: "Instruktor fehlt",
    icon: GraduationCap,
    tone: "bg-brand-100 text-brand-700",
  },
  {
    status: "praxisanleiter-fehlt",
    label: "Praxisanleiter fehlt",
    icon: HeartPulse,
    tone: "bg-brand-100 text-brand-700",
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
    auswahl?: string;
  };
}) {
  const includePast = query.vergangen === "1";
  // Selection mode for Festschreiben: rows become checkboxes instead of opening the panel.
  const selecting = query.auswahl === "1";
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
  const countOf = (s: StatusFilter) =>
    upcoming.filter((t) => matches(t, s)).length;
  const open = countOf("offen");
  const visible = status ? inKurs.filter((t) => matches(t, status)) : inKurs;

  const [selected, people, history] = query.termin
    ? await Promise.all([
        all.find((t) => t.id === query.termin) ?? findAdminTermin(query.termin),
        listPeople(),
        getHistory("termin", query.termin),
      ])
    : [null, [], null];

  const filters = {
    kurs: kursId,
    status,
    vergangen: includePast ? "1" : undefined,
    auswahl: selecting ? "1" : undefined,
  };
  const href = (changes: Record<string, string | undefined>) =>
    hrefWith("/termine", { ...filters, ...changes });
  const kursCount = new Set(upcoming.map((t) => t.kursId)).size;

  return (
    <WithPanel
      panel={
        selected &&
        history && (
          <AdminTerminPanel
            key={selected.id}
            termin={selected}
            people={people}
            history={history}
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
            <Link
              href={href({ auswahl: selecting ? undefined : "1" })}
              scroll={false}
              aria-current={selecting ? "true" : undefined}
              className={buttonVariants({
                variant: selecting ? "default" : "outline",
              })}
            >
              {selecting ? (
                <X aria-hidden="true" />
              ) : (
                <ListChecks aria-hidden="true" />
              )}
              {selecting ? "Auswahl beenden" : "Auswählen"}
            </Link>
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
        ) : selecting ? (
          <FestschreibungForm
            key={href({})}
            total={visible.filter((t) => !t.isPast).length}
          >
            <TerminList
              visible={visible}
              selecting
              href={href}
              selectedId={undefined}
            />
          </FestschreibungForm>
        ) : (
          <TerminList
            visible={visible}
            selecting={false}
            href={href}
            selectedId={selected?.id}
          />
        )}
      </div>
    </WithPanel>
  );
}

// The first column also holds the checkbox in selection mode.
const COLUMNS =
  "grid-cols-[3rem_minmax(0,1fr)] @4xl:grid-cols-[3rem_minmax(0,1fr)_7rem_7rem_4.5rem_9.5rem]";
const COLUMNS_SELECTING =
  "grid-cols-[5rem_minmax(0,1fr)] @4xl:grid-cols-[5rem_minmax(0,1fr)_7rem_7rem_4.5rem_9.5rem]";

function TerminList({
  visible,
  selecting,
  href,
  selectedId,
}: {
  visible: TerminView<AdminSignupView>[];
  selecting: boolean;
  href: (changes: Record<string, string | undefined>) => string;
  selectedId: string | undefined;
}) {
  return (
    <section
      aria-label="Terminliste"
      className="@container overflow-hidden rounded-2xl border bg-card"
    >
      <div
        aria-hidden="true"
        className={cn(
          "hidden gap-4 border-b px-4 py-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase @4xl:grid",
          selecting ? COLUMNS_SELECTING : COLUMNS,
        )}
      >
        <span>Datum</span>
        <span>Termin</span>
        <span>Instruktoren</span>
        <span>Praxisanl.</span>
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
              selected={termin.id === selectedId}
              selecting={selecting}
            />
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * One Termin: opens the panel, or in selection mode toggles its checkbox (only upcoming
 * Termine can be selected).
 */
function AdminTerminRow({
  termin,
  href,
  selected,
  selecting,
}: {
  termin: TerminView<AdminSignupView>;
  href: string;
  selected: boolean;
  selecting: boolean;
}) {
  const className = cn(
    "grid gap-x-4 gap-y-2.5 border-b px-4 py-3.5 transition-colors outline-none last:border-b-0 @4xl:items-center",
    selecting ? COLUMNS_SELECTING : COLUMNS,
    termin.isPast && "text-muted-foreground",
  );
  const content = (
    <AdminTerminRowContent termin={termin} selecting={selecting} />
  );

  if (selecting && termin.isPast) {
    return <div className={className}>{content}</div>;
  }
  if (selecting) {
    return (
      <label
        htmlFor={checkboxId(termin)}
        className={cn(
          className,
          "cursor-pointer hover:bg-zinc-50 focus-within:bg-zinc-50 has-checked:bg-brand-50",
        )}
      >
        {content}
      </label>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={selected ? "true" : undefined}
      className={cn(
        className,
        "hover:bg-zinc-50 focus-visible:bg-zinc-50",
        selected &&
          "bg-brand-50 ring-1 ring-brand-200 ring-inset hover:bg-brand-50",
      )}
    >
      {content}
    </Link>
  );
}

const checkboxId = (termin: { id: string }) => `auswahl-${termin.id}`;

function AdminTerminRowContent({
  termin,
  selecting,
}: {
  termin: TerminView<AdminSignupView>;
  selecting: boolean;
}) {
  return (
    <>
      <span className="flex items-center gap-2.5 self-start @4xl:self-center">
        {selecting &&
          (termin.isPast ? (
            <span aria-hidden="true" className="size-5 shrink-0" />
          ) : (
            <input
              id={checkboxId(termin)}
              type="checkbox"
              name="terminId"
              value={termin.id}
              aria-label={`${kursLabel(termin)}: ${termin.topic}, ${formatDate(termin.date)}`}
              className="size-5 shrink-0 accent-foreground"
            />
          ))}
        <span className="flex flex-col">
          <span className="text-xs font-semibold text-muted-foreground">
            {formatWeekday(termin.date)}
          </span>
          <span className="text-base font-bold">
            {termin.date.slice(8, 10)}.{termin.date.slice(5, 7)}.
          </span>
        </span>
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs font-medium text-muted-foreground">
          {kursLabel(termin)}
        </span>
        <span className="truncate text-[15px] font-semibold">
          {termin.topic}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
          <span>
            {formatTimeRange(termin)}
            {termin.location && ` · ${termin.location}`}
          </span>
          <FestgeschriebenChip termin={termin} />
        </span>
      </span>
      <span className="col-start-2 flex flex-wrap items-center gap-3 @4xl:contents">
        <KindSlots termin={termin} kind="instruktor" />
        <KindSlots termin={termin} kind="praxisanleiter" />
        <span className="text-[13px] text-muted-foreground">
          {backupCount(termin) > 0 ? (
            <>
              <span className="@4xl:hidden">Backup </span>+{backupCount(termin)}
            </>
          ) : (
            <span aria-hidden="true" className="hidden @4xl:inline">
              –
            </span>
          )}
        </span>
        <span className="ml-auto @4xl:ml-0">
          <StatusChip termin={termin} />
        </span>
      </span>
    </>
  );
}

function backupCount(termin: TerminView<AdminSignupView>): number {
  return termin.signups.filter((s) => isBackup(s.role)).length;
}

/** Avatars and free places of one role; a dash where the Termin doesn't need it. */
function KindSlots({
  termin,
  kind,
}: {
  termin: TerminView<AdminSignupView>;
  kind: Kind;
}) {
  const total =
    kind === "instruktor"
      ? termin.instruktorenNeeded
      : termin.praxisanleiterNeeded;
  if (total === 0) {
    return (
      <span
        aria-hidden="true"
        className="hidden text-[13px] text-muted-foreground @4xl:inline"
      >
        –
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="text-xs text-muted-foreground @4xl:hidden"
      >
        {KIND_LABEL[kind].many}
      </span>
      <AvatarSlots
        label={KIND_LABEL[kind].many}
        people={termin.signups.filter((s) => s.role === kind)}
        total={total}
      />
    </span>
  );
}
