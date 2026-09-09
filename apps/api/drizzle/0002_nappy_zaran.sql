CREATE TABLE "audit_logs" (
	"log_id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_per_id" text NOT NULL,
	"on_behalf_of_per_id" text,
	"role_used" text,
	"ip" text,
	"device" text,
	"action" text NOT NULL,
	"object_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"reason" text,
	"request_id" text,
	"correlation_id" text
);
