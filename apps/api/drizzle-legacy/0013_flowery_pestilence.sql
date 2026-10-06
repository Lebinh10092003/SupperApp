ALTER TABLE "incidents" ADD COLUMN "cancel_requested_by" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "cancel_request_reason" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "cancel_requested_at" timestamp with time zone;