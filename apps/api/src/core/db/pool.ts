import { Pool } from 'pg';
import { env } from '../../config/env.js';

/**
 * 1 connection pool duy nhất cho database Postgres của ĐÚNG 1 trường (mỗi
 * trường 1 server + database riêng hoàn toàn — xem
 * SUPERAPP_MIGRATION_COORDINATION/DECISIONS.md, mục "ĐẢO NGƯỢC" 2026-09-09).
 *
 * KHÔNG có khái niệm chọn schema/tenant theo request — 1 deployment chỉ
 * phục vụ đúng 1 trường. Trường điểm chính + các phân hiệu (campus) của
 * CÙNG 1 trường vẫn nằm CHUNG database này, phân biệt bằng field
 * `campus_id` trên từng bảng (giống cách Firebase hiện tại đang làm),
 * KHÔNG phải bằng schema/database riêng.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  min: env.DATABASE_POOL_MIN,
  max: env.DATABASE_POOL_MAX
});
