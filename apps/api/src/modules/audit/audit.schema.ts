import { pgTable, text, uuid, timestamp } from 'drizzle-orm/pg-core';

/**
 * audit_logs — nhật ký kiểm toán CHUNG cho toàn SuperApp (KHÁC hẳn
 * `audit_logs` của module An toàn — bảng riêng, tên trùng do đặt theo
 * đúng tên collection Firestore gốc, nằm ở module/file khác nhau nên
 * không đụng nhau trong Drizzle). Port từ Firestore collection `auditLogs`.
 */
export const generalAuditLogs = pgTable('general_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  actor: text('actor').notNull(),
  status: text('status').notNull().default('SUCCESS'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  message: text('message'),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow()
});
