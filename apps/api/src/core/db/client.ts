import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './pool.js';

/**
 * Drizzle instance DUY NHẤT cho database của trường này — mọi module
 * nghiệp vụ (An toàn, Lịch công tác...) import `db` từ đây để query, không
 * tự tạo Pool/drizzle instance riêng ở nơi khác.
 */
export const db = drizzle(pool);
