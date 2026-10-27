"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-lg font-semibold">Etwas ist schiefgelaufen.</h1>
      <p className="text-sm text-muted-foreground">
        Bitte versuch es nochmal. Wenn der Fehler bleibt, melde dich bei einer
        Praxisanleiterkoordinator:in.
      </p>
      <Button onClick={() => retry()}>Nochmal versuchen</Button>
    </div>
  );
}
