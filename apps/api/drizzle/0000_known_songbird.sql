CREATE TABLE "accounts" (
	"uid" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"created_by_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"role_id" text NOT NULL,
	"campus_id" text,
	"domain" text,
	"from_date" timestamp with time zone,
	"to_date" timestamp with time zone,
	"ceiling" text,
	"created_by_uid" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by_uid" text,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "delegations" (
	"id" text PRIMARY KEY NOT NULL,
	"to_per_id" text NOT NULL,
	"campus_id" text,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duty_shifts" (
	"id" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"from_at" timestamp with time zone NOT NULL,
	"to_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_supervisor_assignments" (
	"grade" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "homeroom_assignments" (
	"class_name" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"name" text
);
--> statement-breakpoint
CREATE TABLE "people_directory" (
	"per_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "campus_map_markers" (
	"marker_id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"icon_key" text NOT NULL,
	"x_percent" double precision NOT NULL,
	"y_percent" double precision NOT NULL,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campus_zones" (
	"zone_id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"label" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"map_image_key" text,
	"polygon_percent" jsonb NOT NULL,
	"shape_type" text DEFAULT 'rect' NOT NULL,
	"rotation_deg" double precision DEFAULT 0 NOT NULL,
	"category_id" text,
	"color" text,
	"parent_zone_id" text,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zone_categories" (
	"category_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "evidence" (
	"evidence_id" text PRIMARY KEY NOT NULL,
	"report_id" text,
	"storage_path" text NOT NULL,
	"file_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"extension" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"scan_status" text NOT NULL,
	"uploaded_at" timestamp with time zone NOT NULL,
	"linked_at" timestamp with time zone,
	"expires_unlinked_at" timestamp with time zone,
	"deleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "id_counters" (
	"prefix" text NOT NULL,
	"period" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "id_counters_prefix_period_pk" PRIMARY KEY("prefix","period")
);
--> statement-breakpoint
CREATE TABLE "public_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"incident_id" text PRIMARY KEY NOT NULL,
	"campus_id" text NOT NULL,
	"category_code" text NOT NULL,
	"class_name" text,
	"suggested_class_names" jsonb,
	"reporter_role" text,
	"zone_ids" jsonb,
	"zone_id" text,
	"priority" text NOT NULL,
	"confidentiality" text NOT NULL,
	"state" text NOT NULL,
	"report_ids" jsonb,
	"commander_per_id" text,
	"assigned_task_per_ids" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_per_id_idx" ON "accounts" USING btree ("per_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_per_role_idx" ON "assignments" USING btree ("per_id","role_id");--> statement-breakpoint
CREATE INDEX "assignments_per_id_idx" ON "assignments" USING btree ("per_id");--> statement-breakpoint
CREATE INDEX "assignments_campus_id_idx" ON "assignments" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "delegations_to_per_id_idx" ON "delegations" USING btree ("to_per_id");--> statement-breakpoint
CREATE INDEX "duty_shifts_per_id_idx" ON "duty_shifts" USING btree ("per_id");