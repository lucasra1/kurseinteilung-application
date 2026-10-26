import "server-only";
import { eq } from "drizzle-orm";
import type { z } from "zod";
import { requireAdmin } from "@/lib/dal/auth";
import { lockedTermin, mutateStaffing } from "@/lib/dal/staffing-tx";
import { db, type Tx } from "@/lib/db/client";
import { kurse, termine } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { kursSchema, terminSchema } from "@/lib/validation";

export type KursInput = z.infer<typeof kursSchema>;
export type TerminInput = z.infer<typeof terminSchema>;

async function terminIdsOfKurs(tx: Tx, kursId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: termine.id })
    .from(termine)
    .where(eq(termine.kursId, kursId));
  return rows.map((row) => row.id);
}

export async function createKurs(input: KursInput): Promise<string> {
  await requireAdmin();
  const [row] = await db
    .insert(kurse)
    .values(input)
    .returning({ id: kurse.id });
  return row.id;
}

/** Staffing numbers can change roles in every Termin of the Kurs, so this goes through mutateStaffing. */
export async function updateKurs(id: string, input: KursInput): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    actorId: admin.id,
    terminIds: (tx) => terminIdsOfKurs(tx, id),
    run: async (tx) => {
      const [updated] = await tx
        .update(kurse)
        .set(input)
        .where(eq(kurse.id, id))
        .returning({ id: kurse.id });
      if (!updated) throw new DomainError("nicht-gefunden");
    },
  });
}

export async function deleteKurs(id: string): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    actorId: admin.id,
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
  await requireAdmin();
  const [kurs] = await db
    .select({ id: kurse.id })
    .from(kurse)
    .where(eq(kurse.id, kursId));
  if (!kurs) throw new DomainError("nicht-gefunden");
  await db.insert(termine).values({ ...input, kursId });
}

/** Date, time, topic and location don't affect roles: a plain update. */
export async function updateTermin(
  id: string,
  input: TerminInput,
): Promise<void> {
  await requireAdmin();
  const [updated] = await db
    .update(termine)
    .set(input)
    .where(eq(termine.id, id))
    .returning({ id: termine.id });
  if (!updated) throw new DomainError("nicht-gefunden");
}

export async function deleteTermin(id: string): Promise<{ kursId: string }> {
  const admin = await requireAdmin();
  return mutateStaffing({
    actorId: admin.id,
    terminIds: async () => [id],
    run: async (tx, locked) => {
      const termin = lockedTermin(locked, id);
      await tx.delete(termine).where(eq(termine.id, id));
      return { kursId: termin.kursId };
    },
  });
}
