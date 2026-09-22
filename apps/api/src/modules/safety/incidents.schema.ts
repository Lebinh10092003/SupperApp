import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * incidents — BẢN CUỐI (chốt 2026-09-09 sau khi Hestia + Killshot đọc hết
 * `safety.js` 1147 dòng, đối chiếu chéo độc lập, khớp nhau). Port từ
 * Firestore collection `incidents`.
 */
export const incidents = pgTable('incidents', {
  incidentId: text('incident_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  categoryCode: text('category_code').notNull(),
  className: text('class_name'),
  suggestedClassNames: jsonb('suggested_class_names').$type<string[]>(),
  reporterRole: text('reporter_role'),
  priority: text('priority').notNull(),
  confidentiality: text('confidentiality').notNull(),
  state: text('state').notNull(),
  reportIds: jsonb('report_ids').$type<string[]>(),
  commanderPerId: text('commander_per_id'),
  assignedTaskPerIds: jsonb('assigned_task_per_ids').$type<string[]>(),
  version: integer('version').notNull().default(1),
  // Ghi chú tự do lần chuyển trạng thái gần nhất (transitionIncidentStatus).
  lastNote: text('last_note'),
  // Mốc chuyển "Đề nghị đóng" — dùng tính fallback REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS
  // (3 ngày) cho phép nhân viên tự đóng nếu người báo tin không phản hồi.
  closeRequestedAt: timestamp('close_requested_at', { withTimezone: true }),
  // Giá trị là actor.perId HOẶC literal 'REPORTER' (khi người báo tin tự
  // xác nhận đóng qua confirmIncidentCloseByReporter) — KHÔNG FK cứng vì
  // có giá trị đặc biệt không phải perId thật.
  closedBy: text('closed_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  reporterCloseConfirmedAt: timestamp('reporter_close_confirmed_at', { withTimezone: true }),
  reopenedBy: text('reopened_by'),
  reopenedAt: timestamp('reopened_at', { withTimezone: true }),
  reopenReason: text('reopen_reason'),
  // Thang cảnh báo "chưa ai tiếp nhận" cho P2/P3 (24h/48h/72h, bổ sung
  // 2026-09-22, xem jobs/check-unclaimed-incidents.ts) — 0 = chưa báo lần
  // nào, 1/2/3 = đã báo tới đúng mốc nào rồi (chống báo lặp lại cùng 1
  // mốc). Reset về 0 khi có người tiếp nhận (không còn cần theo dõi nữa)
  // hoặc khi đổi mức ưu tiên (hạn tính lại từ đầu).
  unclaimedEscalationTier: integer('unclaimed_escalation_tier').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
