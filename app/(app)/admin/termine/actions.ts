"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import {
  adminAddSignup,
  adminMoveSignup,
  adminRemoveSignup,
} from "@/lib/dal/signups";
import { uuidSchema } from "@/lib/validation";

const signupForm = z.object({
  terminId: uuidSchema,
  profileId: z
    .string({ error: "Bitte wähle eine Person aus." })
    .min(1, { error: "Bitte wähle eine Person aus." })
    .pipe(uuidSchema),
});

export async function addSignup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { terminId, profileId } = signupForm.parse(
      Object.fromEntries(formData),
    );
    await adminAddSignup(terminId, profileId);
    return "Eingetragen.";
  });
}

export async function removeSignupAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { terminId, profileId } = signupForm.parse(
      Object.fromEntries(formData),
    );
    await adminRemoveSignup(terminId, profileId);
    return "Ausgetragen.";
  });
}

export async function moveSignup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    const { terminId, profileId } = signupForm.parse(values);
    const { direction } = z
      .object({ direction: z.enum(["up", "down"]) })
      .parse(values);
    await adminMoveSignup(terminId, profileId, direction);
  });
}
