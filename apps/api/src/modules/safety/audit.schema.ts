import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * Nhật ký kiểm toán bất biến (S9) — CHỈ ghi thêm, KHÔNG có hàm sửa/xoá bản
 * ghi ở tầng ứng dụng (kể cả vai trò Hiệu trưởng) — đúng nguyên tắc gốc.
 */
export const auditLogs = pgTable('audit_logs', {
  logId: text('log_id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  actorPerId: text('actor_per_id').notNull(),
  onBehalfOfPerId: text('on_behalf_of_per_id'),
  roleUsed: text('role_used'),
  ip: text('ip'),
  device: text('device'),
  action: text('action').notNull(),
  objectId: text('object_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  reason: text('reason'),
  requestId: text('request_id'),
  correlationId: text('correlation_id')
});
