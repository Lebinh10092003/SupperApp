CREATE TABLE "admin_notifications" (
	"notification_id" text PRIMARY KEY NOT NULL,
	"recipient_per_id" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"event_type" text,
	"object_id" text,
	"actor_per_id" text,
	"meta" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL
);
