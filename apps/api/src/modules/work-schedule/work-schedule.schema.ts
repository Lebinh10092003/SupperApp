import { pgTable, text, timestamp, integer, jsonb, uuid, check, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Bảng Postgres cho module "Lịch công tác và Giao việc" (port từ Firestore
 * `ltc_events`/`ltc_tasks`/`ltc_audit_logs`, xem
 * `App_lich_cong_tac_giao_viec/THIET_KE_FIRESTORE.md` +
 * `.../vendor/lich-cong-tac-core/src/lichCongTac.js` nguồn gốc). Giữ
 * nguyên tiền tố `ltc_` từ thiết kế Firestore gốc để không đụng bảng
 * `si_class_schedules` (thời khoá biểu lớp học, module Classroom
 * Intelligence) hay bất kỳ bảng "schedule" nào khác trong cùng schema
 * tenant.
 *
 * Sống trong schema TENANT (không phải `public`) — nằm trong file glob
 * `src/modules/**\/*.schema.ts` mà `drizzle.config.tenant-template.ts` gom
 * lại, áp dụng cho MỌI schema tenant khi provisioning.
 *
 * Định danh người dùng dùng `per_id` (KHÔNG dùng email) — khớp
 * accounts/assignments dùng chung (module An toàn port, xem
 * `core/tenant/README.md` mục 3) — bảng NÀY không tự định nghĩa lại
 * accounts/assignments.
 */

export const VALID_EVENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED', 'CANCELLED'] as const;
// Thu gọn còn đúng 2 trạng thái (2026-10-05, theo
// huong_dan_lich_cong_tac_giao_viec.md §12.4/§28.7 Sin gửi) — trước đó có
// 7 trạng thái (ACCEPTED/IN_PROGRESS/PENDING_ACCEPTANCE/RETURNED/CANCELLED
// cho luồng nghiệm thu/từ chối), Sin xác nhận bỏ hẳn, chỉ còn Đã giao/Đã
// hoàn thành. Dữ liệu cũ migrate thủ công trên VPS (xem HANDOFF ghi chú
// deploy): mọi status khác COMPLETED -> ASSIGNED.
export const VALID_TASK_STATUSES = ['ASSIGNED', 'COMPLETED'] as const;
// 3 mã cơ sở CHUNG với module Cảnh báo an toàn — KHÔNG tự định nghĩa lại,
// xem CLAUDE.md cấp trên (/Users/macbook/Projects/CLAUDE.md).
export const VALID_CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const;
export const VALID_EVENT_SCOPES = ['CAMPUS', 'SCHOOL_WIDE'] as const;

export type EventStatus = (typeof VALID_EVENT_STATUSES)[number];
export type TaskStatus = (typeof VALID_TASK_STATUSES)[number];
export type CampusId = (typeof VALID_CAMPUS_IDS)[number];
export type EventScope = (typeof VALID_EVENT_SCOPES)[number];

export const ltcEvents = pgTable(
  'ltc_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    type: text('type').notNull().default('MEETING'),
    priority: text('priority').notNull().default('NORMAL'),
    campusId: text('campus_id').notNull(),
    scope: text('scope').notNull().default('CAMPUS'),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    // Bỏ NOT NULL (2026-10-05, Sin: "giờ kết thúc không bắt buộc") — lịch
    // không nhất thiết biết trước thời điểm kết thúc; NULL nghĩa là
    // "chưa rõ/không khai báo", KHÁC "kết thúc = bắt đầu". Dò trùng lịch
    // (findOverlappingPartners) bỏ qua các cặp có endAt NULL — xem ghi chú
    // tại đó.
    endAt: timestamp('end_at', { withTimezone: true }),
    location: text('location').notNull().default(''),
    chairPerId: text('chair_per_id').notNull(),
    participantPerIds: text('participant_per_ids').array().notNull().default(sql`'{}'::text[]`),
    // 2026-09-30 (Sin: "có cái thêm người thì có thể sẽ thêm một số tác
    // nhân ko nằm trong danh sách tk bên quản trị thì cho thêm kiểu dạng
    // text cũng được") — thành phần KHÔNG có tài khoản trong hệ thống (VD
    // khách mời ngoài trường, phụ huynh, công an phường...) — CHỮ TỰ DO,
    // không phải perId, không liên kết được tới ai — chỉ để HIỂN THỊ. Cùng
    // ý tưởng cột `people` của ltc_weekly_sheet_rows (xem
    // WeeklySheetPeoplePicker.tsx) nhưng đây là mảng RIÊNG, tách khỏi
    // participantPerIds (perId thật) để không lẫn 2 loại dữ liệu khác bản
    // chất vào cùng 1 cột.
    externalParticipants: text('external_participants').array().notNull().default(sql`'{}'::text[]`),
    status: text('status').notNull().default('DRAFT'),
    conflictNote: text('conflict_note').notNull().default(''),
    revisionNote: text('revision_note').notNull().default(''),
    cancellationNote: text('cancellation_note'),
    // Dùng để đối chiếu quyền "tổ trưởng duyệt nhân viên trong tổ" — xem
    // ghi chú GIẢ ĐỊNH CHƯA KIỂM CHỨNG trong authzLichCongTac.js gốc.
    departmentDomain: text('department_domain'),
    // Ghi nhận từng bước duyệt (chỉ thật sự dùng khi scope=SCHOOL_WIDE).
    approvals: jsonb('approvals')
      .$type<Array<{ role: string; perId: string; at?: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdByPerId: text('created_by_per_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    version: integer('version').notNull().default(1)
  },
  (table) => [
    check('ltc_events_campus_id_check', sql`${table.campusId} IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')`),
    check('ltc_events_scope_check', sql`${table.scope} IN ('CAMPUS', 'SCHOOL_WIDE')`),
    check(
      'ltc_events_status_check',
      sql`${table.status} IN ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED', 'CANCELLED')`
    )
  ]
);

export const ltcTasks = pgTable(
  'ltc_tasks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id').references(() => ltcEvents.id, { onDelete: 'set null' }),
    // 2026-09-30 (Sin: "đầu việc nhỏ ở đầu việc lớn trong tab giao việc") —
    // "đầu việc lớn"/"đầu việc nhỏ" giờ là quan hệ Task→Task (KHÔNG phải
    // Event→Task như hiểu nhầm trước đó) — 1 việc (không có parentTaskId)
    // có thể có nhiều "việc nhỏ" (parentTaskId trỏ về việc đó), MỖI việc
    // nhỏ có người phụ trách RIÊNG. Chỉ 2 CẤP (một việc nhỏ không được có
    // việc nhỏ của riêng nó nữa — chặn ở createTask). `onDelete: cascade`
    // — xoá hẳn việc lớn thì xoá hẳn luôn các việc nhỏ của nó, không để mồ
    // côi. Quan hệ này ĐỘC LẬP với `eventId` (1 việc có thể vừa "thuộc" 1
    // lịch công tác vừa có việc nhỏ riêng — 2 khái niệm khác nhau).
    parentTaskId: uuid('parent_task_id'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority').notNull().default('NORMAL'),
    campusId: text('campus_id').notNull(),
    assigneePerId: text('assignee_per_id').notNull(),
    collaboratorPerIds: text('collaborator_per_ids').array().notNull().default(sql`'{}'::text[]`),
    // 2026-09-29 (Sin yêu cầu) — việc nhỏ cần ô địa điểm riêng (không phải
    // lúc nào cũng trùng địa điểm của sự kiện cha, và việc độc lập không
    // gắn sự kiện nào thì càng cần). Tuỳ chọn, mặc định rỗng như location
    // của ltc_events.
    location: text('location').notNull().default(''),
    // 2026-09-29 (Sin: "việc nhỏ thì cho thêm ngày bắt đầu lẫn kết thúc
    // luôn, việc lớn kéo nhiều ngày vẫn có thể mà, kể cả việc nhỏ cũng có
    // thể kéo nhiều ngày luôn") — tuỳ chọn, NULL nghĩa là việc chỉ có 1 mốc
    // hạn như trước giờ (không phải ai cũng cần khai báo ngày bắt đầu).
    // `dueAt` giữ nguyên ý nghĩa "hạn hoàn thành" (mốc kết thúc).
    startAt: timestamp('start_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().default('ASSIGNED'),
    evidenceUrl: text('evidence_url').notNull().default(''),
    acceptanceNote: text('acceptance_note').notNull().default(''),
    cancellationReason: text('cancellation_reason'),
    createdByPerId: text('created_by_per_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    foreignKey({
      name: 'ltc_tasks_parent_task_id_fkey',
      columns: [table.parentTaskId],
      foreignColumns: [table.id]
    }).onDelete('cascade'),
    check('ltc_tasks_campus_id_check', sql`${table.campusId} IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')`),
    check('ltc_tasks_status_check', sql`${table.status} IN ('ASSIGNED', 'COMPLETED')`)
  ]
);

/**
 * Nhật ký kiểm toán RIÊNG của module này — tách biệt audit trail của module
 * Cảnh báo an toàn, đúng nguyên tắc mỗi module tự chịu trách nhiệm nhật ký
 * của mình (đã xác nhận trong THIET_KE_FIRESTORE.md gốc).
 */
export const ltcAuditLogs = pgTable('ltc_audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  actorPerId: text('actor_per_id').notNull(),
  before: jsonb('before'),
  after: jsonb('after'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
