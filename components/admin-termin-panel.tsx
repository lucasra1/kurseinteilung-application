import { ChevronDown, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { moreHistory } from "@/app/(app)/actions";
import { removeTermin } from "@/app/(app)/kurse/actions";
import {
  givePlaceAction,
  removeSignupAction,
} from "@/app/(app)/termine/actions";
import {
  type AddPersonOption,
  AddPersonSearch,
} from "@/components/add-person-search";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { HistoryList } from "@/components/history-list";
import { MoveButtons } from "@/components/move-buttons";
import {
  Avatar,
  FestgeschriebenLock,
  kursLabel,
  StatusChip,
} from "@/components/termin-bits";
import { TerminPanel } from "@/components/termin-panel";
import { buttonVariants } from "@/components/ui/button";
import type { HistoryView } from "@/lib/audit-text";
import type { AdminSignupView, TerminView } from "@/lib/dal/read-model";
import { formatDate, formatTimeRange } from "@/lib/dates";
import {
  ausgeschrieben,
  canClaimPlace,
  fixedPlaces,
  hasQualification,
  isBackup,
  KIND_LABEL,
  KINDS,
  type Kind,
  needed,
  nextRole,
  type Qualifications,
} from "@/lib/staffing";

type Person = Qualifications & {
  id: string;
  fullName: string;
  upcomingSignups: number;
};

/** The Termin panel for admins: contacts, order per role, adding and removing people, Verlauf. */
export function AdminTerminPanel({
  termin,
  people,
  history,
  closeHref,
}: {
  termin: TerminView<AdminSignupView>;
  people: Person[];
  history: HistoryView;
  closeHref: string;
}) {
  const signedUp = new Set(termin.signups.map((s) => s.profileId));
  const kinds = KINDS.filter((kind) => needed(termin, kind) > 0);
  // Roles with a free fixed place first, so the default choice is the one that's needed.
  const addOptions: AddPersonOption[] = [...kinds]
    .sort(
      (a, b) => Number(termin.missing[b] > 0) - Number(termin.missing[a] > 0),
    )
    .map((kind) => {
      const role = nextRole(termin.signups, termin, kind);
      const ofKind = termin.signups.filter((s) => s.kind === kind).length;
      // An ausgeschriebener place goes to the newcomer, ahead of the backups.
      const fixed = termin.signups.filter((s) => s.role === kind).length;
      return {
        kind,
        label: KIND_LABEL[kind].one,
        placement: isBackup(role)
          ? `als Backup ${ofKind + 1 - needed(termin, kind)} (${KIND_LABEL[kind].one})`
          : `als ${KIND_LABEL[kind].one} auf Platz ${fixed + 1}`,
        people: people
          .filter((p) => !signedUp.has(p.id) && hasQualification(p, kind))
          .map(({ id, fullName, upcomingSignups }) => ({
            id,
            fullName,
            upcomingSignups,
          })),
      };
    });

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
          <FestgeschriebenLock
            termin={termin}
            variant="line"
            detail={
              termin.festgeschriebenManuell
                ? "manuell"
                : "automatisch (weniger als 3 Monate)"
            }
          />
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

        {kinds.map((kind) => (
          <KindSection key={kind} kind={kind} termin={termin} />
        ))}

        {addOptions.length > 0 && (
          <AddPersonSearch terminId={termin.id} options={addOptions} />
        )}

        {/* Server-rendered, so its open state survives the refresh after a change. */}
        <details className="group border-t pt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-sm font-semibold [&::-webkit-details-marker]:hidden">
            Verlauf
            <ChevronDown
              aria-hidden="true"
              className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="pt-2">
            <HistoryList
              key={history.groups[0]?.actionId ?? "leer"}
              initial={history}
              loadMore={moreHistory.bind(null, "termin", termin.id)}
            />
          </div>
        </details>
      </div>
    </TerminPanel>
  );
}

