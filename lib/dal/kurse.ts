import "server-only";
import { eq, inArray } from "drizzle-orm";
import type { z } from "zod";
import { requireAdmin } from "@/lib/dal/auth";
import { lockedTermin, mutateStaffing } from "@/lib/dal/staffing-tx";
import { todayInVienna } from "@/lib/dates";
import { db, type Tx } from "@/lib/db/client";
import { kurse, termine } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { type FestschreibungResult, isFestgeschrieben } from "@/lib/staffing";
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
  await requireAdmin();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(kurse)
      .values(input)
      .returning({ id: kurse.id });
    if (termineInput.length > 0) {
      await tx
        .insert(termine)
        .values(termineInput.map((termin) => ({ ...termin, kursId: row.id })));
    }
    return row.id;
  });
}

/** Title and description don't affect roles: a plain update. */
export async function updateKurs(id: string, input: KursInput): Promise<void> {
  await requireAdmin();
  const [updated] = await db
    .update(kurse)
    .set(input)
    .where(eq(kurse.id, id))
    .returning({ id: kurse.id });
  if (!updated) throw new DomainError("nicht-gefunden");
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
  await requireAdmin();
  const [kurs] = await db
    .select({ id: kurse.id })
    .from(kurse)
    .where(eq(kurse.id, kursId));
  if (!kurs) throw new DomainError("nicht-gefunden");
  await db.insert(termine).values({ ...input, kursId });
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

/**
 * Sets (`value` true) or lifts the manual Festschreibung of the upcoming Termine among
 * `terminIds`. Goes through mutateStaffing although it changes no roles yet: lifting it
 * will release held places once Ausschreibung exists. The Verlauf gets one entry per
 * Termin whose flag changed; no mails.
 */
export async function setFestgeschrieben(
  terminIds: string[],
  value: boolean,
): Promise<FestschreibungResult> {
  const admin = await requireAdmin();
  const today = todayInVienna();
  return mutateStaffing({
    action: {
      type: value ? "termin.festgeschrieben" : "termin.aufgehoben",
      actor: admin,
      target: { terminIds },
    },
    terminIds: async () => terminIds,
    run: async (tx, locked) => {
      const upcoming = [...locked.values()].filter((t) => t.date >= today);
      const changed = upcoming.filter((t) => t.festgeschrieben !== value);
      if (changed.length > 0) {
        await tx
          .update(termine)
          .set({ festgeschrieben: value })
          .where(
            inArray(
              termine.id,
              changed.map((t) => t.id),
            ),
          );
      }
      return {
        changed: changed.length,
        automatisch: value
          ? 0
          : upcoming.filter((t) =>
              isFestgeschrieben({ ...t, festgeschrieben: false }, today),
            ).length,
      };
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
