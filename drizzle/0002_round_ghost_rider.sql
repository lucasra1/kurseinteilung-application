CREATE TABLE "app"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"action_id" uuid NOT NULL,
	"actor_id" uuid,
	"actor_name" text NOT NULL,
	"type" text NOT NULL,
	"termin_id" uuid,
	"kurs_id" uuid,
	"profile_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_events_termin_id_created_at_index" ON "app"."audit_events" USING btree ("termin_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_kurs_id_created_at_index" ON "app"."audit_events" USING btree ("kurs_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_profile_id_created_at_index" ON "app"."audit_events" USING btree ("profile_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_actor_id_created_at_index" ON "app"."audit_events" USING btree ("actor_id","created_at");