import "server-only";
import { requireUser } from "@/lib/dal/auth";
import {
  appendSignup,
  lockedTermin,
  mutateStaffing,
  removeSignup,
} from "@/lib/dal/staffing-tx";
import { isPastDate } from "@/lib/dates";
import { DomainError } from "@/lib/errors";

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
