CREATE TABLE "notify_requests" (
	"notify_request_id" text PRIMARY KEY NOT NULL,
	"object_id" text NOT NULL,
	"event_type" text,
	"urgency" text NOT NULL,
	"channels" jsonb NOT NULL,
	"simultaneous" boolean DEFAULT false NOT NULL,
	"message" text NOT NULL,
	"recipients" jsonb NOT NULL,
	"require_ack" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"dedupe_keys" jsonb NOT NULL,
	"ack_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_escalated_at" timestamp with time zone,
	"last_escalated_to" text,
	"acknowledged_at" timestamp with time zone,
	"dispatch_log" jsonb,
	"dispatched_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"token" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"user_agent" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
