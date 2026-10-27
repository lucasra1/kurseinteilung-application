import "server-only";
import { isAuthApiError } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { isEnvAdmin } from "@/lib/dal/auth";
import { createAccount } from "@/lib/dal/profiles";
import { isValidInviteToken } from "@/lib/dal/settings";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { DomainError } from "@/lib/errors";
import type { Qualifications } from "@/lib/staffing";
import { supabaseService } from "@/lib/supabase/service";

// Everything here is unguarded: these are the flows that let people log in.

async function hasProfile(email: string): Promise<boolean> {
  const [profile] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.email, email));
  return Boolean(profile);
}

async function sendMagicLink(email: string): Promise<void> {
  const { error } = await supabaseService.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (!error) return;
  if (isAuthApiError(error) && error.status === 429) {
    throw new DomainError("zu-viele-anfragen");
  }
  throw error;
}

/**
 * Sends a magic link to an existing account. Unknown emails get no email but the same
 * response, so the form doesn't reveal who has an account. Emails in ADMIN_EMAILS get
 * an account on their first login.
 */
export async function sendLoginLink(email: string): Promise<void> {
  if (!(await hasProfile(email))) {
    if (!isEnvAdmin(email)) return;
    await createAccount(
      {
        email,
        fullName: email.split("@")[0],
        phone: null,
        isInstruktor: false,
        isPraxisanleiter: false,
      },
      "admin-emails",
    );
  }
  await sendMagicLink(email);
}

export async function registerViaInvite(
  token: string,
  input: {
    fullName: string;
    email: string;
    phone: string | null;
  } & Qualifications,
): Promise<void> {
  if (!(await isValidInviteToken(token))) {
    throw new DomainError("einladung-ungueltig");
  }
  if (!(await hasProfile(input.email))) {
    await createAccount(input, "einladung");
  }
  await sendMagicLink(input.email);
}
