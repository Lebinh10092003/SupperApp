CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"schema_name" text NOT NULL,
	"display_name" text NOT NULL,
	"kind" text DEFAULT 'school' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_schema_name_idx" ON "tenants" USING btree ("schema_name");