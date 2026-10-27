import "server-only";
import { and, desc, eq, lt, or, type SQL, sql } from "drizzle-orm";
import type { Actor, AuditEntry, AuditEvent } from "@/lib/audit";
import {
  type HistoryScope,
  type HistoryView,
  historyGroups,
} from "@/lib/audit-text";
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

type HistoryPage = {
  /** Newest first. */
  events: AuditEvent[];
  nextCursor: string | null;
};

const PAGE_SIZE = 50;

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

const SCOPE_FILTER: Record<HistoryScope, (id: string) => SQL> = {
  termin: (id) => eq(auditEvents.terminId, id),
  // The Kurs and its Termine, also deleted ones.
  kurs: (id) => eq(auditEvents.kursId, id),
  // What happened to the person and what they did themselves.
  person: (id) =>
    or(eq(auditEvents.profileId, id), eq(auditEvents.actorId, id)) as SQL,
};

/** A page of the Verlauf of a Termin, Kurs or person, older than `cursor`. Admins only. */
export async function getHistory(
  scope: HistoryScope,
  id: string,
  cursor?: string,
): Promise<HistoryView> {
  await requireAdmin();
  if (!uuidSchema.safeParse(id).success)
    return { groups: [], nextCursor: null };
  const page = await historyPage(SCOPE_FILTER[scope](id), cursor);
  return {
    groups: historyGroups(page.events, scope),
    nextCursor: page.nextCursor,
  };
}