function KindSection({
  kind,
  termin,
}: {
  kind: Kind;
  termin: TerminView<AdminSignupView>;
}) {
  const ofKind = termin.signups.filter((s) => s.kind === kind);
  const fixed = ofKind.filter((s) => !isBackup(s.role));
  const backups = ofKind.filter((s) => isBackup(s.role));
  const total = needed(termin, kind);
  // Missing places are the ausgeschriebenen ones first, then plain free ones.
  const ausgeschriebene = ausgeschrieben(termin, kind);
  const free = Math.max(0, termin.missing[kind] - ausgeschriebene);

  return (
    <section className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{KIND_LABEL[kind].many}</h3>
        <span className="text-[13px] text-muted-foreground">
          {fixed.length} von {total}
        </span>
      </div>
      <ul className="flex flex-col gap-1">
        {fixed.map((signup) => (
          <SignupRow
            key={signup.profileId}
            termin={termin}
            signup={signup}
            label={String(signup.rank)}
            isLast={signup.rank === ofKind.length}
          />
        ))}
        {Array.from({ length: ausgeschriebene }, (_, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: one row per ausgeschriebenen place
            key={`ausgeschrieben-${i}`}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-brand-200 bg-brand-50 px-2.5 text-sm font-medium text-brand-700"
          >
            <span className="w-5 shrink-0 text-[13px] font-semibold">
              {fixed.length + i + 1}
            </span>
            Ausgeschrieben
          </li>
        ))}
        {Array.from({ length: free }, (_, i) => (
          <li
            // biome-ignore lint/suspicious/noArrayIndexKey: one row per free place
            key={`free-${i}`}
            className="flex min-h-11 items-center gap-2.5 rounded-xl border-[1.5px] border-dashed border-zinc-300 px-2.5 text-sm text-muted-foreground"
          >
            <span className="w-5 shrink-0 text-[13px] font-semibold">
              {fixed.length + ausgeschriebene + i + 1}
            </span>
            Freier Platz
          </li>
        ))}
      </ul>
      {backups.length > 0 && (
        <>
          <h4 className="mt-2 text-[13px] font-semibold text-muted-foreground">
            Backups ({KIND_LABEL[kind].many})
          </h4>
          <ul className="flex flex-col gap-1">
            {backups.map((signup) => (
              <SignupRow
                key={signup.profileId}
                termin={termin}
                signup={signup}
                label={`B${signup.rank - fixedPlaces(termin, kind)}`}
                isLast={signup.rank === ofKind.length}
              />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function SignupRow({
  termin,
  signup,
  label,
  isLast,
}: {
  termin: TerminView<AdminSignupView>;
  signup: AdminSignupView;
  label: string;
  isLast: boolean;
}) {
  return (
    <li className="flex items-center gap-2.5">
      <span className="w-5 shrink-0 text-[13px] font-semibold text-muted-foreground">
        {label}
      </span>
      <Avatar name={signup.fullName} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{signup.fullName}</span>
        <span className="truncate text-xs text-muted-foreground">
          <a href={`mailto:${signup.email}`} className="hover:underline">
            {signup.email}
          </a>
          {signup.phone && (
            <>
              {" · "}
              <a href={`tel:${signup.phone}`} className="hover:underline">
                {signup.phone}
              </a>
            </>
          )}
        </span>
        {canClaimPlace(termin, signup.profileId) && (
          <div className="mt-1.5">
            <ConfirmDialog
              triggerLabel="Platz geben"
              triggerSize="sm"
              destructive={false}
              title={`${signup.fullName} den Platz geben?`}
              description={`${signup.fullName} wird ${KIND_LABEL[signup.kind].one} und bekommt eine E-Mail.`}
              confirmLabel="Platz geben"
              action={givePlaceAction}
              fields={{ terminId: termin.id, profileId: signup.profileId }}
            />
          </div>
        )}
      </div>
      <MoveButtons
        terminId={termin.id}
        profileId={signup.profileId}
        fullName={signup.fullName}
        isFirst={signup.rank === 1}
        isLast={isLast}
      />
      <ConfirmDialog
        iconOnly
        triggerLabel={`${signup.fullName} austragen`}
        triggerIcon={<X aria-hidden="true" />}
        triggerClassName="text-destructive hover:text-destructive"
        title={`${signup.fullName} austragen?`}
        description="Die Person wird per E-Mail informiert. Wer dahinter steht, rückt nach."
        confirmLabel="Austragen"
        action={removeSignupAction}
        fields={{ terminId: termin.id, profileId: signup.profileId }}
      />
    </li>
  );
}
