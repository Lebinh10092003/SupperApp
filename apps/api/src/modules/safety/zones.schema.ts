import { boolean, doublePrecision, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Legacy campus-map structures present in the authoritative production
 * schema. They remain source-defined even though the current application has
 * no active route using them, so a fresh canonical database does not silently
 * discard production schema.
 */
export const zoneCategories = pgTable('zone_categories', {
  categoryId: text('category_id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  order: integer('order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

export const campusZones = pgTable('campus_zones', {
  zoneId: text('zone_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  label: text('label').notNull(),
  order: integer('order').notNull().default(0),
  mapImageKey: text('map_image_key'),
  polygonPercent: jsonb('polygon_percent').notNull(),
  shapeType: text('shape_type').notNull().default('rect'),
  rotationDeg: doublePrecision('rotation_deg').notNull().default(0),
  categoryId: text('category_id'),
  color: text('color'),
  parentZoneId: text('parent_zone_id'),
  keywords: jsonb('keywords').notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

export const campusMapMarkers = pgTable('campus_map_markers', {
  markerId: text('marker_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  iconKey: text('icon_key').notNull(),
  xPercent: doublePrecision('x_percent').notNull(),
  yPercent: doublePrecision('y_percent').notNull(),
  color: text('color'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
