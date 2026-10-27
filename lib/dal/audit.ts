import "server-only";
import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Actor, AuditEntry, AuditEvent } from "@/lib/audit";
import { type HistoryView, historyGroups } from "@/lib/audit-text";
import { requireAdmin } from "@/lib/dal/auth";
import { db, type Tx } from "@/lib/db/client";
import { auditEvents, kurse, profiles, termine } from "@/lib/db/schema";
import {
  type Bereich,
  bereichTypes,
  type ExistingSubjects,
  type HistorySource,
  type SubjectKind,
} from "@/lib/history-source";
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
 * About PAGE_SIZE entries matching `filter`, never splitting an action: all of its entries
 * share one `created_at` (the transaction's `now()`), and a page always ends between two
 * timestamps. Without a `filter`, all entries.
 */
async function historyPage(
  filter: SQL | undefined,
  cursor?: string,
): Promise<HistoryPage> {
  const where = cursor
    ? and(filter, lt(auditEvents.createdAt, sql`${cursor}::timestamptz`))
    : filter;
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
    select().where(and(filter, eq(auditEvents.createdAt, atBoundary))),
    select()
      .where(and(filter, lt(auditEvents.createdAt, atBoundary)))
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

const SUBJECT_FILTER: Record<SubjectKind, (id: string) => SQL> = {
  termin: (id) => eq(auditEvents.terminId, id),
  // The Kurs and its Termine, also deleted ones.
  kurs: (id) => eq(auditEvents.kursId, id),
  // What happened to the person and what they did themselves.
  person: (id) =>
    or(eq(auditEvents.profileId, id), eq(auditEvents.actorId, id)) as SQL,
};

/** An entry of the same part of an action as the one being filtered. */
const sibling = alias(auditEvents, "sibling");

/**
 * Whole parts of actions (an action's entries on one Termin, or those on none) with an
 * entry of the Bereich, so a filtered group keeps its main entry and its consequences.
 */
function inBereich(bereich: Bereich): SQL {
  const { withoutTermin, onTermin } = bereichTypes(bereich);
  return exists(
    db
      .select({ one: sql`1` })
      .from(sibling)
      .where(
        and(
          eq(sibling.actionId, auditEvents.actionId),
          sql`${sibling.terminId} is not distinct from ${auditEvents.terminId}`,
          or(
            and(isNull(sibling.terminId), inArray(sibling.type, withoutTermin)),
            and(isNotNull(sibling.terminId), inArray(sibling.type, onTermin)),
          ),
        ),
      ),
  );
}

/** Which of the entries' Termine, Kurse and people still exist. */
async function existingSubjects(
  events: AuditEvent[],
): Promise<ExistingSubjects> {
  const found = async (
    table: typeof termine | typeof kurse | typeof profiles,
    key: "terminId" | "kursId" | "profileId",
  ) => {
    const ids = [...new Set(events.flatMap((e) => e[key] ?? []))];
    if (ids.length === 0) return new Set<string>();
    const rows = await db
      .select({ id: table.id })
      .from(table)
      .where(inArray(table.id, ids));
    return new Set(rows.map((row) => row.id));
  };
  const [termin, kurs, person] = await Promise.all([
    found(termine, "terminId"),
    found(kurse, "kursId"),
    found(profiles, "profileId"),
  ]);
  return { termin, kurs, person };
}

/**
 * A page of the Verlauf of a Termin, Kurs or person, or of all entries (of one Bereich),
 * older than `cursor`. Admins only.
 */
export async function getHistory(
  source: HistorySource,
  cursor?: string,
): Promise<HistoryView> {
  await requireAdmin();
  const page = await historyPage(filterOf(source), cursor);
  // Only the Verlauf page links to what each group is about.
  const existing =
    source.scope === "all" ? await existingSubjects(page.events) : undefined;
  return {
    groups: historyGroups(page.events, source.scope, existing),
    nextCursor: page.nextCursor,
  };
}

/** The entries `source` names; undefined for all of them. */
function filterOf(source: HistorySource): SQL | undefined {
  if (source.scope === "all") {
    return source.bereich && inBereich(source.bereich);
  }
  // A malformed id (from the URL) names nothing; Postgres would reject comparing it.
  if (!uuidSchema.safeParse(source.id).success) return sql`false`;
  return SUBJECT_FILTER[source.scope](source.id);
}
