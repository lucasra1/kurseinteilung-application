import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">
          Anmelden
        </h1>
        <p className="text-[15px] leading-relaxed text-muted-foreground">
          Wir schicken dir einen Login-Link per E-Mail. Ein Passwort brauchst du
          nicht.
        </p>
      </div>
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <Suspense fallback={null}>
          <ExpiredLinkNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </section>
      <p className="text-center text-sm text-muted-foreground">
        Noch nicht registriert? Frag deinen Admin nach dem Einladungslink.
      </p>
    </>
  );
}

async function ExpiredLinkNotice({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { fehler } = await searchParams;
  if (fehler !== "link-abgelaufen") return null;
  return (
    <p
      role="alert"
      className="rounded-xl bg-brand-100 p-3 text-sm text-brand-700"
    >
      Der Login-Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.
    </p>
  );
}
