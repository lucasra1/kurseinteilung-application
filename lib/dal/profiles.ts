import "server-only";
import { eq } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { requireUser } from "@/lib/dal/auth";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { supabaseService } from "@/lib/supabase/service";

/**
 * Unguarded, internal: creates the Supabase auth user (unless one exists) and the profile.
 * Only called from the auth flows after they checked the invite token or ADMIN_EMAILS.
 */
export async function createAccount(input: {
  email: string;
  fullName: string;
  phone: string | null;
}): Promise<string> {
  const [existing] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, input.email));

  let userId = existing?.id;
  if (!userId) {
    const { data, error } = await supabaseService.auth.admin.createUser({
      email: input.email,
      email_confirm: true,
    });
    if (error) throw error;
    userId = data.user.id;
  }

  await db
    .insert(profiles)
    .values({
      id: userId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
    })
    .onConflictDoNothing();
  return userId;
}

export async function updateOwnProfile(input: {
  fullName: string;
  phone: string | null;
}): Promise<void> {
  const user = await requireUser();
  await db
    .update(profiles)
    .set({ fullName: input.fullName, phone: input.phone })
    .where(eq(profiles.id, user.id));
}
