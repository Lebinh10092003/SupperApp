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

/** Mã tiếp nhận công khai (GV-XXXX-XXXX) đã cấp — chỉ để chống trùng, mapping thật gắn ở module report/incident khi port tới. */
export const publicCodes = pgTable('public_codes', {
  code: text('code').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
