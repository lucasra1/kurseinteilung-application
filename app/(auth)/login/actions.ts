"use server";

import { type ActionResult, runAction } from "@/lib/action-result";
import { sendLoginLink } from "@/lib/dal/auth-flows";
import { loginSchema } from "@/lib/validation";

export async function requestLoginLink(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { email } = loginSchema.parse(Object.fromEntries(formData));
    await sendLoginLink(email);
    return "Wir haben dir einen Login-Link geschickt. Schau in dein Postfach.";
  });
}
