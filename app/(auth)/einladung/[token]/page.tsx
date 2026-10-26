import Link from "next/link";
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

export default async function InvitePage({
  params,
}: PageProps<"/einladung/[token]">) {
  const { token } = await params;

  if (!(await isValidInviteToken(token))) {
    return (
      <Card>
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
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrieren</CardTitle>
        <CardDescription>
          Nach der Registrierung bekommst du einen Login-Link per E-Mail.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <InviteForm token={token} />
      </CardContent>
    </Card>
  );
}
