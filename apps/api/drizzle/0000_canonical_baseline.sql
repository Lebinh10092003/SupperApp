CREATE TABLE "alert_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"threshold" numeric(8, 2) NOT NULL,
	"unit" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"severity" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"rule_id" text NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"category" text DEFAULT 'CLASSROOM' NOT NULL,
	"target_id" text,
	"target_name" text,
	"class_id" text,
	"message" text NOT NULL,
	"action" text,
	"resolved" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'NEW' NOT NULL,
	"resolution" text,
	"principal_notes" text,
	"assignee_email" text,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "general_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"actor" text NOT NULL,
	"status" text DEFAULT 'SUCCESS' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"message" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raw_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"type" text DEFAULT 'CLASS' NOT NULL,
	"grade" integer,
	"subject" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"class_id" text PRIMARY KEY NOT NULL,
	"class_name" text NOT NULL,
	"grade" integer,
	"active" boolean DEFAULT true NOT NULL,
	"homeroom_teacher" text,
	"course_count" integer DEFAULT 0 NOT NULL,
	"courses" jsonb DEFAULT '[]'::jsonb,
	"subjects" jsonb DEFAULT '[]'::jsonb,
	"student_count" integer DEFAULT 0 NOT NULL,
	"total_coursework" integer DEFAULT 0 NOT NULL,
	"submissions_total" integer DEFAULT 0 NOT NULL,
	"submissions_turned_in" integer DEFAULT 0 NOT NULL,
	"submissions_late" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 1),
	"on_time_rate" numeric(5, 1),
	"average_score" numeric(5, 2),
	"expected_students" integer,
	"room" text,
	"teacher_email" text,
	"source" text DEFAULT 'CLASSROOM_SYNC' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_mappings" (
	"course_id" text PRIMARY KEY NOT NULL,
	"course_name" text NOT NULL,
	"class_id" text NOT NULL,
	"class_name" text NOT NULL,
	"grade" integer,
	"confidence" numeric(3, 2) NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_coursework" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"course_work_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_materials" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_members" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"name" text,
	"photo_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"course_work_id" text,
	"course_work_title" text,
	"max_points" numeric(6, 2),
	"due_date" jsonb,
	"due_time" jsonb,
	"is_turned_in" boolean DEFAULT false NOT NULL,
	"is_late" boolean DEFAULT false NOT NULL,
	"is_graded" boolean DEFAULT false NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_topics" (
	"id" text PRIMARY KEY NOT NULL,
	"course_id" text NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"section" text,
	"description_heading" text,
	"description" text,
	"room" text,
	"owner_id" text,
	"course_state" text DEFAULT 'ACTIVE' NOT NULL,
	"alternate_link" text,
	"calendar_id" text,
	"gradebook_settings" jsonb,
	"creation_time" timestamp with time zone,
	"update_time" timestamp with time zone,
	"class_id" text,
	"class_name" text,
	"grade" integer,
	"subject_id" text,
	"subject_name" text,
	"roster_teachers" integer DEFAULT 0 NOT NULL,
	"roster_students" integer DEFAULT 0 NOT NULL,
	"roster_status" text DEFAULT 'DATA_UNAVAILABLE' NOT NULL,
	"content_coursework" integer DEFAULT 0 NOT NULL,
	"content_materials" integer DEFAULT 0 NOT NULL,
	"content_announcements" integer DEFAULT 0 NOT NULL,
	"content_topics" integer DEFAULT 0 NOT NULL,
	"submissions_total" integer DEFAULT 0 NOT NULL,
	"submissions_turned_in" integer DEFAULT 0 NOT NULL,
	"submissions_late" integer DEFAULT 0 NOT NULL,
	"submissions_graded" integer DEFAULT 0 NOT NULL,
	"completion_rate" numeric(5, 1),
	"on_time_rate" numeric(5, 1),
	"average_score" numeric(5, 2),
	"content_status" text DEFAULT 'DATA_UNAVAILABLE' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_run_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_mappings" (
	"course_id" text PRIMARY KEY NOT NULL,
	"course_name" text NOT NULL,
	"subject_id" text NOT NULL,
	"subject_name" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'CLASSROOM_SYNC' NOT NULL,
	"status" text NOT NULL,
	"performed_by" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"courses_total" integer DEFAULT 0 NOT NULL,
	"courses_success" integer DEFAULT 0 NOT NULL,
	"courses_error" integer DEFAULT 0 NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "google_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"uid" text,
	"email" text,
	"name" text,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"token_expires_at" timestamp with time zone,
	"scopes" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_snapshot" (
	"id" text PRIMARY KEY DEFAULT 'current' NOT NULL,
	"kpis" jsonb NOT NULL,
	"school_health" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metrics_daily" (
	"date" text PRIMARY KEY NOT NULL,
	"students" integer DEFAULT 0 NOT NULL,
	"teachers" integer DEFAULT 0 NOT NULL,
	"active_courses" integer DEFAULT 0 NOT NULL,
	"online_students" integer DEFAULT 0 NOT NULL,
	"open_alerts" integer DEFAULT 0 NOT NULL,
	"attendance_rate" numeric(5, 1),
	"submission_rate" numeric(5, 1),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"event_id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"lease_until" timestamp with time zone,
	"attempts" integer DEFAULT 1 NOT NULL,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_group_members" (
	"group_id" text NOT NULL,
	"per_id" text NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_group_members_pkey" PRIMARY KEY("group_id","per_id")
);
--> statement-breakpoint
CREATE TABLE "contact_groups" (
	"group_id" text PRIMARY KEY NOT NULL,
	"owner_per_id" text,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"phone" text,
	"display_name" text
);
--> statement-breakpoint
CREATE TABLE "meet_attendance" (
	"id" text PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"email" text,
	"name" text,
	"status" text NOT NULL,
	"duration_minutes" integer DEFAULT 0 NOT NULL,
	"join_time" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meet_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"conference_name" text NOT NULL,
	"raw" text,
	"date" text NOT NULL,
	"schedule_id" uuid,
	"class_id" text,
	"class_name" text,
	"subject" text,
	"teacher_email" text,
	"online_students" integer DEFAULT 0 NOT NULL,
	"joined_students" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"attendance_status" text,
	"attendance_reason" text,
	"roster_size" integer,
	"present" integer,
	"late" integer,
	"absent" integer,
	"attendance_rate" numeric(5, 1),
	"late_rate" numeric(5, 1),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"person_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"display_name" text,
	"photo_url" text,
	"person_type" text NOT NULL,
	"org_unit_path" text,
	"class_name" text,
	"class_id" text,
	"courses" jsonb DEFAULT '[]'::jsonb,
	"suspended" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"zone_id" text,
	"zone_ids" jsonb,
	"reporter_role" text,
	"priority" text,
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
	"unclaimed_escalation_tier" integer DEFAULT 0 NOT NULL,
	"cancel_requested_by" text,
	"cancel_request_reason" text,
	"cancel_requested_at" timestamp with time zone,
	"pending_join_requests" jsonb,
	"resolution_deadline_at" timestamp with time zone,
	"resolution_deadline_set_by" text,
	"extension_requested_by" text,
	"extension_request_reason" text,
	"extension_proposed_deadline_at" timestamp with time zone,
	"extension_requested_at" timestamp with time zone,
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
CREATE TABLE "report_supplements" (
	"supplement_id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
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
	"suggested_class_names" jsonb,
	"suggested_zone_ids" jsonb,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_case_filters" (
	"id" text PRIMARY KEY NOT NULL,
	"per_id" text NOT NULL,
	"kind" text DEFAULT 'safety_cases' NOT NULL,
	"name" text NOT NULL,
	"filter_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
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
	"escalated_at" timestamp with time zone,
	CONSTRAINT "sla_clocks_object_id_clock_label_pk" PRIMARY KEY("object_id","clock_label")
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
CREATE TABLE "schedule_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"imported" integer NOT NULL,
	"status" text DEFAULT 'IMPORTED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rolled_back" integer,
	"rolled_back_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day_of_week" integer NOT NULL,
	"period" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"class_id" text NOT NULL,
	"class_name" text NOT NULL,
	"subject" text NOT NULL,
	"teacher_email" text NOT NULL,
	"course_id" text,
	"meeting_code" text,
	"space_name" text,
	"school_year" text NOT NULL,
	"semester" text NOT NULL,
	"expected_students" integer,
	"late_minutes" integer DEFAULT 10 NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_allowlist" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'VIEWER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"uid" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'TEACHER' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"display_name" text,
	"scope" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"resource_id" text,
	"expiration" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_config" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ltc_exam_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_date" date NOT NULL,
	"session" text DEFAULT '' NOT NULL,
	"period_label" text DEFAULT '' NOT NULL,
	"time_label" text DEFAULT '' NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"class_name" text DEFAULT '' NOT NULL,
	"campus_id" text NOT NULL,
	"first_proctor_per_id" text,
	"second_proctor_per_id" text,
	"first_proctor_name" text,
	"second_proctor_name" text,
	"note" text DEFAULT '' NOT NULL,
	"created_by_per_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ltc_weekly_sheet_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"sheet_url" text NOT NULL,
	"connected_by_per_id" text NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ltc_weekly_sheet_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_date" date NOT NULL,
	"time_label" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"people" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"linked_event_id" uuid,
	"created_by_per_id" text,
	"updated_by_per_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
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
	"end_at" timestamp with time zone,
	"location" text DEFAULT '' NOT NULL,
	"chair_per_id" text NOT NULL,
	"participant_per_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"external_participants" text[] DEFAULT '{}'::text[] NOT NULL,
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
	"parent_task_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"campus_id" text NOT NULL,
	"assignee_per_id" text NOT NULL,
	"collaborator_per_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"start_at" timestamp with time zone,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'ASSIGNED' NOT NULL,
	"evidence_url" text DEFAULT '' NOT NULL,
	"acceptance_note" text DEFAULT '' NOT NULL,
	"cancellation_reason" text,
	"created_by_per_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ltc_tasks_campus_id_check" CHECK ("ltc_tasks"."campus_id" IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')),
	CONSTRAINT "ltc_tasks_status_check" CHECK ("ltc_tasks"."status" IN ('ASSIGNED', 'COMPLETED'))
);
--> statement-breakpoint
ALTER TABLE "contact_group_members" ADD CONSTRAINT "contact_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."contact_groups"("group_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ltc_weekly_sheet_rows" ADD CONSTRAINT "ltc_weekly_sheet_rows_linked_event_id_ltc_events_id_fk" FOREIGN KEY ("linked_event_id") REFERENCES "public"."ltc_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ltc_tasks" ADD CONSTRAINT "ltc_tasks_event_id_ltc_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."ltc_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ltc_tasks" ADD CONSTRAINT "ltc_tasks_parent_task_id_fkey" FOREIGN KEY ("parent_task_id") REFERENCES "public"."ltc_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "course_announcements_course_idx" ON "course_announcements" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_coursework_course_idx" ON "course_coursework" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_materials_course_idx" ON "course_materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_members_course_role_idx" ON "course_members" USING btree ("course_id","role");--> statement-breakpoint
CREATE INDEX "course_submissions_course_idx" ON "course_submissions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_topics_course_idx" ON "course_topics" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_per_id_idx" ON "accounts" USING btree ("per_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_per_role_idx" ON "assignments" USING btree ("per_id","role_id");--> statement-breakpoint
CREATE INDEX "assignments_per_id_idx" ON "assignments" USING btree ("per_id");--> statement-breakpoint
CREATE INDEX "assignments_campus_id_idx" ON "assignments" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "delegations_to_per_id_idx" ON "delegations" USING btree ("to_per_id");--> statement-breakpoint
CREATE INDEX "duty_shifts_per_id_idx" ON "duty_shifts" USING btree ("per_id");--> statement-breakpoint
CREATE INDEX "meet_attendance_session_idx" ON "meet_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "meet_sessions_date_idx" ON "meet_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "meet_sessions_status_idx" ON "meet_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedules_day_period_idx" ON "schedules" USING btree ("day_of_week","period");--> statement-breakpoint
CREATE INDEX "schedules_import_batch_idx" ON "schedules" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "schedules_space_name_idx" ON "schedules" USING btree ("space_name");