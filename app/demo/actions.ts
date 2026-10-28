"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  ensureDemoData,
  markOwnDemoMailsRead,
  resetDemo,
  setDemoPersona,
} from "@/lib/dal/demo";
import { uuidSchema } from "@/lib/validation";

// Demo mode only: the DAL functions refuse to run otherwise.

export async function switchPersona(profileId: string): Promise<void> {
  await setDemoPersona(uuidSchema.parse(profileId));
  refresh();
}

/** "Selbst ausprobieren": show the app as this person. */
export async function enterAs(formData: FormData): Promise<void> {
  await ensureDemoData();
  await setDemoPersona(uuidSchema.parse(formData.get("profileId")));
  redirect("/termine");
}

export async function resetDemoAction(): Promise<void> {
  await resetDemo();
  refresh();
}

export async function markMailsRead(): Promise<void> {
  await markOwnDemoMailsRead();
  refresh();
}
