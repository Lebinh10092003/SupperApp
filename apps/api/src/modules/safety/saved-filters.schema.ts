import { pgTable, text, jsonb, timestamp } from 'drizzle-orm/pg-core';

/**
 * saved_case_filters — bộ lọc danh sách do từng người tự lưu lại (bổ sung
 * 2026-09-22, Sin: "lao công hay bảo vệ phụ trách một số mảng nhất định
 * thì chỉ cần để bộ lọc đúng thế thì có thể dễ dàng check sự vụ mình
 * cần"). `filterJson` lưu nguyên trạng thái bộ lọc phía client
 * (campusId/categoryCodes/trạng thái/đã-chưa có người phụ trách...) —
 * KHÔNG parse/diễn giải ở backend, chỉ lưu/trả nguyên văn.
 *
 * `kind` — bổ sung 2026-10-02 (Sin: mở rộng "lưu bộ lọc" sang Lịch công
 * tác/Giao việc, không chỉ riêng Sự vụ): phân biệt bộ lọc thuộc trang nào,
 * vì `filterJson` mỗi trang có field hoàn toàn khác nhau (vd campusFilter
 * của Sự vụ vs personFilter của Lịch công tác) — không phân biệt sẽ hiện
 * lẫn lộn bộ lọc sai trang khi áp dụng. Default 'safety_cases' để các
 * dòng cũ (tạo trước khi có cột này) vẫn đúng là bộ lọc Sự vụ, không mất
 * dữ liệu/không cần migrate dữ liệu cũ thủ công.
 */
export const savedCaseFilters = pgTable('saved_case_filters', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  perId: text('per_id').notNull(),
  kind: text('kind').notNull().default('safety_cases'),
  name: text('name').notNull(),
  filterJson: jsonb('filter_json').notNull().$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
