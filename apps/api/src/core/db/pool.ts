import { Pool } from 'pg';
import { env } from '../../config/env.js';

/**
 * 1 connection pool duy nhất dùng chung cho cả registry (`public`) lẫn mọi
 * schema tenant — schema-per-tenant chọn bằng `SET search_path` trên từng
 * client mượn ra từ pool (xem `withTenantSchema`), KHÔNG mở nhiều pool.
 * Lý do: mỗi pool tốn kết nối riêng tới Postgres, vài chục trường x N pool
 * sẽ vượt `max_connections` rất nhanh.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX
});

/**
 * Mượn 1 client từ pool, set search_path đúng schema tenant, chạy `fn`,
 * rồi LUÔN reset search_path về "public" trước khi trả client lại pool —
 * bắt buộc, nếu không client bị tái sử dụng cho request/tenant khác vẫn còn
 * dính search_path cũ (rò rỉ dữ liệu chéo trường qua connection pool).
 */
export async function withTenantSchema<T>(
  schemaName: string,
  fn: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    throw new Error(`Tên schema không hợp lệ: ${schemaName}`);
  }
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}", public`);
    return await fn(client);
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}
