import { defineConfig } from "drizzle-kit";

try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local (e.g. CI or production migrations): rely on the environment.
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  casing: "snake_case",
  schemaFilter: ["app"],
  // On Vercel, migrations run during the build over the session pooler from the Supabase integration.
  dbCredentials: {
    url: (process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL) as string,
  },
});
