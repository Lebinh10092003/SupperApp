import { pgTable, text, timestamp, integer, uuid, date } from 'drizzle-orm/pg-core';

/**
 * ltc_weekly_sheet_rows — "Lịch công tác tuần" dạng bảng tự do, port thủ
 * công (KHÔNG có bản gốc Firestore để đối chiếu — tính năng MỚI, Sin chốt
 * 2026-09-28) mô phỏng đúng bảng Google Sheet thầy Phương/thầy Sơn đang
 * dùng: 1 dòng = 1 mốc thời gian trong ngày, mọi cột đều CHỮ TỰ DO (không
 * ràng buộc người/địa điểm có sẵn như `ltc_events`), KHÔNG có quy trình
 * duyệt/dò trùng lịch — ai được liệt vào danh sách biên tập
 * (`WEEKLY_SHEET_EDITOR_EMAILS`, xem weekly-sheet.service.ts) thì sửa/xoá
 * tự do, còn lại chỉ xem.
 *
 * CỐ Ý tách bảng riêng khỏi `ltc_events`/`ltc_tasks` — 2 bảng đó gắn chặt
 * với state machine phê duyệt/dò trùng ở work-schedule.service.ts, không
 * phù hợp để tái dùng cho nhu cầu "bảng tuần tự do" này (xem thảo luận
 * 2026-09-28 trong session — module cũ "xây cho mô hình toàn trường",
 * bảng này ban đầu chỉ phục vụ 2 người nhưng không khoá cứng kiến trúc chỉ
 * cho 2 người, mở rộng sau chỉ cần thêm email vào danh sách biên tập).
 */
export const ltcWeeklySheetRows = pgTable('ltc_weekly_sheet_rows', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Ngày cụ thể của dòng (VD Thứ Hai 21/9/2026 -> '2026-09-21') — KHÔNG
  // lưu "thứ mấy" riêng, suy ra khi hiển thị từ chính ngày này để không
  // bao giờ lệch nhau. `mode: 'string'` CỐ Ý — drizzle mặc định (mode
  // 'date') đọc/ghi qua `Date` object rồi tự quy đổi UTC, lệch mất 1 ngày
  // với giờ Việt Nam (UTC+7) ở gần nửa đêm; ép chuỗi 'YYYY-MM-DD' thẳng
  // vào cột `date` Postgres, không qua bất kỳ quy đổi múi giờ nào.
  rowDate: date('row_date', { mode: 'string' }).notNull(),
  // "Thời gian" trên sheet gốc — chữ tự do vì có khi là giờ cụ thể
  // ("7h30"), có khi là tiết học ("Tiết 1, 2"), có khi để trống.
  timeLabel: text('time_label').notNull().default(''),
  content: text('content').notNull().default(''),
  location: text('location').notNull().default(''),
  // "Người thực hiện" — chữ tự do (danh sách tên/vai trò rời rạc như sheet
  // gốc), KHÔNG ép chọn từ danh bạ người dùng có sẵn.
  people: text('people').notNull().default(''),
  // Thứ tự thủ công trong CÙNG 1 ngày (nhiều dòng/ngày, sheet gốc xếp theo
  // đúng thứ tự người nhập gõ vào, không tự sắp theo giờ).
  sortOrder: integer('sort_order').notNull().default(0),
  createdByPerId: text('created_by_per_id'),
  updatedByPerId: text('updated_by_per_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
