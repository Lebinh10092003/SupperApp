import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * google_connections — port từ Firestore collection `googleConnections`.
 * Doc id gốc là `current` (kết nối chung toàn trường) hoặc uid người dùng
 * (kết nối cá nhân) — giữ nguyên quy ước đó, `id` ở đây CHÍNH LÀ giá trị
 * đó ('current' hoặc uid thật), không phải khoá tự sinh.
 */
export const googleConnections = pgTable('google_connections', {
  id: text('id').primaryKey(),
  uid: text('uid'),
  email: text('email'),
  name: text('name'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').$type<string[]>().default([]),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
