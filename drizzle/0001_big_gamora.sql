ALTER TABLE "app"."kurse" DROP CONSTRAINT "kurse_trainers_needed_check";--> statement-breakpoint
ALTER TABLE "app"."kurse" DROP CONSTRAINT "kurse_backups_needed_check";--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD COLUMN "is_instruktor" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD COLUMN "is_praxisanleiter" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Everyone signed up so far was a trainer, i.e. an Instruktor.
ALTER TABLE "app"."signups" ADD COLUMN "kind" text DEFAULT 'instruktor' NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."signups" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "app"."termine" ADD COLUMN "instruktoren_needed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."termine" ADD COLUMN "praxisanleiter_needed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Existing data: people become Instruktoren, Termine take over their Kurs' trainer count.
UPDATE "app"."profiles" SET "is_instruktor" = true;--> statement-breakpoint
UPDATE "app"."termine" SET "instruktoren_needed" = "app"."kurse"."trainers_needed" FROM "app"."kurse" WHERE "app"."kurse"."id" = "app"."termine"."kurs_id";--> statement-breakpoint
ALTER TABLE "app"."kurse" DROP COLUMN "trainers_needed";--> statement-breakpoint
ALTER TABLE "app"."kurse" DROP COLUMN "backups_needed";--> statement-breakpoint
ALTER TABLE "app"."signups" ADD CONSTRAINT "signups_kind_check" CHECK ("app"."signups"."kind" in ('instruktor', 'praxisanleiter'));--> statement-breakpoint
ALTER TABLE "app"."termine" ADD CONSTRAINT "termine_staffing_check" CHECK ("app"."termine"."instruktoren_needed" >= 0 and "app"."termine"."praxisanleiter_needed" >= 0 and "app"."termine"."instruktoren_needed" + "app"."termine"."praxisanleiter_needed" >= 1);
