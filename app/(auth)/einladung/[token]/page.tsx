import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isValidInviteToken } from "@/lib/dal/settings";
import { DomainError } from "@/lib/errors";
import { InviteForm } from "./invite-form";

export default function InvitePage({
  params,
}: PageProps<"/einladung/[token]">) {
  return (
    <Card>
      <Suspense
        fallback={
          <CardContent>
            <p className="text-sm text-muted-foreground">Lädt…</p>
          </CardContent>
        }
      >
        <InviteContent params={params} />
      </Suspense>
    </Card>
  );
}

async function InviteContent({
  params,
}: Pick<PageProps<"/einladung/[token]">, "params">) {
  const { token } = await params;

  if (!(await isValidInviteToken(token))) {
    return (
      <>
        <CardHeader>
          <CardTitle>Link ungültig</CardTitle>
          <CardDescription>
            {new DomainError("einladung-ungueltig").message}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/login"
            className={buttonVariants({ variant: "outline" })}
          >
            Zum Login
          </Link>
        </CardContent>
      </>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle>Registrieren</CardTitle>
        <CardDescription>
          Nach der Registrierung bekommst du einen Login-Link per E-Mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteForm token={token} />
      </CardContent>
    </>
  );
}
