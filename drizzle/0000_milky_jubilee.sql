CREATE SCHEMA "app";
--> statement-breakpoint
CREATE TABLE "app"."app_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"invite_token" text NOT NULL,
	CONSTRAINT "app_settings_singleton_check" CHECK ("app"."app_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "app"."kurse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"trainers_needed" integer NOT NULL,
	"backups_needed" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kurse_trainers_needed_check" CHECK ("app"."kurse"."trainers_needed" >= 1),
	CONSTRAINT "kurse_backups_needed_check" CHECK ("app"."kurse"."backups_needed" >= 0)
);
--> statement-breakpoint
CREATE TABLE "app"."profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "app"."signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"termin_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signups_terminId_profileId_unique" UNIQUE("termin_id","profile_id"),
	CONSTRAINT "signups_position_check" CHECK ("app"."signups"."position" >= 1)
);
--> statement-breakpoint
CREATE TABLE "app"."termine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kurs_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"topic" text NOT NULL,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "termine_time_check" CHECK ("app"."termine"."end_time" > "app"."termine"."start_time")
);
--> statement-breakpoint
ALTER TABLE "app"."profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."signups" ADD CONSTRAINT "signups_termin_id_termine_id_fk" FOREIGN KEY ("termin_id") REFERENCES "app"."termine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."signups" ADD CONSTRAINT "signups_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "app"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."termine" ADD CONSTRAINT "termine_kurs_id_kurse_id_fk" FOREIGN KEY ("kurs_id") REFERENCES "app"."kurse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signups_termin_id_position_index" ON "app"."signups" USING btree ("termin_id","position");--> statement-breakpoint
CREATE INDEX "signups_profile_id_index" ON "app"."signups" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "termine_kurs_id_index" ON "app"."termine" USING btree ("kurs_id");