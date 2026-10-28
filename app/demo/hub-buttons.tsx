"use client";

import { Check, RotateCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { startDemoTour } from "@/components/demo/demo-tour-card";
import { Button } from "@/components/ui/button";
import { resetDemoAction } from "./actions";

export function StartTourButton() {
  return (
    <Button size="lg" onClick={() => startDemoTour("manual")}>
      Rundgang starten
    </Button>
  );
}

export function ResetButton() {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await resetDemoAction();
          setDone(true);
        })
      }
    >
      {done ? <Check aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
      {done ? "Zurückgesetzt" : "Demo zurücksetzen"}
    </Button>
  );
}
