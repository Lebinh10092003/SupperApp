import { pgTable, text, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';

/**
 * Bộ đếm mã tuần tự theo (prefix, kỳ) — 1 dòng duy nhất mỗi (prefix, kỳ),
 * tăng bằng UPSERT nguyên tử (xem `ids.ts`). KHÔNG chia mảnh (shard) như
 * bản Firestore gốc — xem giải thích đầy đủ trong `ids.ts`.
 */
export const idCounters = pgTable('id_counters', {
  prefix: text('prefix').notNull(),
  period: text('period').notNull(),
  value: integer('value').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [primaryKey({ columns: [table.prefix, table.period] })]);

/**
 * Mã tiếp nhận công khai (GV-XXXX-XXXX) — `allocatePublicCode` chỉ ĐỌC bảng
 * này để chống trùng (chưa insert); dòng thật được `reports` module ghi
 * kèm `reportId` ngay khi tạo tin báo (đúng thời điểm bản gốc Firestore
 * ghi `public_codes/{code}` — xem `safety.js::submitReport`). `reportId`
 * nullable vì bước allocatePublicCode kiểm tra tồn tại có thể chạy độc
 * lập trước khi biết reportId (test thuần logic sinh mã, không có DB).
 */
export const publicCodes = pgTable('public_codes', {
  code: text('code').primaryKey(),
  reportId: text('report_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
