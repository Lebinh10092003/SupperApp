import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * saved_case_filters — bộ lọc danh sách sự vụ do từng người tự lưu lại
 * (bổ sung 2026-09-22, Sin: "lao công hay bảo vệ phụ trách một số mảng
 * nhất định thì chỉ cần để bộ lọc đúng thế thì có thể dễ dàng check sự vụ
 * mình cần"). `filterJson` lưu nguyên trạng thái bộ lọc phía client
 * (campusId/categoryCodes/trạng thái/đã-chưa có người phụ trách...) —
 * KHÔNG parse/diễn giải ở backend, chỉ lưu/trả nguyên văn.
 */
export const savedCaseFilters = pgTable('saved_case_filters', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  perId: text('per_id').notNull(),
  name: text('name').notNull(),
  filterJson: jsonb('filter_json').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
