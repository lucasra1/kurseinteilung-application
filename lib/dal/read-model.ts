import "server-only";
import {
  and,
  asc,
  eq,
  getTableColumns,
  gte,
  inArray,
  type SQL,
  sql,
} from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAdmin, requireUser } from "@/lib/dal/auth";
import { todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { kurse, profiles, signups, termine } from "@/lib/db/schema";
import {
  isFestgeschrieben,
  type Kind,
  type Missing,
  missingPlaces,
  type Role,
  rankSignups,
} from "@/lib/staffing";
import { uuidSchema } from "@/lib/validation";

export type SignupView = {
  profileId: string;
  fullName: string;
  kind: Kind;
  /** 1-based within the kind. */
  rank: number;
  role: Role;
};

export type AdminSignupView = SignupView & {
  email: string;
  phone: string | null;
};

export type TerminView<S = SignupView> = {
  id: string;
  kursId: string;
  kursTitle: string;
  kursDescription: string;
  /** 1-based position among all Termine of the Kurs, e.g. "Tag 2 von 3". */
  dayIndex: number;
  dayCount: number;
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  location: string | null;
  instruktorenNeeded: number;
  praxisanleiterNeeded: number;
  /** In signup order. */
  signups: S[];
  /** Free fixed places per kind. */
  missing: Missing;
  /** Every fixed place is taken. */
  isStaffed: boolean;
  isPast: boolean;
  /** The staffing is binding: set manually or at most 3 months away (`isFestgeschrieben`). */
  festgeschrieben: boolean;
  /** The manual flag; Aufheben clears it. */
  festgeschriebenManuell: boolean;
};

export type KursView<S = SignupView> = {
  id: string;
  title: string;
  description: string;
  termine: TerminView<S>[];
};

type Filter = { kursId?: string; terminId?: string; upcomingOnly?: boolean };

// Numbers every Termin within its Kurs before any filter applies.
const numbered = db
  .select({
    id: termine.id,
    dayIndex:
      sql<number>`(row_number() over (partition by ${termine.kursId} order by ${termine.date}, ${termine.startTime}))::int`.as(
        "day_index",
      ),
    dayCount:
      sql<number>`(count(*) over (partition by ${termine.kursId}))::int`.as(
        "day_count",
      ),
  })
  .from(termine)
  .as("numbered");

/** Loads Kurse with their Termine and ranked signups, including contact details. */
async function loadKursViews(
  filter: Filter = {},
): Promise<KursView<AdminSignupView>[]> {
  // Request-time data: "today" and the signups must never be part of a prerender.
  await connection();
  const today = todayInVienna();
  const kursConditions: SQL[] = [];
  if (filter.kursId) kursConditions.push(eq(kurse.id, filter.kursId));
  const terminConditions: SQL[] = [];
  if (filter.kursId) terminConditions.push(eq(termine.kursId, filter.kursId));
  if (filter.terminId) terminConditions.push(eq(termine.id, filter.terminId));
  if (filter.upcomingOnly) terminConditions.push(gte(termine.date, today));

  const [kursRows, terminRows] = await Promise.all([
    db
      .select()
      .from(kurse)
      .where(and(...kursConditions))
      .orderBy(asc(kurse.title)),
    db
      .select({
        ...getTableColumns(termine),
        dayIndex: numbered.dayIndex,
        dayCount: numbered.dayCount,
      })
      .from(termine)
      .innerJoin(numbered, eq(numbered.id, termine.id))
      .where(and(...terminConditions))
      .orderBy(asc(termine.date), asc(termine.startTime)),
  ]);

  const signupRows =
    terminRows.length > 0
      ? await db
          .select({
            terminId: signups.terminId,
            profileId: signups.profileId,
            kind: signups.kind,
            position: signups.position,
            createdAt: signups.createdAt,
            fullName: profiles.fullName,
            email: profiles.email,
            phone: profiles.phone,
          })
          .from(signups)
          .innerJoin(profiles, eq(signups.profileId, profiles.id))
          .where(
            inArray(
              signups.terminId,
              terminRows.map((t) => t.id),
            ),
          )
      : [];

  return kursRows.map((kurs) => ({
    id: kurs.id,
    title: kurs.title,
    description: kurs.description,
    termine: terminRows
      .filter((termin) => termin.kursId === kurs.id)
      .map((termin) => {
        const ranked = rankSignups(
          signupRows.filter((s) => s.terminId === termin.id),
          termin,
        ).map((s) => ({
          profileId: s.profileId,
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          kind: s.kind,
          rank: s.rank,
          role: s.role,
        }));
        const missing = missingPlaces(ranked, termin);
        return {
          id: termin.id,
          kursId: termin.kursId,
          kursTitle: kurs.title,
          kursDescription: kurs.description,
          dayIndex: termin.dayIndex,
          dayCount: termin.dayCount,
          date: termin.date,
          startTime: termin.startTime,
          endTime: termin.endTime,
          topic: termin.topic,
          location: termin.location,
          instruktorenNeeded: termin.instruktorenNeeded,
          praxisanleiterNeeded: termin.praxisanleiterNeeded,
          signups: ranked,
          missing,
          isStaffed: missing.instruktor + missing.praxisanleiter === 0,
          isPast: termin.date < today,
          festgeschrieben: isFestgeschrieben(termin, today),
          festgeschriebenManuell: termin.festgeschrieben,
        };
      }),
  }));
}

function withoutContacts(termin: TerminView<AdminSignupView>): TerminView {
  return {
    ...termin,
    signups: termin.signups.map(
      ({ profileId, fullName, kind, rank, role }) => ({
        profileId,
        fullName,
        kind,
        rank,
        role,
      }),
    ),
  };
}

/** All Termine of the given Kurse in one list, in date order. */
function inDateOrder<S>(kursViews: KursView<S>[]): TerminView<S>[] {
  return kursViews
    .flatMap((kurs) => kurs.termine)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.startTime.localeCompare(b.startTime) ||
        a.kursTitle.localeCompare(b.kursTitle),
    );
}

