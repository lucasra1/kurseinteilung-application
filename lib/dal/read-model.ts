import "server-only";
import { and, asc, eq, gte, inArray, type SQL } from "drizzle-orm";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { requireAdmin, requireUser } from "@/lib/dal/auth";
import { todayInVienna } from "@/lib/dates";
import { db } from "@/lib/db/client";
import { kurse, profiles, signups, termine } from "@/lib/db/schema";
import {
  capacity,
  type Role,
  rankSignups,
  type StaffingStatus,
  staffingStatus,
} from "@/lib/staffing";
import { uuidSchema } from "@/lib/validation";

export type SignupView = {
  profileId: string;
  fullName: string;
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
  date: string;
  startTime: string;
  endTime: string;
  topic: string;
  location: string | null;
  trainersNeeded: number;
  backupsNeeded: number;
  signups: S[];
  trainerCount: number;
  backupCount: number;
  status: StaffingStatus;
  isFull: boolean;
  isPast: boolean;
};

export type KursView<S = SignupView> = {
  id: string;
  title: string;
  description: string;
  trainersNeeded: number;
  backupsNeeded: number;
  termine: TerminView<S>[];
};

type Filter = { kursId?: string; terminId?: string; upcomingOnly?: boolean };

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
      .select()
      .from(termine)
      .where(and(...terminConditions))
      .orderBy(asc(termine.date), asc(termine.startTime)),
  ]);

  const signupRows =
    terminRows.length > 0
      ? await db
          .select({
            terminId: signups.terminId,
            profileId: signups.profileId,
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
    trainersNeeded: kurs.trainersNeeded,
    backupsNeeded: kurs.backupsNeeded,
    termine: terminRows
      .filter((termin) => termin.kursId === kurs.id)
      .map((termin) => {
        const ranked = rankSignups(
          signupRows.filter((s) => s.terminId === termin.id),
          kurs,
        ).map((s) => ({
          profileId: s.profileId,
          fullName: s.fullName,
          email: s.email,
          phone: s.phone,
          rank: s.rank,
          role: s.role,
        }));
        return {
          id: termin.id,
          kursId: termin.kursId,
          date: termin.date,
          startTime: termin.startTime,
          endTime: termin.endTime,
          topic: termin.topic,
          location: termin.location,
          trainersNeeded: kurs.trainersNeeded,
          backupsNeeded: kurs.backupsNeeded,
          signups: ranked,
          trainerCount: ranked.filter((s) => s.role === "trainer").length,
          backupCount: ranked.filter((s) => s.role === "backup").length,
          status: staffingStatus(ranked.length, kurs),
          isFull: ranked.length >= capacity(kurs),
          isPast: termin.date < today,
        };
      }),
  }));
}

function withoutContacts(kurs: KursView<AdminSignupView>): KursView {
  return {
    ...kurs,
    termine: kurs.termine.map((termin) => ({
      ...termin,
      signups: termin.signups.map(({ profileId, fullName, rank, role }) => ({
        profileId,
        fullName,
        rank,
        role,
      })),
    })),
  };
}

/** Upcoming Termine (today and later) grouped by Kurs, without contact details. */
export async function getUpcomingKurse(): Promise<KursView[]> {
  await requireUser();
  const kursViews = await loadKursViews({ upcomingOnly: true });
  return kursViews
    .filter((kurs) => kurs.termine.length > 0)
    .sort((a, b) => a.termine[0].date.localeCompare(b.termine[0].date))
    .map(withoutContacts);
}

/** All Kurse (also those without Termine) with contact details; past Termine on request. */
export async function getAdminKurse(opts: {
  includePast: boolean;
}): Promise<KursView<AdminSignupView>[]> {
  await requireAdmin();
  return loadKursViews({ upcomingOnly: !opts.includePast });
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
