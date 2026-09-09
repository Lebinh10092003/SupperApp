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
  pauseHistory: jsonb('pause_history').notNull().default([]).$type<Array<{ from: string; to: string | null; reason: string; approved_by: string }>>()
}, (table) => [primaryKey({ columns: [table.objectId, table.clockLabel] })]);
