import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * idempotency_keys — chống gửi lặp (mục VII.1), khoá tối thiểu 24 giờ, gọi
 * lặp trả đúng kết quả lần đầu. Áp dụng cho mọi API tạo mới/có tác dụng phụ.
 */
export const idempotencyKeys = pgTable('idempotency_keys', {
  key: text('key').primaryKey(),
  result: jsonb('result'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
