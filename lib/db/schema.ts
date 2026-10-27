import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import type { AuditType } from "@/lib/audit";

export const appSchema = pgSchema("app");

export const profiles = appSchema.table("profiles", {
  id: uuid()
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  fullName: text().notNull(),
  email: text().notNull().unique(),
  phone: text(),
  isAdmin: boolean().notNull().default(false),
  isInstruktor: boolean().notNull().default(false),
  isPraxisanleiter: boolean().notNull().default(false),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const kurse = appSchema.table("kurse", {
  id: uuid().primaryKey().defaultRandom(),
  title: text().notNull(),
  description: text().notNull().default(""),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const termine = appSchema.table(
  "termine",
  {
    id: uuid().primaryKey().defaultRandom(),
    kursId: uuid()
      .notNull()
      .references(() => kurse.id, { onDelete: "cascade" }),
    date: date({ mode: "string" }).notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    topic: text().notNull(),
    location: text(),
    instruktorenNeeded: integer().notNull().default(0),
    praxisanleiterNeeded: integer().notNull().default(0),
    /** Set manually by a coordinator; see `isFestgeschrieben` in lib/staffing.ts. */
    festgeschrieben: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("termine_time_check", sql`${t.endTime} > ${t.startTime}`),
    check(
      "termine_staffing_check",
      sql`${t.instruktorenNeeded} >= 0 and ${t.praxisanleiterNeeded} >= 0 and ${t.instruktorenNeeded} + ${t.praxisanleiterNeeded} >= 1`,
    ),
    index().on(t.kursId),
  ],
);

export const signups = appSchema.table(
  "signups",
  {
    id: uuid().primaryKey().defaultRandom(),
    terminId: uuid()
      .notNull()
      .references(() => termine.id, { onDelete: "cascade" }),
    profileId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    /** The role this person signed up for; see lib/staffing.ts. */
    kind: text().$type<"instruktor" | "praxisanleiter">().notNull(),
    position: integer().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.terminId, t.profileId),
    check(
      "signups_kind_check",
      sql`${t.kind} in ('instruktor', 'praxisanleiter')`,
    ),
    index().on(t.terminId, t.position),
    index().on(t.profileId),
    check("signups_position_check", sql`${t.position} >= 1`),
  ],
);

/**
 * The Verlauf; types and `data` shapes in lib/audit.ts. No foreign keys, so entries outlive
 * the Termine, Kurse and people they describe.
 */
export const auditEvents = appSchema.table(
  "audit_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Shared by all entries of one action. */
    actionId: uuid().notNull(),
    actorId: uuid(),
    /** The actor's name at the time of the action. */
    actorName: text().notNull(),
    type: text().$type<AuditType>().notNull(),
    terminId: uuid(),
    kursId: uuid(),
    /** The person affected. */
    profileId: uuid(),
    data: jsonb().notNull().default({}),
  },
  (t) => [
    index().on(t.terminId, t.createdAt),
    index().on(t.kursId, t.createdAt),
    index().on(t.profileId, t.createdAt),
    index().on(t.actorId, t.createdAt),
  ],
);

export const appSettings = appSchema.table(
  "app_settings",
  {
    id: integer().primaryKey(),
    inviteToken: text().notNull(),
  },
  (t) => [check("app_settings_singleton_check", sql`${t.id} = 1`)],
);
