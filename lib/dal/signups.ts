import "server-only";
import { eq } from "drizzle-orm";
import { requireAdmin, requireUser } from "@/lib/dal/auth";
import {
  appendSignup,
  lockedTermin,
  mutateStaffing,
  removeSignup,
} from "@/lib/dal/staffing-tx";
import { isPastDate } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { profiles, signups } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import { sortByPosition } from "@/lib/staffing";

export async function signUpSelf(terminId: string): Promise<void> {
  const user = await requireUser();
  await mutateStaffing({
    actorId: user.id,
    terminIds: async () => [terminId],
    run: async (tx, termine) => {
      const termin = lockedTermin(termine, terminId);
      if (isPastDate(termin.date)) throw new DomainError("termin-vorbei");
      await appendSignup(tx, termin, user.id);
    },
  });
}

export async function withdrawSelf(terminId: string): Promise<void> {
  const user = await requireUser();
  await mutateStaffing({
    actorId: user.id,
    terminIds: async () => [terminId],
    run: async (tx, termine) => {
      const termin = lockedTermin(termine, terminId);
      if (isPastDate(termin.date)) throw new DomainError("termin-vorbei");
      await removeSignup(tx, termin.id, user.id);
    },
  });
}

// Admin changes: also allowed for past Termine.

export async function adminAddSignup(
  terminId: string,
  profileId: string,
): Promise<void> {
  const admin = await requireAdmin();
  const [person] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId));
  if (!person) throw new DomainError("nicht-gefunden");
  await mutateStaffing({
    actorId: admin.id,
    terminIds: async () => [terminId],
    run: async (tx, termine) => {
      await appendSignup(tx, lockedTermin(termine, terminId), profileId);
    },
  });
}

export async function adminRemoveSignup(
  terminId: string,
  profileId: string,
): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    actorId: admin.id,
    terminIds: async () => [terminId],
    run: async (tx, termine) => {
      await removeSignup(tx, lockedTermin(termine, terminId).id, profileId);
    },
  });
}

/** Swaps a person with their neighbor in signup order; does nothing at either end. */
export async function adminMoveSignup(
  terminId: string,
  profileId: string,
  direction: "up" | "down",
): Promise<void> {
  const admin = await requireAdmin();
  await mutateStaffing({
    actorId: admin.id,
    terminIds: async () => [terminId],
    run: async (tx, termine) => {
      lockedTermin(termine, terminId);
      const ordered = sortByPosition(
        await tx
          .select({
            id: signups.id,
            profileId: signups.profileId,
            position: signups.position,
            createdAt: signups.createdAt,
          })
          .from(signups)
          .where(eq(signups.terminId, terminId)),
      );
      const index = ordered.findIndex((s) => s.profileId === profileId);
      if (index === -1) throw new DomainError("nicht-eingetragen");
      const neighbor = ordered[direction === "up" ? index - 1 : index + 1];
      if (!neighbor) return;

      const current = ordered[index];
      await tx
        .update(signups)
        .set({ position: neighbor.position })
        .where(eq(signups.id, current.id));
      await tx
        .update(signups)
        .set({ position: current.position })
        .where(eq(signups.id, neighbor.id));
    },
  });
}
