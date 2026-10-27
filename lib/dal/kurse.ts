import "server-only";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import {
  kursCreatedEvents,
  kursUpdatedEvents,
  terminCreatedEvent,
} from "@/lib/audit";
import { logEvents } from "@/lib/dal/audit";
import { requireAdmin } from "@/lib/dal/auth";
import { lockedTermin, mutateStaffing } from "@/lib/dal/staffing-tx";
import { db, type Tx } from "@/lib/db/client";
import { kurse, termine } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { kursSchema, TerminInput } from "@/lib/validation";

export type KursInput = z.infer<typeof kursSchema>;

async function terminIdsOfKurs(tx: Tx, kursId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: termine.id })
    .from(termine)
    .where(eq(termine.kursId, kursId));
  return rows.map((row) => row.id);
}

/** Creates a Kurs together with its first Termine; nobody is signed up yet, so no emails. */
export async function createKursWithTermine(
  input: KursInput,
  termineInput: TerminInput[],
): Promise<string> {
  const admin = await requireAdmin();
  return db.transaction(async (tx) => {
    const [kurs] = await tx
      .insert(kurse)
      .values(input)
      .returning({ id: kurse.id, title: kurse.title });
    const created =
      termineInput.length > 0
        ? await tx
            .insert(termine)
            .values(
              termineInput.map((termin) => ({ ...termin, kursId: kurs.id })),
            )
            .returning()
        : [];
    await logEvents(tx, admin, kursCreatedEvents(kurs, created));
    return kurs.id;
  });
}

/** Title and description don't affect roles: a plain update. Unchanged, it writes nothing. */
export async function updateKurs(id: string, input: KursInput): Promise<void> {
  const admin = await requireAdmin();
  await db.transaction(async (tx) => {
    const [was] = await tx
      .select({ title: kurse.title, description: kurse.description })
      .from(kurse)
      .where(eq(kurse.id, id))
      .for("update");
    if (!was) throw new DomainError("nicht-gefunden");
    const entries = kursUpdatedEvents(id, was, input);
    if (entries.length === 0) return;
    await tx.update(kurse).set(input).where(eq(kurse.id, id));
    await logEvents(tx, admin, entries);
  });
}

export async function deleteKurs(id: string): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    action: { type: "kurs.deleted", actor: admin, target: { kursId: id } },
    terminIds: (tx) => terminIdsOfKurs(tx, id),
    run: async (tx) => {
      const [deleted] = await tx
        .delete(kurse)
        .where(eq(kurse.id, id))
        .returning({ id: kurse.id });
      if (!deleted) throw new DomainError("nicht-gefunden");
    },
  });
}

export async function createTermin(
  kursId: string,
  input: TerminInput,
): Promise<void> {
  const admin = await requireAdmin();
  await db.transaction(async (tx) => {
    const [kurs] = await tx
      .select({ title: kurse.title })
      .from(kurse)
      .where(eq(kurse.id, kursId));
    if (!kurs) throw new DomainError("nicht-gefunden");
    const [created] = await tx
      .insert(termine)
      .values({ ...input, kursId })
      .returning();
    await logEvents(tx, admin, [terminCreatedEvent(kurs.title, created)]);
  });
}

/** The staffing numbers decide who holds a fixed place, so this goes through mutateStaffing. */
export async function updateTermin(
  id: string,
  input: TerminInput,
): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    action: { type: "termin.updated", actor: admin, target: { terminId: id } },
    terminIds: async () => [id],
    run: async (tx, locked) => {
      lockedTermin(locked, id);
      await tx.update(termine).set(input).where(eq(termine.id, id));
    },
  });
}

export async function deleteTermin(id: string): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    action: { type: "termin.deleted", actor: admin, target: { terminId: id } },
    terminIds: async () => [id],
    run: async (tx, locked) => {
      lockedTermin(locked, id);
      await tx.delete(termine).where(eq(termine.id, id));
    },
  });
}
