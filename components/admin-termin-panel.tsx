import { Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { removeTermin } from "@/app/(app)/kurse/actions";
import { removeSignupAction } from "@/app/(app)/termine/actions";
import { AddPersonSearch } from "@/components/add-person-search";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { MoveButtons } from "@/components/move-buttons";
import { Avatar, kursLabel, StatusChip } from "@/components/termin-bits";
import { TerminPanel } from "@/components/termin-panel";
import { buttonVariants } from "@/components/ui/button";
import type { AdminSignupView, TerminView } from "@/lib/dal/read-model";
import { formatDate, formatTimeRange } from "@/lib/dates";
import { nextRole, ROLE_LABEL, type Role } from "@/lib/staffing";

/** The Termin panel for admins: contacts, order, adding and removing people. */
export function AdminTerminPanel({
  termin,
  people,
  closeHref,
}: {
  termin: TerminView<AdminSignupView>;
  people: { id: string; fullName: string; upcomingSignups: number }[];
  closeHref: string;
}) {
  const signedUp = new Set(termin.signups.map((s) => s.profileId));
  const addable = people.filter((p) => !signedUp.has(p.id));
  const role = nextRole(termin.signups.length, termin);
  const byRole = (r: Role) => termin.signups.filter((s) => s.role === r);
  const lastIndex = termin.signups.length - 1;

  return (
    <TerminPanel
      closeHref={closeHref}
      eyebrow={
        <Link href={`/kurse/${termin.kursId}`} className="hover:underline">
          {kursLabel(termin)}
        </Link>
      }
      title={termin.topic}
      footer={
        <ConfirmDialog
          triggerLabel="Termin löschen"
          triggerSize="sm"
          triggerIcon={<Trash2 aria-hidden="true" />}
          title="Termin löschen?"
          description="Eingetragene Personen werden per E-Mail informiert."
          confirmLabel="Termin löschen"
          action={removeTermin}
          fields={{ id: termin.id }}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-700">
            {formatDate(termin.date)} · {formatTimeRange(termin)}
            {termin.location && ` · ${termin.location}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip termin={termin} />
            <Link
              href={`/kurse/${termin.kursId}#termin-${termin.id}`}
              className={buttonVariants({
                variant: "outline",
                size: "sm",
                className: "ml-auto",
              })}
            >
              <Pencil aria-hidden="true" />
              Bearbeiten
            </Link>
          </div>
        </div>

        {(["trainer", "backup", "ueberzaehlig"] as const).map((r) => {
          const list = byRole(r);
          const total =
            r === "trainer"
              ? termin.trainersNeeded
              : r === "backup"
                ? termin.backupsNeeded
                : list.length;
          if (total === 0 && list.length === 0) return null;
          const firstFreeRank =
            r === "trainer"
              ? list.length + 1
              : termin.trainersNeeded + list.length + 1;
          return (
            <section key={r} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">{ROLE_LABEL[r]}</h3>
                {r !== "ueberzaehlig" && (
                  <span className="text-[13px] text-muted-foreground">
                    {list.length} von {total}
                  </span>
                )}
              </div>
              <ul className="flex flex-col gap-1">
                {list.map((signup) => (
                  <li
                    key={signup.profileId}
                    className="flex items-center gap-2.5"
                  >
                    <span className="w-4 shrink-0 text-[13px] font-semibold text-muted-foreground">
                      {signup.rank}
                    </span>
                    <Avatar name={signup.fullName} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {signup.fullName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        <a
                          href={`mailto:${signup.email}`}
                          className="hover:underline"
                        >
                          {signup.email}
                        </a>
                        {signup.phone && (
                          <>
                            {" · "}
                            <a
                              href={`tel:${signup.phone}`}
                              className="hover:underline"
                            >
                              {signup.phone}
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                    <MoveButtons
                      terminId={termin.id}
                      profileId={signup.profileId}
                      fullName={signup.fullName}
                      isFirst={signup.rank === 1}
                      isLast={signup.rank === lastIndex + 1}
                    />
                    <ConfirmDialog
                      iconOnly
                      triggerLabel={`${signup.fullName} austragen`}
                      triggerIcon={<X aria-hidden="true" />}
                      triggerClassName="text-destructive hover:text-destructive"
                      title={`${signup.fullName} austragen?`}
                      description="Die Person wird per E-Mail informiert. Alle dahinter rücken nach."
                      confirmLabel="Austragen"
                      action={removeSignupAction}
                      fields={{
                        terminId: termin.id,
                        profileId: signup.profileId,
                      }}
                    />
                  </li>
                ))}
                {r !== "ueberzaehlig" &&
                  Array.from(
                    { length: Math.max(total - list.length, 0) },
                    (_, i) => (
                      <li
                        // biome-ignore lint/suspicious/noArrayIndexKey: one row per free place
                        key={i}
                        className="flex min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-zinc-300 px-2.5 text-sm text-muted-foreground"
                      >
                        <span className="w-4 shrink-0 text-[13px] font-semibold">
                          {firstFreeRank + i}
                        </span>
                        Freier Platz
                      </li>
                    ),
                  )}
              </ul>
              {r === "ueberzaehlig" && (
                <p className="text-[13px] text-muted-foreground">
                  Mehr Leute als Plätze: erhöhe die Besetzung im Kurs oder trag
                  jemanden aus.
                </p>
              )}
            </section>
          );
        })}

        {role ? (
          <AddPersonSearch
            terminId={termin.id}
            people={addable}
            placement={`als ${ROLE_LABEL[role]} auf Platz ${termin.signups.length + 1}`}
          />
        ) : (
          <p className="rounded-xl bg-muted p-3 text-[13px] text-zinc-700">
            Ausgebucht. Um noch jemanden einzutragen, erhöhe zuerst die
            Besetzung im Kurs.
          </p>
        )}
      </div>
    </TerminPanel>
  );
}
