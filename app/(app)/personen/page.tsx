import { Link2 } from "lucide-react";
import { Suspense } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SkeletonList } from "@/components/skeleton-list";
import { requireAdmin } from "@/lib/dal/auth";
import { listPeople } from "@/lib/dal/profiles";
import { getInviteToken } from "@/lib/dal/settings";
import { env } from "@/lib/env";
import { newInviteLink } from "./actions";
import { CopyButton } from "./copy-button";
import { PeopleList } from "./people-list";

export default function PersonenPage() {
  return (
    <Suspense fallback={<SkeletonList rows={2} />}>
      <Personen />
    </Suspense>
  );
}

async function Personen() {
  const [currentUser, people, token] = await Promise.all([
    requireAdmin(),
    listPeople(),
    getInviteToken(),
  ]);
  const link = `${env.APP_URL}/einladung/${token}`;
  const adminCount = people.filter((p) => p.isAdmin).length;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Personen
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {people.length} {people.length === 1 ? "Person" : "Personen"} ·{" "}
          {adminCount} {adminCount === 1 ? "Admin" : "Admins"}
        </p>
      </div>

      <section
        aria-labelledby="invite-heading"
        className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-2xl border bg-card p-5"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
          <Link2 aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-[1_1_16rem]">
          <h2 id="invite-heading" className="text-[17px] font-semibold">
            Neue Leute einladen
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Schick diesen Link an neue Trainer, zum Beispiel per WhatsApp oder
            E-Mail. Wer ihn öffnet, kann sich selbst registrieren.
          </p>
        </div>
        <div className="flex min-w-0 flex-[999_1_24rem] flex-col gap-1.5">
          <div className="flex gap-2">
            <label htmlFor="invite-link" className="sr-only">
              Einladungslink
            </label>
            <input
              id="invite-link"
              readOnly
              value={link}
              className="h-11 min-w-0 flex-1 rounded-xl border bg-zinc-50 px-3 text-sm text-zinc-700 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            />
            <CopyButton text={link} />
          </div>
          <ConfirmDialog
            triggerLabel="Neuen Link erzeugen"
            triggerSize="sm"
            triggerClassName="self-start px-0 text-muted-foreground underline underline-offset-4 hover:bg-transparent"
            destructive={false}
            title="Neuen Einladungslink erzeugen?"
            description="Der bisherige Link funktioniert danach nicht mehr. Wer schon registriert ist, ist davon nicht betroffen."
            confirmLabel="Neuen Link erzeugen"
            action={newInviteLink}
            fields={{}}
          />
        </div>
      </section>

      <PeopleList
        currentUserId={currentUser.id}
        people={people.map((p) => ({
          id: p.id,
          fullName: p.fullName,
          email: p.email,
          phone: p.phone,
          isAdmin: p.isAdmin,
          isEnvAdmin: p.isEnvAdmin,
          upcomingSignups: p.upcomingSignups,
        }))}
      />
    </div>
  );
}
