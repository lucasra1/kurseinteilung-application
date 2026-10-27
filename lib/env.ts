import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  RESEND_API_KEY: z
    .string()
    .optional()
    .transform((value) => value || undefined),
  EMAIL_FROM: z.string().min(1),
  APP_URL: z.url().transform((value) => value.replace(/\/$/, "")),
  ADMIN_EMAILS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  CRON_SECRET: z.string().min(1),
});

export const env = envSchema.parse({
  ...process.env,
  // On Vercel, the Supabase integration provides the transaction pooler URL as POSTGRES_URL.
  DATABASE_URL: process.env.DATABASE_URL || process.env.POSTGRES_URL,
});
