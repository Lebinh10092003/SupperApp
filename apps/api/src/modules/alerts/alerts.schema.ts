import { pgTable, text, boolean, numeric, timestamp } from 'drizzle-orm/pg-core';

/**
 * alerts — port từ Firestore collection `alerts`. `status` LUÔN được set
 * ngay khi tạo (mặc định 'NEW') — bản Firestore cũ chỉ set `resolved`
 * lúc tạo, `status` bỏ trống tới khi người dùng thao tác lần đầu, SỬA
 * LUÔN theo quyết định của Sin.
 */
export const alerts = pgTable('alerts', {
  id: text('id').primaryKey(), // deterministic: alert_inactive_<courseId>, alert_late_<courseId>, alert_unmapped_<courseId>
  ruleId: text('rule_id').notNull(),
  title: text('title').notNull(),
  severity: text('severity').notNull(), // INFO | WARNING | HIGH | CRITICAL
  category: text('category').notNull().default('CLASSROOM'),
  targetId: text('target_id'),
  targetName: text('target_name'),
  classId: text('class_id'),
  message: text('message').notNull(),
  action: text('action'),
  resolved: boolean('resolved').notNull().default(false),
  status: text('status').notNull().default('NEW'), // NEW | IN_PROGRESS | RESOLVED
  resolution: text('resolution'),
  principalNotes: text('principal_notes'),
  assigneeEmail: text('assignee_email'),
  resolvedBy: text('resolved_by'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** alert_rules — port từ Firestore collection `rules` (ngưỡng cảnh báo tự động). */
export const alertRules = pgTable('alert_rules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  threshold: numeric('threshold', { precision: 8, scale: 2 }).notNull(),
  unit: text('unit').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  severity: text('severity').notNull()
});
