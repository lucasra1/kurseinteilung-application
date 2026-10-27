import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgSchema,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

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

export const appSettings = appSchema.table(
  "app_settings",
  {
    id: integer().primaryKey(),
    inviteToken: text().notNull(),
  },
  (t) => [check("app_settings_singleton_check", sql`${t.id} = 1`)],
);
