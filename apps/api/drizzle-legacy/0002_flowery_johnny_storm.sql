CREATE TABLE "events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
