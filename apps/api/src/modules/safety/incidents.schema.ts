import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * incidents — BẢN NHÁP, do Hestia cung cấp (2026-09-09, xem TASKS.md mục
 * H3) chỉ để Killshot không bị chặn khi port `zoneStats.ts`/`classStats.ts`
 * (2 module này đọc thẳng field campus_id/category_code/class_name/
 * zone_ids/zone_id/priority/incident_id/created_at của collection này).
 *
 * KHÔNG PHẢI bản cuối — Hestia sẽ REVIEW + có thể chỉnh field khi port
 * `safety.js` thật (còn ~10 hàm chưa đọc hết: activateP0,
 * transitionIncidentStatus, changeIncidentPriority, reopenIncident,
 * assignCommander, updateIncidentClassification...). KHÔNG thêm cột nghiệp
 * vụ mới vào bảng này ở module khác — chờ Hestia chốt.
 */
export const incidents = pgTable('incidents', {
  incidentId: text('incident_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  categoryCode: text('category_code').notNull(),
  className: text('class_name'),
  suggestedClassNames: jsonb('suggested_class_names').$type<string[]>(),
  reporterRole: text('reporter_role'),
  // Mảng khu vực hiện hành — 1 incident có thể gắn nhiều zone. `zoneId`
  // giữ tương thích ngược cho dữ liệu cũ (= zoneIds[0]).
  zoneIds: jsonb('zone_ids').$type<string[]>(),
  zoneId: text('zone_id'),
  priority: text('priority').notNull(),
  confidentiality: text('confidentiality').notNull(),
  state: text('state').notNull(),
  reportIds: jsonb('report_ids').$type<string[]>(),
  commanderPerId: text('commander_per_id'),
  assignedTaskPerIds: jsonb('assigned_task_per_ids').$type<string[]>(),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
