import { sql } from "drizzle-orm";
import { connection, type NextRequest, NextResponse } from "next/server";
import { resetDemo } from "@/lib/dal/demo";
import { db } from "@/lib/db/client";
import { env } from "@/lib/env";

/**
 * Called daily by Vercel Cron (see vercel.json) so the free Supabase project never
 * pauses for inactivity. Vercel sends CRON_SECRET as a Bearer token. The demo instance
 * starts over every day, with dates counted from the new day.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  await connection();
  await db.execute(sql`select 1`);
  if (env.DEMO_MODE) await resetDemo();
  return NextResponse.json({ ok: true });
}
