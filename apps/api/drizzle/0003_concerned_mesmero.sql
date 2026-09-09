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
