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
CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"report_id" text,
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
	"last_note" text,
	"close_requested_at" timestamp with time zone,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"reporter_close_confirmed_at" timestamp with time zone,
	"reopened_by" text,
	"reopened_at" timestamp with time zone,
	"reopen_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_identities" (
	"report_id" text PRIMARY KEY NOT NULL,
	"contact_name" text,
	"contact_channel" text,
	"safe_contact_time" text,
	"email" text,
	"phone" text
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"report_id" text PRIMARY KEY NOT NULL,
	"public_code" text NOT NULL,
	"channel" text DEFAULT 'public_web' NOT NULL,
	"campus_id" text NOT NULL,
	"category_code" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"occurred_from" timestamp with time zone,
	"occurred_to" timestamp with time zone,
	"anonymous" boolean DEFAULT false NOT NULL,
	"still_dangerous" boolean DEFAULT false NOT NULL,
	"confidentiality" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"class_name" text,
	"reporter_role" text,
	"zone_ids" jsonb,
	"zone_id" text,
	"merged_into_incident_id" text,
	"created_by_per_id" text,
	"suggested_zone_ids" jsonb,
	"suggested_class_names" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sla_clocks" (
	"object_id" text NOT NULL,
	"clock_label" text NOT NULL,
	"priority" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"pause_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "sla_clocks_object_id_clock_label_pk" PRIMARY KEY("object_id","clock_label")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_per_id_idx" ON "accounts" USING btree ("per_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_per_role_idx" ON "assignments" USING btree ("per_id","role_id");--> statement-breakpoint
CREATE INDEX "assignments_per_id_idx" ON "assignments" USING btree ("per_id");--> statement-breakpoint
CREATE INDEX "assignments_campus_id_idx" ON "assignments" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "delegations_to_per_id_idx" ON "delegations" USING btree ("to_per_id");--> statement-breakpoint
CREATE INDEX "duty_shifts_per_id_idx" ON "duty_shifts" USING btree ("per_id");