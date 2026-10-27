"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import {
  createKursWithTermine,
  createTermin,
  deleteKurs,
  deleteTermin,
  updateKurs,
  updateTermin,
} from "@/lib/dal/kurse";
import {
  bestaetigtSchema,
  kursSchema,
  parseTerminRows,
  terminSchema,
  uuidSchema,
} from "@/lib/validation";

const idForm = z.object({ id: uuidSchema });

/** "Neuer Kurs": the Kurs fields plus one set of Termin fields per row. */
export async function createKursAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const kurs = kursSchema.parse(Object.fromEntries(formData));
    const id = await createKursWithTermine(kurs, parseTerminRows(formData));
    redirect(`/kurse/${id}`);
  });
}

export async function saveKurs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    await updateKurs(idForm.parse(values).id, kursSchema.parse(values));
    return "Kurs gespeichert.";
  });
}

export async function removeKurs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await deleteKurs(idForm.parse(Object.fromEntries(formData)).id);
    redirect("/kurse");
  });
}

export async function addTermin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    const { kursId } = z.object({ kursId: uuidSchema }).parse(values);
    await createTermin(kursId, terminSchema.parse(values));
    return "Termin angelegt.";
  });
}

export async function saveTermin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    const { id, bestaetigt } = idForm
      .extend({ bestaetigt: bestaetigtSchema })
      .parse(values);
    await updateTermin(id, terminSchema.parse(values), bestaetigt);
    return "Gespeichert.";
  });
}

export async function removeTermin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await deleteTermin(idForm.parse(Object.fromEntries(formData)).id);
    return "Termin gelöscht.";
  });
}
