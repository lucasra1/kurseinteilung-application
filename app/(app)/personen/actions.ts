"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import { removePerson, setAdmin } from "@/lib/dal/profiles";
import { regenerateInviteToken } from "@/lib/dal/settings";
import { uuidSchema } from "@/lib/validation";

export async function toggleAdmin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { profileId, isAdmin } = z
      .object({ profileId: uuidSchema, isAdmin: z.enum(["true", "false"]) })
      .parse(Object.fromEntries(formData));
    await setAdmin(profileId, isAdmin === "true");
  });
}

export async function deletePerson(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { profileId } = z
      .object({ profileId: uuidSchema })
      .parse(Object.fromEntries(formData));
    await removePerson(profileId);
    return "Person entfernt.";
  });
}

export async function newInviteLink(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await regenerateInviteToken();
    return "Neuer Einladungslink erstellt. Der alte Link funktioniert nicht mehr.";
  });
}
