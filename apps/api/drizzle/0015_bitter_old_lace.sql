CREATE TABLE "ltc_weekly_sheet_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"row_date" date NOT NULL,
	"time_label" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"people" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_per_id" text,
	"updated_by_per_id" text,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);