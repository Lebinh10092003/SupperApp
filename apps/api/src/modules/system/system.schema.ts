import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * system_config — key-value chung cho cấu hình hệ thống, port từ Firestore
 * collection `system` (doc id = key, VD 'oauthConfig'/'syncStatus'). Dùng
 * jsonb `value` thay vì bảng riêng cho từng key vì số lượng key nhỏ và các
 * route hiện tại chỉ đọc/ghi nguyên cục JSON, không query theo field con.
 */
export const systemConfig = pgTable('system_config', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * subscriptions — port từ Firestore collection `subscriptions` (đăng ký
 * Pub/Sub Classroom Push/Meet). CHƯA có writer thật nào trong code (kể cả
 * bản Firestore cũ) — `renew-subscriptions.ts` mới chỉ ghi log vào
 * `sync_runs`, không thực sự gọi API tạo subscription — giữ bảng rỗng
 * đúng như hành vi hiện tại, không tự bịa thêm logic chưa có.
 */
export const subscriptions = pgTable('subscriptions', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(), // CLASSROOM | MEET
  resourceId: text('resource_id'),
  expiration: timestamp('expiration', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
