CREATE TABLE "ltc_weekly_sheet_connection" (
	"id" text PRIMARY KEY NOT NULL,
	"sheet_url" text NOT NULL,
	"connected_by_per_id" text NOT NULL,
	"connected_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
