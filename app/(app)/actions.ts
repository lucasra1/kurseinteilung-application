"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type DataResult, runQuery } from "@/lib/action-result";
import {
  HISTORY_SCOPES,
  type HistoryScope,
  type HistoryView,
} from "@/lib/audit-text";
import { getHistory } from "@/lib/dal/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation";

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const moreHistoryInput = z.object({
  scope: z.enum(HISTORY_SCOPES),
  id: uuidSchema,
  cursor: z.iso.datetime(),
});

/** Older Verlauf entries for "Mehr anzeigen"; admins only (via `getHistory`). */
export async function moreHistory(
  scope: HistoryScope,
  id: string,
  cursor: string,
): Promise<DataResult<HistoryView>> {
  return runQuery(async () => {
    const input = moreHistoryInput.parse({ scope, id, cursor });
    return getHistory(input.scope, input.id, input.cursor);
  });
}
