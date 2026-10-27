"use server";

import { z } from "zod";
import type { HistoryView } from "@/components/history-list";
import { type ActionResult, runAction } from "@/lib/action-result";
import { historyGroups } from "@/lib/audit-text";
import { personHistory } from "@/lib/dal/audit";
import { removePerson, setAdmin, setQualification } from "@/lib/dal/profiles";
import { regenerateInviteToken } from "@/lib/dal/settings";
import { isBestaetigt, kindSchema, uuidSchema } from "@/lib/validation";

export async function toggleAdmin(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { profileId, isAdmin } = z
      .object({ profileId: uuidSchema, isAdmin: z.enum(["true", "false"]) })
      .parse(Object.fromEntries(formData));
    await setAdmin(profileId, isAdmin === "true");
  });
}

export async function toggleQualification(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { profileId, kind, value } = z
      .object({
        profileId: uuidSchema,
        kind: kindSchema,
        value: z.enum(["true", "false"]),
      })
      .parse(Object.fromEntries(formData));
    await setQualification(profileId, kind, value === "true");
  });
}

export async function deletePerson(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    const { profileId } = z
      .object({ profileId: uuidSchema })
      .parse(Object.fromEntries(formData));
    await removePerson(profileId, isBestaetigt(formData));
    return "Person entfernt.";
  });
}

/** Older Verlauf entries of a person for "Mehr anzeigen"; admins only (via personHistory). */
export async function morePersonHistory(
  profileId: string,
  cursor: string,
): Promise<HistoryView> {
  const page = await personHistory(
    uuidSchema.parse(profileId),
    z.iso.datetime().parse(cursor),
  );
  return {
    groups: historyGroups(page.events, "person"),
    nextCursor: page.nextCursor,
  };
}

export async function newInviteLink(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return runAction(async () => {
    await regenerateInviteToken();
    return "Neuer Einladungslink erstellt. Der alte Link funktioniert nicht mehr.";
  });
}
