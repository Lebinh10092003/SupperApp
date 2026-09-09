import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

/**
 * reports — tin báo từ cổng công khai (Luồng 2), port từ Firestore
 * collection `reports`. Chốt 2026-09-09 sau khi đọc hết `safety.js`
 * (submitReport, createIncidentFromReport, confirmIncidentCloseByReporter).
 */
export const reports = pgTable('reports', {
  reportId: text('report_id').primaryKey(),
  publicCode: text('public_code').notNull(),
  channel: text('channel').notNull().default('public_web'),
  campusId: text('campus_id').notNull(),
  categoryCode: text('category_code').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  occurredFrom: timestamp('occurred_from', { withTimezone: true }),
  occurredTo: timestamp('occurred_to', { withTimezone: true }),
  // Luôn false từ quyết định 07/09/2026 (bỏ gửi ẩn danh) — giữ cột lại
  // không xoá để không vỡ dữ liệu cũ đã có anonymous=true trước đó.
  anonymous: boolean('anonymous').notNull().default(false),
  stillDangerous: boolean('still_dangerous').notNull().default(false),
  confidentiality: text('confidentiality').notNull(),
  content: text('content').notNull().default(''),
  className: text('class_name'),
  reporterRole: text('reporter_role'),
  zoneIds: jsonb('zone_ids').$type<string[]>(),
  zoneId: text('zone_id'),
  mergedIntoIncidentId: text('merged_into_incident_id'),
  // Chỉ có khi hồ sơ tạo TRỰC TIẾP từ cổng nội bộ bởi người đã đăng nhập —
  // KHÁC hẳn "người báo tin ẩn danh công khai", không liên quan report_identities.
  createdByPerId: text('created_by_per_id'),
  suggestedZoneIds: jsonb('suggested_zone_ids').$type<string[]>(),
  suggestedClassNames: jsonb('suggested_class_names').$type<string[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});

/**
 * report_identities — danh tính người báo tin, TÁCH RIÊNG khỏi nội dung
 * tin báo (mục VI.4 "Tách danh tính khỏi nội dung"). doc ID Firestore gốc
 * = reportId (1-1 với reports).
 */
export const reportIdentities = pgTable('report_identities', {
  reportId: text('report_id').primaryKey(),
  contactName: text('contact_name'),
  contactChannel: text('contact_channel'),
  safeContactTime: text('safe_contact_time'),
  email: text('email'),
  phone: text('phone')
});
