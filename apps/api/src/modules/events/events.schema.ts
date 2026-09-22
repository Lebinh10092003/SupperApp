import { pgTable, text, integer, timestamp } from 'drizzle-orm/pg-core';

/**
 * events — sổ idempotency cho webhook (Pub/Sub Google Meet, v.v.), port từ
 * Firestore collection `events`. `eventId` là khoá chính (không tái sử
 * dụng), `leaseUntil` giữ 5 phút để tránh 2 worker cùng xử lý 1 event khi
 * request bị retry trong lúc đang xử lý dở.
 */
export const events = pgTable('events', {
  eventId: text('event_id').primaryKey(),
  source: text('source').notNull(),
  status: text('status').notNull().default('PROCESSING'), // PROCESSING | DONE | ERROR
  leaseUntil: timestamp('lease_until', { withTimezone: true }),
  attempts: integer('attempts').notNull().default(1),
  error: text('error'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
