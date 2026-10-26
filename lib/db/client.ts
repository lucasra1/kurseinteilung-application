import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
};

// Reuse the client across hot reloads in development so connections don't leak.
const client =
  globalForDb.pgClient ??
  postgres(env.DATABASE_URL, { prepare: false, max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema, casing: "snake_case" });

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
