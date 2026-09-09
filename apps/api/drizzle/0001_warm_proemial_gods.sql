CREATE TABLE "report_supplements" (
	"supplement_id" text PRIMARY KEY NOT NULL,
	"report_id" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
