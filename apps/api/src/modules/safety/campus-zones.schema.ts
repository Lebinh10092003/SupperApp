import { pgTable, text, integer, doublePrecision, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

/**
 * campus_zones/zone_categories/campus_map_markers — port 1-1 field từ
 * Firestore collection cùng tên (`zoneStats.js`, project An toàn). Ba bảng
 * này thuộc SỞ HỮU RIÊNG của `zoneStats.ts` — không có bảng nào khác trong
 * dự án đọc/ghi trực tiếp, an toàn tạo mới không đụng ai.
 */

export interface PolygonPoint {
  x: number;
  y: number;
}

export const campusZones = pgTable('campus_zones', {
  zoneId: text('zone_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  label: text('label').notNull(),
  order: integer('order').notNull().default(0),
  // LEGACY (ảnh nền trang trí SVG cũ) — không còn dùng ở tầng render, giữ
  // lại để không phá dữ liệu cũ, KHÔNG bắt buộc điền cho zone mới.
  mapImageKey: text('map_image_key'),
  polygonPercent: jsonb('polygon_percent').$type<PolygonPoint[]>().notNull(),
  shapeType: text('shape_type').notNull().default('rect'),
  rotationDeg: doublePrecision('rotation_deg').notNull().default(0),
  categoryId: text('category_id'),
  // Màu RIÊNG của khu vực — ưu tiên CAO HƠN màu nhóm khu vực khi vẽ.
  color: text('color'),
  // Khu vực cha (tuỳ chọn) — dùng để cộng dồn số liệu ở computeZoneStats.
  parentZoneId: text('parent_zone_id'),
  keywords: jsonb('keywords').$type<string[]>().notNull().default([]),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

/** Nhóm khu vực (tên/màu do trường tự đặt) — DÙNG CHUNG cho cả 3 cơ sở, không có campus_id. */
export const zoneCategories = pgTable('zone_categories', {
  categoryId: text('category_id').primaryKey(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  order: integer('order').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

/** Icon đánh dấu trang trí, ĐỘC LẬP với mọi khu vực — không mang ý nghĩa nghiệp vụ/thống kê. */
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
