DROP TABLE "campus_map_markers" CASCADE;--> statement-breakpoint
DROP TABLE "campus_zones" CASCADE;--> statement-breakpoint
DROP TABLE "zone_categories" CASCADE;--> statement-breakpoint
ALTER TABLE "incidents" DROP COLUMN "zone_ids";--> statement-breakpoint
ALTER TABLE "incidents" DROP COLUMN "zone_id";--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN "zone_ids";--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN "zone_id";--> statement-breakpoint
ALTER TABLE "reports" DROP COLUMN "suggested_zone_ids";