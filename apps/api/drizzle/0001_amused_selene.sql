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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_supplements" (
	"supplement_id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
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
CREATE INDEX "course_announcements_course_idx" ON "course_announcements" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_coursework_course_idx" ON "course_coursework" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_materials_course_idx" ON "course_materials" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_members_course_role_idx" ON "course_members" USING btree ("course_id","role");--> statement-breakpoint
CREATE INDEX "course_submissions_course_idx" ON "course_submissions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "course_topics_course_idx" ON "course_topics" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "sync_runs_started_at_idx" ON "sync_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "meet_attendance_session_idx" ON "meet_attendance" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "meet_sessions_date_idx" ON "meet_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "meet_sessions_status_idx" ON "meet_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schedules_day_period_idx" ON "schedules" USING btree ("day_of_week","period");--> statement-breakpoint
CREATE INDEX "schedules_import_batch_idx" ON "schedules" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "schedules_space_name_idx" ON "schedules" USING btree ("space_name");