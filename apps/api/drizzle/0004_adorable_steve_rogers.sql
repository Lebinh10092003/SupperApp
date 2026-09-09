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
