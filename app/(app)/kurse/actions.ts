"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { HistoryView } from "@/components/history-list";
import { type ActionResult, runAction } from "@/lib/action-result";
import { historyGroups } from "@/lib/audit-text";
import { kursHistory } from "@/lib/dal/audit";
import {
  createKursWithTermine,
  createTermin,
  deleteKurs,
  deleteTermin,
  updateKurs,
  updateTermin,
} from "@/lib/dal/kurse";
import {
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
    await updateTermin(idForm.parse(values).id, terminSchema.parse(values));
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

/** Older Verlauf entries of a Kurs for "Mehr anzeigen"; admins only (via kursHistory). */
export async function moreKursHistory(
  kursId: string,
  cursor: string,
): Promise<HistoryView> {
  const page = await kursHistory(
    uuidSchema.parse(kursId),
    z.iso.datetime().parse(cursor),
  );
  return {
    groups: historyGroups(page.events, "kurs"),
    nextCursor: page.nextCursor,
  };
}
