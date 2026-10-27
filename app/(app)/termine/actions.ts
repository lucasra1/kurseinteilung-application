"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import {
  adminAddSignup,
  adminMoveSignup,
  adminRemoveSignup,
  signUpSelf,
  withdrawSelf,
} from "@/lib/dal/signups";
import { kindSchema, uuidSchema } from "@/lib/validation";

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
    const values = Object.fromEntries(formData);
    const { terminId, intent } = signupFormSchema.parse(values);
    if (intent === "eintragen") {
      await signUpSelf(terminId, kindSchema.parse(values.kind));
      return "Du bist eingetragen.";
    }
    await withdrawSelf(terminId);
    return "Du bist ausgetragen.";
  });
}

const adminSignupForm = z.object({
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
    const values = Object.fromEntries(formData);
    const { terminId, profileId } = adminSignupForm.parse(values);
    await adminAddSignup(terminId, profileId, kindSchema.parse(values.kind));
    return "Eingetragen.";
  });
}

export async function removeSignupAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { terminId, profileId } = adminSignupForm.parse(
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
    const { terminId, profileId } = adminSignupForm.parse(values);
    const { direction } = z
      .object({ direction: z.enum(["up", "down"]) })
      .parse(values);
    await adminMoveSignup(terminId, profileId, direction);
  });
}
