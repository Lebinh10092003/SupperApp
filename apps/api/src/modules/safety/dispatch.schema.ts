import { pgTable, text, timestamp, jsonb, boolean, integer } from 'drizzle-orm/pg-core';

/** Token thông báo đẩy trình duyệt (FCM/Web Push) theo từng perId — 1 người có thể có nhiều token (nhiều thiết bị). */
export const pushTokens = pgTable('push_tokens', {
  token: text('token').primaryKey(),
  perId: text('per_id').notNull(),
  userAgent: text('user_agent'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** Yêu cầu thông báo (S7) — notify.ts dựng nội dung, dispatch.ts gửi thật + ghi lại dispatch_log vào đây. */
export const notifyRequests = pgTable('notify_requests', {
  notifyRequestId: text('notify_request_id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  objectId: text('object_id').notNull(),
  eventType: text('event_type'),
  urgency: text('urgency').notNull(),
  channels: jsonb('channels').notNull().$type<string[]>(),
  simultaneous: boolean('simultaneous').notNull().default(false),
  message: text('message').notNull(),
  recipients: jsonb('recipients').notNull().$type<string[]>(),
  requireAck: boolean('require_ack').notNull().default(false),
  status: text('status').notNull().default('pending'),
  attempts: integer('attempts').notNull().default(0),
  dedupeKeys: jsonb('dedupe_keys').notNull().$type<string[]>(),
  ackBy: jsonb('ack_by').notNull().default([]).$type<string[]>(),
  lastEscalatedAt: timestamp('last_escalated_at', { withTimezone: true }),
  lastEscalatedTo: text('last_escalated_to'),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  dispatchLog: jsonb('dispatch_log').$type<unknown[]>(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
