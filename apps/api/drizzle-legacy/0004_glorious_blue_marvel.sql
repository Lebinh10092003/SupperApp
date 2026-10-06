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
