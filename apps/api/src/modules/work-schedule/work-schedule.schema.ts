import { pgTable, text, timestamp, integer, jsonb, uuid, check } from 'drizzle-orm/pg-core';
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
export const VALID_TASK_STATUSES = [
  'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'COMPLETED', 'RETURNED', 'CANCELLED'
] as const;
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
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    location: text('location').notNull().default(''),
    chairPerId: text('chair_per_id').notNull(),
    participantPerIds: text('participant_per_ids').array().notNull().default(sql`'{}'::text[]`),
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
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    priority: text('priority').notNull().default('NORMAL'),
    campusId: text('campus_id').notNull(),
    assigneePerId: text('assignee_per_id').notNull(),
    collaboratorPerIds: text('collaborator_per_ids').array().notNull().default(sql`'{}'::text[]`),
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
    check('ltc_tasks_campus_id_check', sql`${table.campusId} IN ('MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2')`),
    check(
      'ltc_tasks_status_check',
      sql`${table.status} IN ('ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'COMPLETED', 'RETURNED', 'CANCELLED')`
    )
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
