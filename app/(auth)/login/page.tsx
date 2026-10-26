import { Suspense } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Anmelden</CardTitle>
        <CardDescription>
          Wir schicken dir einen Login-Link per E-Mail.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Suspense fallback={null}>
          <ExpiredLinkNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />
      </CardContent>
    </Card>
  );
}

async function ExpiredLinkNotice({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { fehler } = await searchParams;
  if (fehler !== "link-abgelaufen") return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      Der Login-Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.
    </p>
  );
}
