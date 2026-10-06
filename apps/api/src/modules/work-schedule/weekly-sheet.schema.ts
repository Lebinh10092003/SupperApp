import { pgTable, text, timestamp, integer, uuid, date } from 'drizzle-orm/pg-core';
import { ltcEvents } from './work-schedule.schema.js';

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
  // 2026-09-29 (Sin yêu cầu: "về bản chất chúng là một cái... chung hoà
  // được sự tiện lợi kiểu điền excel nhưng cũng phải hiển thị được % tiến
  // độ") — liên kết TUỲ CHỌN tới 1 "đầu việc lớn" bên module Lịch công
  // tác/Giao việc có sẵn (ltc_events). KHÔNG bắt buộc — dòng không liên
  // kết vẫn là ô Excel tự do y hệt trước giờ, không đổi gì cả. Dòng CÓ
  // liên kết thì mượn nguyên % tiến độ đã có sẵn ở đó (taskProgressPercent,
  // tính từ ltc_tasks con) để hiện rõ ràng ngay trên bảng tuần, đúng nghĩa
  // "2 cái vốn là một" thay vì 2 nguồn dữ liệu tách rời không đồng bộ.
  linkedEventId: uuid('linked_event_id').references(() => ltcEvents.id, { onDelete: 'set null' }),
  createdByPerId: text('created_by_per_id'),
  updatedByPerId: text('updated_by_per_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});

/**
 * ltc_weekly_sheet_connection — "kết nối" Google Sheet nguồn cho tính năng
 * Lịch tuần (bổ sung 2026-09-28, sau khi Sin chỉ ra nút "Kéo dữ liệu" cũ
 * bắt dán lại link MỖI LẦN muốn đồng bộ — không có khái niệm "đã kết nối
 * sẵn 1 link rồi, bấm 1 nút là đồng bộ luôn"). CHỈ 1 DÒNG DUY NHẤT
 * (`id = 'default'`) — cả module hiện chỉ phục vụ 2 thầy dùng chung 1
 * sheet, không cần nhiều kết nối song song. Lưu link đã lưu KHÔNG đồng
 * nghĩa đã xác thực đọc được — việc đọc thật diễn ra ở lúc bấm đồng bộ
 * (`fetchGoogleSheetValues`), tách riêng "lưu link" khỏi "thử đọc" để
 * không chặn việc lưu chỉ vì lúc lưu chưa gọi được Sheets API (VD scope
 * DWD chưa được Admin Console cấp).
 */
export const ltcWeeklySheetConnection = pgTable('ltc_weekly_sheet_connection', {
  id: text('id').primaryKey(),
  sheetUrl: text('sheet_url').notNull(),
  connectedByPerId: text('connected_by_per_id').notNull(),
  connectedAt: timestamp('connected_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
