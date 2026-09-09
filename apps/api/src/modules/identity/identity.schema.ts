import { pgTable, text, timestamp, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * Bảng identity dùng CHUNG giữa module An toàn trường học + Lịch công tác
 * (và mọi module sau này cần biết "ai là ai, vai trò gì, cơ sở nào") — port
 * từ Firestore collection cùng tên, project An toàn. Field/shape đối chiếu
 * trực tiếp từ code thật (`index.js`), không suy đoán — xem
 * SUPERAPP_MIGRATION_COORDINATION/DECISIONS.md để biết nguồn.
 *
 * KHÔNG tự port riêng ở module khác — mọi nơi cần accounts/assignments...
 * import từ ĐÚNG file này (xem README.md cùng thư mục).
 */

/** doc ID Firestore = Firebase Auth uid → cột `uid` làm PK. */
export const accounts = pgTable('accounts', {
  uid: text('uid').primaryKey(),
  perId: text('per_id').notNull(), // VD "PER_ABC1234567" — sinh 1 lần lúc tạo account, KHÔNG đổi lại thuật toán ở đây
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, (table) => [uniqueIndex('accounts_per_id_idx').on(table.perId)]);

/**
 * Firestore doc ID = `perId + '__' + roleId` (composite) — giữ nguyên ý
 * nghĩa bằng unique index thay vì ghép chuỗi làm PK (Postgres có
 * composite unique constraint tốt hơn).
 */
export const assignments = pgTable('assignments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  perId: text('per_id').notNull(),
  roleId: text('role_id').notNull(), // 1 trong 16 mã ROLE.* — xem roles.ts, KHÔNG FK cứng vì đây là hằng số ứng dụng, không phải bảng
  campusId: text('campus_id'), // null = không giới hạn cơ sở (vd role toàn trường); nếu có: MAIN_CAMPUS/CAMPUS_1/CAMPUS_2
  domain: text('domain'),
  fromDate: timestamp('from_date', { withTimezone: true }), // null = có hiệu lực từ đầu
  toDate: timestamp('to_date', { withTimezone: true }), // null = vô thời hạn
  ceiling: text('ceiling'), // override trần bí mật mặc định của vai trò, optional
  createdByUid: text('created_by_uid'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedByUid: text('updated_by_uid'),
  updatedAt: timestamp('updated_at', { withTimezone: true })
}, (table) => [
  uniqueIndex('assignments_per_role_idx').on(table.perId, table.roleId),
  index('assignments_per_id_idx').on(table.perId),
  index('assignments_campus_id_idx').on(table.campusId)
]);

/** doc ID Firestore = perId. */
export const peopleDirectory = pgTable('people_directory', {
  perId: text('per_id').primaryKey(),
  email: text('email'),
  phone: text('phone') // giữ lại vì field cũ vẫn còn ghi khi tạo user, dù kênh SMS đã bỏ dùng
});

export const dutyShifts = pgTable('duty_shifts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  perId: text('per_id').notNull(),
  fromAt: timestamp('from_at', { withTimezone: true }).notNull(),
  toAt: timestamp('to_at', { withTimezone: true }).notNull()
  // KHÔNG có campus_id trên chính bảng này — campus của người trực suy qua
  // assignments (role R.DUTY_OFFICER) của cùng per_id, giữ đúng như gốc.
}, (table) => [index('duty_shifts_per_id_idx').on(table.perId)]);

export const delegations = pgTable('delegations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  toPerId: text('to_per_id').notNull(),
  campusId: text('campus_id'),
  fromAt: timestamp('from_at', { withTimezone: true }).notNull(),
  toAt: timestamp('to_at', { withTimezone: true }).notNull()
  // GHI CHÚ: code đọc được (index.js) chỉ dùng đúng 4 field trên. Firestore
  // doc gốc CÓ THỂ có thêm field khác (vd from_per_id/lý do uỷ quyền) không
  // được code hiện tại đọc tới — nếu port dữ liệu thật, kiểm tra lại doc
  // Firestore thật trước khi coi bảng này là đầy đủ 100%.
}, (table) => [index('delegations_to_per_id_idx').on(table.toPerId)]);

/** doc ID Firestore = tên lớp (VD "8A3"). */
export const homeroomAssignments = pgTable('homeroom_assignments', {
  className: text('class_name').primaryKey(),
  perId: text('per_id').notNull(),
  name: text('name')
});

/** doc ID Firestore = khối (VD "8"). */
export const gradeSupervisorAssignments = pgTable('grade_supervisor_assignments', {
  grade: text('grade').primaryKey(),
  perId: text('per_id').notNull(),
  name: text('name')
});
