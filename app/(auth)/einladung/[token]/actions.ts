"use server";

import { type ActionResult, runAction } from "@/lib/action-result";
import { registerViaInvite } from "@/lib/dal/auth-flows";
import { inviteSchema } from "@/lib/validation";

export async function register(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { token, ...input } = inviteSchema.parse(
      Object.fromEntries(formData),
    );
    await registerViaInvite(token, input);
    return "Wir haben dir einen Login-Link geschickt. Schau in dein Postfach.";
  });
}
