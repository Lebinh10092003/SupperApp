import { pgTable, text, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * users — port từ Firestore collection `users` (doc id = Firebase Auth
 * uid). Đây là bảng LÕI cho `auth/middleware.ts` (`firebaseAuth`, dùng ở
 * MỌI route cần đăng nhập) — sai schema ở đây ảnh hưởng toàn bộ app, không
 * riêng module session.
 */
export const users = pgTable('users', {
  uid: text('uid').primaryKey(),
  email: text('email').notNull(),
  role: text('role').notNull().default('TEACHER'),
  active: boolean('active').notNull().default(true),
  displayName: text('display_name'),
  scope: jsonb('scope'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  lastLogin: timestamp('last_login', { withTimezone: true })
});

/**
 * access_allowlist — port từ Firestore collection `accessAllowlist` (doc
 * id = safeId(email)). Danh sách email được cấp quyền TRƯỚC lần đăng nhập
 * đầu tiên (khác bootstrapEmails — hằng số cứng trong env — đây là danh
 * sách động Quản trị viên tự thêm qua UI).
 */
export const accessAllowlist = pgTable('access_allowlist', {
  id: text('id').primaryKey(), // safeId(email)
  email: text('email').notNull(),
  role: text('role').notNull().default('VIEWER'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
