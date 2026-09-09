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
CREATE UNIQUE INDEX "accounts_per_id_idx" ON "accounts" USING btree ("per_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assignments_per_role_idx" ON "assignments" USING btree ("per_id","role_id");--> statement-breakpoint
CREATE INDEX "assignments_per_id_idx" ON "assignments" USING btree ("per_id");--> statement-breakpoint
CREATE INDEX "assignments_campus_id_idx" ON "assignments" USING btree ("campus_id");--> statement-breakpoint
CREATE INDEX "delegations_to_per_id_idx" ON "delegations" USING btree ("to_per_id");--> statement-breakpoint
CREATE INDEX "duty_shifts_per_id_idx" ON "duty_shifts" USING btree ("per_id");