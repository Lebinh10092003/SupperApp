import { drizzle } from 'drizzle-orm/node-postgres';
import type { PoolClient } from 'pg';
import { pool, withTenantSchema } from './pool.js';

/** Drizzle instance cho schema `public` (registry: tenants, super-admin...). */
export const publicDb = drizzle(pool);

/**
 * Chạy `fn(db)` với 1 Drizzle instance đã set đúng search_path của tenant.
 * Đây là điểm vào DUY NHẤT mà code nghiệp vụ của từng module nên dùng để
 * truy vấn dữ liệu theo đúng trường hiện tại — không tự ý `new Pool()` hay
 * tự quản lý client ở nơi khác, để không lặp lại rủi ro rò rỉ search_path.
 */
export function withTenantDb<T>(
  schemaName: string,
  fn: (db: ReturnType<typeof drizzle<Record<string, never>, PoolClient>>) => Promise<T>
): Promise<T> {
  return withTenantSchema(schemaName, async (client) => fn(drizzle(client)));
}
