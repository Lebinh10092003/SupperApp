import { pgTable, text, timestamp, boolean, jsonb, primaryKey } from 'drizzle-orm/pg-core';

/**
 * sla_clocks — đồng hồ SLA ack/assign cho từng hồ sơ (S10). Firestore doc ID
 * gốc = `${objectId}.${clockLabel}` (VD "SC.2609.0001.ack") — giữ nguyên ý
 * nghĩa bằng composite PK (objectId, clockLabel) thay vì ghép chuỗi.
 */
export const slaClocks = pgTable('sla_clocks', {
  objectId: text('object_id').notNull(),
  clockLabel: text('clock_label').notNull(), // 'ack' | 'assign'
  priority: text('priority').notNull(),
  startAt: timestamp('start_at', { withTimezone: true }).notNull(),
  deadlineAt: timestamp('deadline_at', { withTimezone: true }).notNull(),
  status: text('status').notNull().default('running'), // running | paused | met | overdue
  paused: boolean('paused').notNull().default(false),
  pauseHistory: jsonb('pause_history').notNull().default([]).$type<Array<{ from: string; to: string | null; reason: string; approved_by: string }>>(),
  // `escalatedAt` — Sin yêu cầu 2026-09-21: trước đây quá hạn ack/assign
  // KHÔNG có bất kỳ chuông/thông báo nào (isOverdue() có sẵn nhưng không
  // nơi nào gọi tới). Cột này đánh dấu ĐÃ báo 1 lần cho đồng hồ này — job
  // check-sla-overdue.ts chỉ báo lại nếu bị reset (đổi mức ưu tiên tính lại
  // hạn mới) hoặc chưa từng báo, tránh spam chuông mỗi 15 phút.
  escalatedAt: timestamp('escalated_at', { withTimezone: true })
}, (table) => [primaryKey({ columns: [table.objectId, table.clockLabel] })]);
