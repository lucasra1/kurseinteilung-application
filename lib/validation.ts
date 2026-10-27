import { ZodError, z } from "zod";

/** Optional text field: missing or blank becomes null. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || null);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }));

export const uuidSchema = z.uuid({ error: "Ungültige ID." });

const fullName = z
  .string({ error: "Bitte gib deinen Namen ein." })
  .trim()
  .min(1, { error: "Bitte gib deinen Namen ein." });

export const loginSchema = z.object({ email: emailSchema });

export const inviteSchema = z.object({
  token: z.string().min(1),
  fullName,
  email: emailSchema,
  phone: optionalText,
});

export const profileSchema = z.object({
  fullName,
  phone: optionalText,
});

export const kursSchema = z.object({
  title: z.string().trim().min(1, { error: "Bitte gib einen Titel ein." }),
  description: z.string().trim().default(""),
  trainersNeeded: z.coerce
    .number()
    .int()
    .min(1, { error: "Es braucht mindestens einen Trainer pro Termin." }),
  backupsNeeded: z.coerce
    .number()
    .int()
    .min(0, { error: "Die Anzahl Backups darf nicht negativ sein." }),
});

const time = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, {
    error: "Bitte gib eine gültige Uhrzeit ein.",
  })
  .transform((value) => value.slice(0, 5));

export const terminSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
      error: "Bitte gib ein gültiges Datum ein.",
    }),
    startTime: time,
    endTime: time,
    topic: z.string().trim().min(1, { error: "Bitte gib ein Thema ein." }),
    location: optionalText,
  })
  .refine((t) => t.endTime > t.startTime, {
    path: ["endTime"],
    error: "Das Ende muss nach dem Beginn liegen.",
  });

export type TerminInput = z.infer<typeof terminSchema>;

/**
 * Parses the repeated Termin fields of the "Neuer Kurs" form (one value per row, in
 * order). Messages name the row, e.g. "Tag 2: Bitte gib ein Thema ein."
 */
export function parseTerminRows(formData: FormData): TerminInput[] {
  const column = (name: string) => formData.getAll(name).map(String);
  const dates = column("date");
  const startTimes = column("startTime");
  const endTimes = column("endTime");
  const topics = column("topic");
  const locations = column("location");
  if (dates.length === 0) {
    throw new ZodError([
      {
        code: "custom",
        message: "Bitte leg mindestens einen Termin an.",
        path: ["termine"],
        input: undefined,
      },
    ]);
  }
  return dates.map((date, index) => {
    const result = terminSchema.safeParse({
      date,
      startTime: startTimes[index],
      endTime: endTimes[index],
      topic: topics[index],
      location: locations[index],
    });
    if (!result.success) {
      throw new ZodError(
        result.error.issues.map((issue) => ({
          ...issue,
          message: `Tag ${index + 1}: ${issue.message}`,
        })),
      );
    }
    return result.data;
  });
}
