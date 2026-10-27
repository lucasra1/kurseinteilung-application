import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { env } from "@/lib/env";
import type { Qualifications } from "@/lib/staffing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CurrentUser = Qualifications & {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  isAdmin: boolean;
  isEnvAdmin: boolean;
};

/** Admins listed in ADMIN_EMAILS are always admins and can't be demoted in the UI. */
export function isEnvAdmin(email: string): boolean {
  return env.ADMIN_EMAILS.includes(email.toLowerCase());
}

/** The logged-in user with their profile, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  // Session checks compare token expiry with the current time: request-time only.
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId));
  if (!profile) return null;

  const envAdmin = isEnvAdmin(profile.email);
  return {
    id: profile.id,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    isInstruktor: profile.isInstruktor,
    isPraxisanleiter: profile.isPraxisanleiter,
    isAdmin: profile.isAdmin || envAdmin,
    isEnvAdmin: envAdmin,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/termine");
  return user;
}
