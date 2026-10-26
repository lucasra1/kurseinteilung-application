"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import { signUpSelf, withdrawSelf } from "@/lib/dal/signups";
import { uuidSchema } from "@/lib/validation";

const signupFormSchema = z.object({
  terminId: uuidSchema,
  intent: z.enum(["eintragen", "abmelden"]),
});

/** One action for both directions, so the button's form keeps a stable action. */
export async function changeSignup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { terminId, intent } = signupFormSchema.parse(
      Object.fromEntries(formData),
    );
    if (intent === "eintragen") {
      await signUpSelf(terminId);
      return "Du bist eingetragen.";
    }
    await withdrawSelf(terminId);
    return "Du bist ausgetragen.";
  });
}
