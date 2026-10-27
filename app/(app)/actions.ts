"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { type DataResult, runQuery } from "@/lib/action-result";
import {
  BEREICHE,
  type HistorySource,
  type HistoryView,
  SUBJECT_KINDS,
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
  source: z.discriminatedUnion("scope", [
    z.object({ scope: z.enum(SUBJECT_KINDS), id: uuidSchema }),
    z.object({ scope: z.literal("all"), bereich: z.enum(BEREICHE).optional() }),
  ]),
  cursor: z.iso.datetime(),
});

/** Older Verlauf entries for "Mehr anzeigen"; admins only (via `getHistory`). */
export async function moreHistory(
  source: HistorySource,
  cursor: string,
): Promise<DataResult<HistoryView>> {
  return runQuery(async () => {
    const input = moreHistoryInput.parse({ source, cursor });
    return getHistory(input.source, input.cursor);
  });
}
