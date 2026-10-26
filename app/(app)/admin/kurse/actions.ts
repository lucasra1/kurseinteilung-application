"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type ActionResult, runAction } from "@/lib/action-result";
import {
  createKurs,
  createTermin,
  deleteKurs,
  deleteTermin,
  updateKurs,
  updateTermin,
} from "@/lib/dal/kurse";
import { kursSchema, terminSchema, uuidSchema } from "@/lib/validation";

const idForm = z.object({ id: uuidSchema });

export async function saveKurs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const values = Object.fromEntries(formData);
    const input = kursSchema.parse(values);
    if (values.id) {
      await updateKurs(idForm.parse(values).id, input);
      return "Kurs gespeichert.";
    }
    const id = await createKurs(input);
    redirect(`/admin/kurse/${id}`);
  });
}

export async function removeKurs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await deleteKurs(idForm.parse(Object.fromEntries(formData)).id);
    redirect("/admin");
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
    await updateTermin(idForm.parse(values).id, terminSchema.parse(values));
    return "Termin gespeichert.";
  });
}

export async function removeTermin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { kursId } = await deleteTermin(
      idForm.parse(Object.fromEntries(formData)).id,
    );
    redirect(`/admin/kurse/${kursId}`);
  });
}
