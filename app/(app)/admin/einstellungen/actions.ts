"use server";

import { type ActionResult, runAction } from "@/lib/action-result";
import { regenerateInviteToken } from "@/lib/dal/settings";

export async function newInviteLink(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await regenerateInviteToken();
    return "Neuer Einladungslink erstellt. Der alte Link funktioniert nicht mehr.";
  });
}
