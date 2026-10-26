"use server";

import { type ActionResult, runAction } from "@/lib/action-result";
import { updateOwnProfile } from "@/lib/dal/profiles";
import { profileSchema } from "@/lib/validation";

export async function saveProfile(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await updateOwnProfile(profileSchema.parse(Object.fromEntries(formData)));
    return "Gespeichert.";
  });
}
