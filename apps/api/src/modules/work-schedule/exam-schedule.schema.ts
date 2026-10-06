import { pgTable, text, timestamp, date, uuid } from 'drizzle-orm/pg-core';

/**
 * ltc_exam_shifts — "Lịch thi" (phân công trông thi/coi khảo sát), bổ sung
 * 2026-09-29 (Sin: "cơ chế lịch thi thì hiện lịch kiểu calendar tháng...
 * người ko có thẩm quyền ko cho sửa... có người quản trị mới edit được
 * thôi, còn mấy người khác chỉ cho xem lịch trông thi của bản thân thôi").
 * Cấu trúc CỘT khớp đúng bảng phân công thật của trường (ảnh Sin gửi —
 * "BẢNG PHÂN CÔNG GIÁM THỊ COI KHẢO SÁT"): Ngày/Thứ/Buổi/Tiết KS/Giờ/Môn
 * khảo sát/Lớp/GV tiết đầu/GV tiết sau/Ghi chú.
 *
 * ĐỢT ĐẦU (Sin chốt qua AskUserQuestion): CHỈ xem + admin tạo/sửa TAY qua
 * UI — người trông thi chọn qua PersonPicker (per_id thật ngay từ đầu),
 * KHÔNG có import tự động.
 *
 * ĐỢT 2 (2026-10-05, huong_dan_lich_cong_tac_giao_viec.md §17-25) — thêm
 * import file (atomic, đúng/sai toàn bộ). File import KHÔNG đối chiếu tên
 * GV với danh bạ (chính spec §20: "các trường còn lại -> text") — tránh
 * đúng vấn đề "nhận nhầm Sơn A/Sơn B" đã lường trước ở ghi chú cũ bên
 * trên, bằng cách KHÔNG cố gán per_id tự động, chỉ lưu CHỮ TỰ DO vào 2 cột
 * mới `first_proctor_name`/`second_proctor_name`. 2 cột per_id cũ
 * (firstProctorPerId/secondProctorPerId) GIỮ NGUYÊN cho đường tạo/sửa TAY
 * qua UI (PersonPicker) — 1 dòng chỉ dùng 1 trong 2 cặp cột (perId HOẶC
 * name), KHÔNG dùng cả hai cùng lúc; lúc hiển thị ưu tiên tên đã resolve
 * từ perId nếu có, không thì hiện thẳng cột *_name.
 */
export const ltcExamShifts = pgTable('ltc_exam_shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  // `mode: 'string'` — cùng lý do với ltc_weekly_sheet_rows.rowDate (tránh
  // lệch múi giờ UTC+7 gần nửa đêm).
  examDate: date('exam_date', { mode: 'string' }).notNull(),
  session: text('session').notNull().default(''), // "Sáng" | "Chiều" | tự do
  periodLabel: text('period_label').notNull().default(''), // VD "1+2"
  timeLabel: text('time_label').notNull().default(''), // VD "7h30-9h00"
  subject: text('subject').notNull().default(''), // Môn khảo sát
  className: text('class_name').notNull().default(''), // Lớp
  campusId: text('campus_id').notNull(),
  firstProctorPerId: text('first_proctor_per_id'), // GV tiết đầu — chọn tay qua PersonPicker
  secondProctorPerId: text('second_proctor_per_id'), // GV tiết sau — chọn tay qua PersonPicker
  firstProctorName: text('first_proctor_name'), // GV tiết đầu — chữ tự do từ file import
  secondProctorName: text('second_proctor_name'), // GV tiết sau — chữ tự do từ file import
  note: text('note').notNull().default(''),
  createdByPerId: text('created_by_per_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
