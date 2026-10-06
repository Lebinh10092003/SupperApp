CREATE TABLE "saved_case_filters" (
	"id" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"name" text NOT NULL,
	"filter_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "unclaimed_escalation_tier" integer DEFAULT 0 NOT NULL;
