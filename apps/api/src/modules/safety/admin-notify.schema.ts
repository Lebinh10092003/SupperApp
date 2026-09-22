import { pgTable, text, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';

/**
 * admin_notifications — "chuông thông báo" trong cổng nội bộ, port 1-1 từ
 * `adminNotify.js`. Mỗi thông báo lưu RIÊNG theo từng người nhận (1 dòng/1
 * người) để mỗi người có trạng thái "đã đọc" độc lập — khác hẳn
 * `notify_requests` (1 dòng dùng chung nhiều người nhận, `ackBy` là mảng
 * dùng chung).
 */
export const adminNotifications = pgTable('admin_notifications', {
  notificationId: text('notification_id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  recipientPerId: text('recipient_per_id').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  eventType: text('event_type'),
  objectId: text('object_id'),
  actorPerId: text('actor_per_id'),
  meta: jsonb('meta'),
  read: boolean('read').notNull().default(false),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull()
});
