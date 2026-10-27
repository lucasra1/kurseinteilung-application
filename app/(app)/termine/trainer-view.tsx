import { CalendarDays, PartyPopper } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { FilterChips } from "@/components/filter-chips";
import { TerminListItem } from "@/components/termin-list-item";
import { TrainerTerminPanel } from "@/components/trainer-termin-panel";
import { buttonVariants } from "@/components/ui/button";
import { WithPanel } from "@/components/with-panel";
import type { CurrentUser } from "@/lib/dal/auth";
import { findTermin, getUpcomingTermine } from "@/lib/dal/read-model";
import { groupByMonth } from "@/lib/dates";
import { hrefWith } from "@/lib/url";

/** Trainers: where they are needed first, everything else one tap away. */
export async function TrainerView({
  user,
  query,
}: {
  user: CurrentUser;
  query: { ansicht?: string; termin?: string };
}) {
  const termine = await getUpcomingTermine();
  const needed = termine.filter(
    (t) => !t.isFull && !t.signups.some((s) => s.profileId === user.id),
  );
  const showAll = query.ansicht === "alle";
  const visible = showAll ? termine : needed;
  const selected = query.termin
    ? (termine.find((t) => t.id === query.termin) ??
      (await findTermin(query.termin)))
    : null;

  const ansicht = showAll ? "alle" : undefined;
  const href = (termin?: string) => hrefWith("/termine", { ansicht, termin });
  const firstName = user.fullName.split(" ")[0];

  return (
    <WithPanel
      panel={
        selected && (
          <TrainerTerminPanel
            key={selected.id}
            termin={selected}
            currentUserId={user.id}
            closeHref={href()}
          />
        )
      }
    >
      <div className="flex max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-[28px] leading-tight font-bold tracking-tight">
            Hallo {firstName}!
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {needed.length > 0
              ? `Bei ${needed.length} ${needed.length === 1 ? "Termin" : "Terminen"} wird noch jemand gebraucht.`
              : termine.length > 0
                ? "Gerade sind alle Termine besetzt. Danke!"
                : "Noch sind keine Termine geplant."}
          </p>
        </div>

        <FilterChips
          chips={[
            {
              label: "Wo du gebraucht wirst",
              href: "/termine",
              active: !showAll,
              count: needed.length,
              brand: true,
            },
            {
              label: "Alle",
              href: hrefWith("/termine", { ansicht: "alle" }),
              active: showAll,
              count: termine.length,
            },
          ]}
        />

        {visible.length === 0 &&
          (termine.length === 0 ? (
            <EmptyState icon={CalendarDays} title="Noch keine Termine">
              Sobald ein Admin Termine anlegt, siehst du sie hier.
            </EmptyState>
          ) : (
            <EmptyState
              icon={PartyPopper}
              title="Alles besetzt"
              action={
                <Link
                  href={hrefWith("/termine", { ansicht: "alle" })}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Alle Termine ansehen
                </Link>
              }
            >
              Gerade wird nirgends jemand gebraucht.
            </EmptyState>
          ))}

        {groupByMonth(visible).map((group) => (
          <section key={group.month} className="flex flex-col gap-2.5">
            <h2 className="px-1 pt-2 text-[13px] font-semibold tracking-wider text-muted-foreground uppercase">
              {group.month}
            </h2>
            {group.items.map((termin) => (
              <TerminListItem
                key={termin.id}
                termin={termin}
                href={href(termin.id)}
                currentUserId={user.id}
                selected={termin.id === selected?.id}
              />
            ))}
          </section>
        ))}
      </div>
    </WithPanel>
  );
}
