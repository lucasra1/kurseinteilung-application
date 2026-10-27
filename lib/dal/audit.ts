import "server-only";
import { and, desc, eq, lt, or, type SQL, sql } from "drizzle-orm";
import type { Actor, AuditEntry, AuditEvent } from "@/lib/audit";
import { requireAdmin } from "@/lib/dal/auth";
import { db, type Tx } from "@/lib/db/client";
import { auditEvents } from "@/lib/db/schema";
import { uuidSchema } from "@/lib/validation";

/**
 * Writes the entries of one action under a shared action id. Call inside the transaction
 * of the change itself, so a failed action leaves no entry.
 */
export async function logEvents(
  tx: Tx,
  actor: Actor,
  entries: AuditEntry[],
): Promise<void> {
  if (entries.length === 0) return;
  const actionId = crypto.randomUUID();
  await tx.insert(auditEvents).values(
    entries.map((entry) => ({
      actionId,
      actorId: actor.id,
      actorName: actor.fullName,
      type: entry.type,
      terminId: entry.terminId ?? null,
      kursId: entry.kursId ?? null,
      profileId: entry.profileId ?? null,
      data: entry.data,
    })),
  );
}

export type HistoryPage = {
  /** Newest first. */
  events: AuditEvent[];
  /** Pass to the same reader for older entries; null if there are none. */
  nextCursor: string | null;
};

const PAGE_SIZE = 50;
const EMPTY: HistoryPage = { events: [], nextCursor: null };

// Microsecond precision: a JS Date would round and could skip or repeat entries.
const cursorOf = sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;

/**
 * About PAGE_SIZE entries, never splitting an action: all of its entries share one
 * `created_at` (the transaction's `now()`), and a page always ends between two timestamps.
 */
async function historyPage(scope: SQL, cursor?: string): Promise<HistoryPage> {
  const where = cursor
    ? and(scope, lt(auditEvents.createdAt, sql`${cursor}::timestamptz`))
    : scope;
  const select = () =>
    db
      .select({ row: auditEvents, cursor: cursorOf })
      .from(auditEvents)
      .$dynamic();

  const rows = await select()
    .where(where)
    .orderBy(desc(auditEvents.createdAt))
    .limit(PAGE_SIZE + 1);
  if (rows.length <= PAGE_SIZE)
    return { events: toEvents(rows), nextCursor: null };

  const boundary = rows[PAGE_SIZE - 1].cursor;
  if (rows[PAGE_SIZE].cursor !== boundary) {
    return { events: toEvents(rows.slice(0, PAGE_SIZE)), nextCursor: boundary };
  }
  // The last action on this page continues past PAGE_SIZE: take all of it.
  const atBoundary = sql`${boundary}::timestamptz`;
  const [rest, older] = await Promise.all([
    select().where(and(scope, eq(auditEvents.createdAt, atBoundary))),
    select()
      .where(and(scope, lt(auditEvents.createdAt, atBoundary)))
      .limit(1),
  ]);
  return {
    events: toEvents([...rows.filter((r) => r.cursor !== boundary), ...rest]),
    nextCursor: older.length > 0 ? boundary : null,
  };
}

// The database can't check the type/data pairing; logEvents only writes valid pairs.
function toEvents(rows: { row: typeof auditEvents.$inferSelect }[]) {
  return rows.map(({ row }) => row as AuditEvent);
}

/** Everything that happened on a Termin. Admins only. */
export async function terminHistory(
  terminId: string,
  cursor?: string,
): Promise<HistoryPage> {
  await requireAdmin();
  if (!uuidSchema.safeParse(terminId).success) return EMPTY;
  return historyPage(eq(auditEvents.terminId, terminId), cursor);
}

/** Everything about a Kurs and its Termine, also deleted ones. Admins only. */
export async function kursHistory(
  kursId: string,
  cursor?: string,
): Promise<HistoryPage> {
  await requireAdmin();
  if (!uuidSchema.safeParse(kursId).success) return EMPTY;
  return historyPage(eq(auditEvents.kursId, kursId), cursor);
}

/** What happened to a person and what they did themselves. Admins only. */
export async function personHistory(
  profileId: string,
  cursor?: string,
): Promise<HistoryPage> {
  await requireAdmin();
  if (!uuidSchema.safeParse(profileId).success) return EMPTY;
  return historyPage(
    or(
      eq(auditEvents.profileId, profileId),
      eq(auditEvents.actorId, profileId),
    ) as SQL,
    cursor,
  );
}
