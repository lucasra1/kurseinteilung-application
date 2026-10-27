"use server";

import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import { setFestgeschrieben } from "@/lib/dal/kurse";
import {
  adminAddSignup,
  adminGivePlace,
  adminMoveSignup,
  adminRemoveSignup,
  claimPlace,
  signUpSelf,
  withdrawSelf,
} from "@/lib/dal/signups";
import { bestaetigtSchema, kindSchema, uuidSchema } from "@/lib/validation";
import { festschreibungMessage } from "@/lib/wording";

const signupFormSchema = z.object({
  terminId: uuidSchema,
  intent: z.enum(["eintragen", "abmelden", "uebernehmen"]),
  bestaetigt: bestaetigtSchema,
});

/** One action for the trainer's own signup, so the panel's forms keep a stable action. */
export async function changeSignup(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    const { terminId, intent, bestaetigt } = signupFormSchema.parse(values);
    if (intent === "eintragen") {
      await signUpSelf(terminId, kindSchema.parse(values.kind));
      return "Du bist eingetragen.";
    }
    if (intent === "uebernehmen") {
      await claimPlace(terminId);
      return "Du hast den Platz übernommen.";
    }
    await withdrawSelf(terminId, bestaetigt);
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
    const { terminId, profileId, bestaetigt } = adminSignupForm
      .extend({ bestaetigt: bestaetigtSchema })
      .parse(Object.fromEntries(formData));
    await adminRemoveSignup(terminId, profileId, bestaetigt);
    return "Ausgetragen.";
  });
}

/** "Platz geben" in the admin panel. */
export async function givePlaceAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { terminId, profileId } = adminSignupForm.parse(
      Object.fromEntries(formData),
    );
    await adminGivePlace(terminId, profileId);
    return "Platz gegeben.";
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

const festschreibungForm = z.object({
  intent: z.enum(["festschreiben", "aufheben"]),
  terminIds: z
    .array(uuidSchema)
    .min(1, { error: "Bitte wähl mindestens einen Termin aus." }),
});

/** Festschreiben or Aufheben for the Termine selected in the admin timeline. */
export async function changeFestschreibung(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { intent, terminIds } = festschreibungForm.parse({
      intent: formData.get("intent"),
      terminIds: formData.getAll("terminId"),
    });
    const value = intent === "festschreiben";
    const result = await setFestgeschrieben(terminIds, value);
    return festschreibungMessage(value, result);
  });
}