/** Upcoming Termine (today and later) of all Kurse, without contact details. */
export async function getUpcomingTermine(): Promise<TerminView[]> {
  await requireUser();
  const kursViews = await loadKursViews({ upcomingOnly: true });
  return inDateOrder(kursViews).map(withoutContacts);
}

/** A single Termin, also a past one, without contact details; null if unknown. */
export async function findTermin(id: string): Promise<TerminView | null> {
  await requireUser();
  if (!uuidSchema.safeParse(id).success) return null;
  const [termin] = inDateOrder(await loadKursViews({ terminId: id }));
  return termin ? withoutContacts(termin) : null;
}

/** All Termine with contact details, in date order; past ones on request. */
export async function getAdminTermine(opts: {
  includePast: boolean;
}): Promise<TerminView<AdminSignupView>[]> {
  await requireAdmin();
  return inDateOrder(await loadKursViews({ upcomingOnly: !opts.includePast }));
}

/** A single Termin with contact details; null if unknown. */
export async function findAdminTermin(
  id: string,
): Promise<TerminView<AdminSignupView> | null> {
  await requireAdmin();
  if (!uuidSchema.safeParse(id).success) return null;
  const [termin] = inDateOrder(await loadKursViews({ terminId: id }));
  return termin ?? null;
}

/** All Kurse (also those without Termine) with all their Termine and contact details. */
export async function getAdminKurse(): Promise<KursView<AdminSignupView>[]> {
  await requireAdmin();
  return loadKursViews();
}

export async function getAdminKurs(
  id: string,
): Promise<KursView<AdminSignupView>> {
  await requireAdmin();
  if (!uuidSchema.safeParse(id).success) notFound();
  const [kurs] = await loadKursViews({ kursId: id });
  if (!kurs) notFound();
  return kurs;
}
