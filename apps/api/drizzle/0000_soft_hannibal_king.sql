CREATE TABLE "ltc_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"actor_per_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ltc_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"type" text DEFAULT 'MEETING' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"campus_id" text NOT NULL,
	"scope" text DEFAULT 'CAMPUS' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"chair_per_id" text NOT NULL,
	"participant_per_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"conflict_note" text DEFAULT '' NOT NULL,
	"revision_note" text DEFAULT '' NOT NULL,
	"cancellation_note" text,
	"department_domain" text,
	"approvals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by_per_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "ltc_events_campus_id_check" CHECK ("ltc_events"."campus_id" IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')),
	CONSTRAINT "ltc_events_scope_check" CHECK ("ltc_events"."scope" IN ('CAMPUS', 'SCHOOL_WIDE')),
	CONSTRAINT "ltc_events_status_check" CHECK ("ltc_events"."status" IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED', 'CANCELLED'))
);
--> statement-breakpoint
CREATE TABLE "ltc_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"campus_id" text NOT NULL,
	"assignee_per_id" text NOT NULL,
	"collaborator_per_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ASSIGNED' NOT NULL,
	"evidence_url" text DEFAULT '' NOT NULL,
	"acceptance_note" text DEFAULT '' NOT NULL,
	"cancellation_reason" text,
	"created_by_per_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ltc_tasks_campus_id_check" CHECK ("ltc_tasks"."campus_id" IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')),
	CONSTRAINT "ltc_tasks_status_check" CHECK ("ltc_tasks"."status" IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'COMPLETED', 'RETURNED', 'CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "ltc_tasks" ADD CONSTRAINT "ltc_tasks_event_id_ltc_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ltc_events"("id") ON DELETE set null ON UPDATE no action;