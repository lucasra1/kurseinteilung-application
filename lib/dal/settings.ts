import "server-only";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/dal/auth";
import { db } from "@/lib/db/client";
import { appSettings } from "@/lib/db/schema";

function newInviteToken(): string {
  return randomBytes(18).toString("base64url");
}

/** Loads the single settings row, creating it with a random invite token on first access. */
async function ensureSettings() {
  const [existing] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));
  if (existing) return existing;

  await db
    .insert(appSettings)
    .values({ id: 1, inviteToken: newInviteToken() })
    .onConflictDoNothing();
  const [created] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, 1));
  return created;
}

/** Unguarded: the invite page and registration check the token before anyone is logged in. */
export async function isValidInviteToken(token: string): Promise<boolean> {
  const { inviteToken } = await ensureSettings();
  const given = Buffer.from(token);
  const expected = Buffer.from(inviteToken);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function getInviteToken(): Promise<string> {
  await requireAdmin();
  const { inviteToken } = await ensureSettings();
  return inviteToken;
}

export async function regenerateInviteToken(): Promise<void> {
  await requireAdmin();
  await ensureSettings();
  await db
    .update(appSettings)
    .set({ inviteToken: newInviteToken() })
    .where(eq(appSettings.id, 1));
}
