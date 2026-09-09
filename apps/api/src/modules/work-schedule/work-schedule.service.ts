/**
 * work-schedule.service.ts — CRUD + state machine cho module "Lịch công
 * tác và Giao việc", port 1-1 từ `lichCongTac.js` gốc (Firestore) sang
 * Postgres/Drizzle. Giữ đúng khuôn dependency-injection của bản gốc (`db`
 * là tham số ĐẦU TIÊN mọi hàm) để test được với Postgres thật qua
 * `withTenantDb`, không phụ thuộc route/HTTP layer.
 *
 * CHƯA CÓ trong file này (cố ý, giữ nguyên từ bản gốc — đang chờ xác nhận
 * nghiệp vụ từ Mr Tiến):
 *   - Luật "ai được duyệt lịch"/"ai được nghiệm thu việc" nằm ở
 *     `work-schedule.authz.ts`, KHÔNG nằm ở đây — các hàm đổi trạng thái
 *     dưới đây chỉ đổi đúng trạng thái được yêu cầu, KHÔNG tự kiểm tra
 *     actor có đúng quyền hay không ngoài phần đã port; tầng route phải tự
 *     nạp đúng `actorAssignments` thật từ bảng identity dùng chung (Hestia
 *     port, xem `core/tenant/README.md` mục 3) trước khi gọi.
 *   - Bảng ánh xạ vai trò cuối cùng (7 vai trò cũ -> 16 vai trò chung).
 *   - Migrate dữ liệu thật từ data_only.sql.
 */

import { and, eq, inArray, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  ltcEvents,
  ltcTasks,
  ltcAuditLogs,
  VALID_EVENT_STATUSES,
  VALID_TASK_STATUSES,
  VALID_CAMPUS_IDS,
  type EventStatus,
  type TaskStatus
} from './work-schedule.schema.js';
import { evaluateEventApproval, canAcceptOrReturnTask, type ActorAssignment } from './work-schedule.authz.js';

type Db = NodePgDatabase<Record<string, never>>;

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

// LƯU Ý: "PENDING_APPROVAL -> PUBLISHED" CỐ TÌNH KHÔNG có trong bảng này —
// bước đó chỉ được thực hiện qua approveEvent() (cần kiểm tra luật duyệt
// theo vai trò/campus/scope), không đi qua changeEventStatus() (hàm này
// chỉ xử lý các bước KHÔNG cần luật duyệt phức tạp).
export const EVENT_ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['DRAFT', 'REVISION_REQUIRED', 'CANCELLED'],
  REVISION_REQUIRED: ['PENDING_APPROVAL', 'CANCELLED'],
  PUBLISHED: ['CANCELLED'],
  CANCELLED: []
};

// LƯU Ý: "PENDING_ACCEPTANCE -> COMPLETED/RETURNED" CỐ TÌNH KHÔNG có trong
// bảng này — 2 bước đó CHỈ thực hiện qua acceptOrReturnTask() (bắt buộc
// kiểm tra đúng người giao việc), không đi qua changeTaskStatus().
export const TASK_ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  ASSIGNED: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['IN_PROGRESS'],
  IN_PROGRESS: ['PENDING_ACCEPTANCE'],
  PENDING_ACCEPTANCE: [],
  RETURNED: ['IN_PROGRESS', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: []
};

async function writeAuditLog(
  db: Db,
  params: {
    entityType: string;
    entityId: string;
    action: string;
    actorPerId: string;
    before?: unknown;
    after?: unknown;
  }
) {
  await db.insert(ltcAuditLogs).values({
    entityType: params.entityType,
    entityId: params.entityId,
    action: params.action,
    actorPerId: params.actorPerId,
    before: params.before ?? null,
    after: params.after ?? null
  });
}

// ---------------------------------------------------------------------
// Events (ltc_events)
// ---------------------------------------------------------------------

export interface CreateEventInput {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  campusId: string;
  scope?: string;
  startAt: Date;
  endAt: Date;
  location?: string;
  chairPerId: string;
  participantPerIds?: string[];
  departmentDomain?: string | null;
  createdByPerId: string;
}

/**
 * Tạo mới 1 sự kiện lịch công tác — luôn khởi tạo trạng thái DRAFT bất kể
 * client gửi gì (mọi sự kiện phải qua DRAFT trước khi vào luồng duyệt).
 */
export async function createEvent(db: Db, input: CreateEventInput) {
  if (!input.title) throw new AppError('invalid_input', 'Thiếu tiêu đề sự kiện.');
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!(input.startAt instanceof Date) || !(input.endAt instanceof Date) || Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng startAt/endAt.');
  }
  if (!input.chairPerId) throw new AppError('invalid_input', 'Thiếu chairPerId (người chủ trì).');
  if (!input.createdByPerId) throw new AppError('invalid_input', 'Thiếu createdByPerId.');

  const [row] = await db
    .insert(ltcEvents)
    .values({
      title: input.title,
      description: input.description || '',
      type: input.type || 'MEETING',
      priority: input.priority || 'NORMAL',
      campusId: input.campusId,
      scope: input.scope || 'CAMPUS',
      startAt: input.startAt,
      endAt: input.endAt,
      location: input.location || '',
      chairPerId: input.chairPerId,
      participantPerIds: input.participantPerIds ?? [],
      status: 'DRAFT',
      departmentDomain: input.departmentDomain ?? null,
      createdByPerId: input.createdByPerId
    })
    .returning();
  if (!row) throw new Error('Không tạo được sự kiện.');
  await writeAuditLog(db, { entityType: 'event', entityId: row.id, action: 'event.created', actorPerId: input.createdByPerId, after: row });
  return row;
}

/**
 * Chỉnh sửa nội dung lịch bị trả lại. Chỉ người tạo được sửa và chỉ khi
 * lịch đang ở DRAFT hoặc REVISION_REQUIRED — trạng thái GIỮ NGUYÊN để
 * người tạo tự kiểm tra rồi bấm "Gửi duyệt lại" sau khi lưu.
 */
export async function updateRevisionEvent(
  db: Db,
  input: { eventId: string; eventData: Partial<CreateEventInput>; actorPerId: string }
) {
  if (!input.eventId || !input.actorPerId) throw new AppError('invalid_input', 'Thiếu eventId hoặc actorPerId.');
  const eventData = input.eventData || {};
  if (!eventData.title) throw new AppError('invalid_input', 'Thiếu tiêu đề sự kiện.');
  if (!VALID_CAMPUS_IDS.includes(eventData.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ.');
  }
  if (!(eventData.startAt instanceof Date) || !(eventData.endAt instanceof Date)) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng startAt/endAt.');
  }
  const [before] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy sự kiện ${input.eventId}`);
  if (before.status !== 'DRAFT' && before.status !== 'REVISION_REQUIRED') {
    throw new AppError('invalid_transition', 'Chỉ sửa được lịch đang ở trạng thái Dự thảo hoặc Cần sửa lại.');
  }
  if (before.createdByPerId !== input.actorPerId) {
    throw new AppError('forbidden', 'Chỉ người tạo lịch mới được chỉnh sửa.');
  }
  const [after] = await db
    .update(ltcEvents)
    .set({
      title: eventData.title,
      description: eventData.description || '',
      type: eventData.type || before.type,
      priority: eventData.priority || before.priority,
      campusId: eventData.campusId!,
      scope: eventData.scope || 'CAMPUS',
      startAt: eventData.startAt!,
      endAt: eventData.endAt!,
      location: eventData.location || '',
      participantPerIds: eventData.participantPerIds ?? [],
      approvals: [],
      updatedAt: new Date(),
      version: before.version + 1
    })
    .where(eq(ltcEvents.id, input.eventId))
    .returning();
  await writeAuditLog(db, { entityType: 'event', entityId: input.eventId, action: 'event.updated_for_revision', actorPerId: input.actorPerId, before, after });
  return after!;
}

/**
 * Đổi trạng thái 1 sự kiện. KHÔNG kiểm tra actor có quyền duyệt hay không
 * (xem ghi chú đầu file) — chỉ đảm bảo bước chuyển hợp lệ theo state
 * machine. `note` bắt buộc khi chuyển sang REVISION_REQUIRED/CANCELLED.
 */
export async function changeEventStatus(
  db: Db,
  input: { eventId: string; nextStatus: string; note?: string; actorPerId: string; actorAssignments?: ActorAssignment[] }
) {
  if (!input.eventId) throw new AppError('invalid_input', 'Thiếu eventId.');
  if (!VALID_EVENT_STATUSES.includes(input.nextStatus as EventStatus)) {
    throw new AppError('invalid_input', `Trạng thái không hợp lệ: ${input.nextStatus}`);
  }
  const nextStatus = input.nextStatus as EventStatus;
  const [before] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy sự kiện ${input.eventId}`);

  if (nextStatus === 'DRAFT' && (before.status !== 'PENDING_APPROVAL' || before.createdByPerId !== input.actorPerId)) {
    throw new AppError('forbidden', 'Chỉ người tạo mới được thu hồi lịch chưa duyệt về Dự thảo.');
  }
  const isPrincipal = (input.actorAssignments || []).some((a) => a.roleId === 'R.PRINCIPAL');
  if (before.status === 'PUBLISHED' && before.createdByPerId === input.actorPerId && !isPrincipal) {
    throw new AppError('forbidden', 'Lịch đã được duyệt nên người tạo không thể thay đổi trạng thái.');
  }
  const allowed = EVENT_ALLOWED_TRANSITIONS[before.status as EventStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError('invalid_transition', `Không thể chuyển từ ${before.status} sang ${nextStatus}.`);
  }
  if ((nextStatus === 'REVISION_REQUIRED' || nextStatus === 'CANCELLED') && !input.note) {
    throw new AppError('invalid_input', `Bắt buộc ghi lý do (note) khi chuyển sang ${nextStatus}.`);
  }

  const patch: Partial<typeof ltcEvents.$inferInsert> = { status: nextStatus, updatedAt: new Date(), version: before.version + 1 };
  if (nextStatus === 'DRAFT') patch.approvals = [];
  if (nextStatus === 'REVISION_REQUIRED') patch.revisionNote = input.note;
  if (nextStatus === 'CANCELLED') patch.cancellationNote = input.note || before.cancellationNote;

  const [after] = await db.update(ltcEvents).set(patch).where(eq(ltcEvents.id, input.eventId)).returning();
  await writeAuditLog(db, { entityType: 'event', entityId: input.eventId, action: 'event.status_changed', actorPerId: input.actorPerId, before, after });
  return after!;
}

/**
 * Duyệt 1 sự kiện đang PENDING_APPROVAL — điểm vào DUY NHẤT hợp lệ cho
 * bước "duyệt". `actorAssignments` phải được tầng gọi nạp THẬT từ bảng
 * identity dùng chung trước khi gọi hàm này — không tự tin bất kỳ gì
 * client tự khai về vai trò.
 */
export async function approveEvent(db: Db, input: { eventId: string; actorPerId: string; actorAssignments: ActorAssignment[] }) {
  if (!input.eventId) throw new AppError('invalid_input', 'Thiếu eventId.');
  if (!input.actorPerId) throw new AppError('invalid_input', 'Thiếu actorPerId.');
  const [before] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy sự kiện ${input.eventId}`);
  if (before.status !== 'PENDING_APPROVAL') {
    throw new AppError('invalid_transition', `Chỉ duyệt được sự kiện đang ở trạng thái PENDING_APPROVAL (hiện tại: ${before.status}).`);
  }
  const decision = evaluateEventApproval(input.actorAssignments || [], before, input.actorPerId);
  if (!decision.allowed) {
    throw new AppError('forbidden', decision.reason!);
  }
  const patch: Partial<typeof ltcEvents.$inferInsert> = { updatedAt: new Date(), version: before.version + 1 };
  if (decision.approvalRecord) {
    const approvals = Array.isArray(before.approvals) ? before.approvals : [];
    patch.approvals = [...approvals, { ...decision.approvalRecord, at: new Date().toISOString() }];
  }
  if (decision.becomesPublished) {
    patch.status = 'PUBLISHED';
  }
  const [after] = await db.update(ltcEvents).set(patch).where(eq(ltcEvents.id, input.eventId)).returning();
  await writeAuditLog(db, {
    entityType: 'event',
    entityId: input.eventId,
    action: decision.becomesPublished ? 'event.published' : 'event.approval_step',
    actorPerId: input.actorPerId,
    before,
    after
  });
  return after!;
}

export async function listEvents(db: Db, filter: { campusId?: string; statuses?: string[] } = {}) {
  const conditions: SQL[] = [];
  if (filter.campusId) conditions.push(eq(ltcEvents.campusId, filter.campusId));
  if (filter.statuses?.length) conditions.push(inArray(ltcEvents.status, filter.statuses));
  if (!conditions.length) return db.select().from(ltcEvents);
  return db.select().from(ltcEvents).where(and(...conditions));
}

// ---------------------------------------------------------------------
// Tasks (ltc_tasks)
// ---------------------------------------------------------------------

export interface CreateTaskInput {
  eventId?: string | null;
  title: string;
  description?: string;
  priority?: string;
  campusId: string;
  assigneePerId: string;
  collaboratorPerIds?: string[];
  dueAt: Date;
  createdByPerId: string;
}

export async function createTask(db: Db, input: CreateTaskInput) {
  if (!input.title) throw new AppError('invalid_input', 'Thiếu tiêu đề công việc.');
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!input.assigneePerId) throw new AppError('invalid_input', 'Thiếu assigneePerId (người được giao).');
  if (!(input.dueAt instanceof Date) || Number.isNaN(input.dueAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng dueAt.');
  }
  if (!input.createdByPerId) throw new AppError('invalid_input', 'Thiếu createdByPerId.');

  const [row] = await db
    .insert(ltcTasks)
    .values({
      eventId: input.eventId || null,
      title: input.title,
      description: input.description || '',
      priority: input.priority || 'NORMAL',
      campusId: input.campusId,
      assigneePerId: input.assigneePerId,
      collaboratorPerIds: input.collaboratorPerIds ?? [],
      dueAt: input.dueAt,
      status: input.assigneePerId === input.createdByPerId ? 'ACCEPTED' : 'ASSIGNED',
      createdByPerId: input.createdByPerId
    })
    .returning();
  if (!row) throw new Error('Không tạo được công việc.');
  await writeAuditLog(db, { entityType: 'task', entityId: row.id, action: 'task.created', actorPerId: input.createdByPerId, after: row });
  return row;
}

export async function changeTaskStatus(
  db: Db,
  input: { taskId: string; nextStatus: string; note?: string; evidenceUrl?: string; actorPerId: string }
) {
  if (!input.taskId) throw new AppError('invalid_input', 'Thiếu taskId.');
  if (!VALID_TASK_STATUSES.includes(input.nextStatus as TaskStatus)) {
    throw new AppError('invalid_input', `Trạng thái không hợp lệ: ${input.nextStatus}`);
  }
  const nextStatus = input.nextStatus as TaskStatus;
  const [before] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, input.taskId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy công việc ${input.taskId}`);

  const currentStatus = before.status as TaskStatus;
  const requiredActorPerId = nextStatus === 'CANCELLED' ? before.createdByPerId : before.assigneePerId;
  if (requiredActorPerId !== input.actorPerId) {
    throw new AppError(
      'forbidden',
      nextStatus === 'CANCELLED'
        ? 'Chỉ người giao công việc này mới được hủy.'
        : `Chỉ người được giao công việc này (${before.assigneePerId}) mới được tự cập nhật trạng thái.`
    );
  }
  const allowed = TASK_ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError('invalid_transition', `Không thể chuyển từ ${currentStatus} sang ${nextStatus}.`);
  }
  if (nextStatus === 'CANCELLED' && !input.note) {
    throw new AppError('invalid_input', 'Bắt buộc ghi lý do khi hủy công việc.');
  }
  const patch: Partial<typeof ltcTasks.$inferInsert> = { status: nextStatus, updatedAt: new Date() };
  if (nextStatus === 'CANCELLED') patch.cancellationReason = input.note;
  if (input.evidenceUrl) patch.evidenceUrl = input.evidenceUrl;

  const [after] = await db.update(ltcTasks).set(patch).where(eq(ltcTasks.id, input.taskId)).returning();
  await writeAuditLog(db, { entityType: 'task', entityId: input.taskId, action: 'task.status_changed', actorPerId: input.actorPerId, before, after });
  return after!;
}

/**
 * Nghiệm thu (COMPLETED) hoặc trả lại (RETURNED) 1 công việc đang
 * PENDING_ACCEPTANCE — điểm vào DUY NHẤT hợp lệ. Nguyên văn Mr Tiến:
 * "Luồng giao việc do người giao xác nhận nghiệm thu" — actor PHẢI là
 * task.createdByPerId, không phải theo vai trò.
 */
export async function acceptOrReturnTask(db: Db, input: { taskId: string; nextStatus: 'COMPLETED' | 'RETURNED'; note?: string; actorPerId: string }) {
  if (!input.taskId) throw new AppError('invalid_input', 'Thiếu taskId.');
  if (input.nextStatus !== 'COMPLETED' && input.nextStatus !== 'RETURNED') {
    throw new AppError('invalid_input', 'nextStatus phải là COMPLETED hoặc RETURNED.');
  }
  const [before] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, input.taskId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy công việc ${input.taskId}`);
  if (before.status !== 'PENDING_ACCEPTANCE') {
    throw new AppError('invalid_transition', `Chỉ nghiệm thu/trả lại được công việc đang PENDING_ACCEPTANCE (hiện tại: ${before.status}).`);
  }
  if (!canAcceptOrReturnTask(before, input.actorPerId)) {
    throw new AppError('forbidden', `Chỉ người đã giao công việc này (${before.createdByPerId}) mới được nghiệm thu/trả lại.`);
  }
  if (input.nextStatus === 'RETURNED' && !input.note) {
    throw new AppError('invalid_input', 'Bắt buộc ghi lý do (note) khi trả lại việc (RETURNED).');
  }
  const [after] = await db
    .update(ltcTasks)
    .set({ status: input.nextStatus, updatedAt: new Date(), acceptanceNote: input.note || '' })
    .where(eq(ltcTasks.id, input.taskId))
    .returning();
  await writeAuditLog(db, {
    entityType: 'task',
    entityId: input.taskId,
    action: input.nextStatus === 'COMPLETED' ? 'task.accepted' : 'task.returned',
    actorPerId: input.actorPerId,
    before,
    after
  });
  return after!;
}

export async function listTasks(db: Db, filter: { campusId?: string; assigneePerId?: string; statuses?: string[] } = {}) {
  const conditions: SQL[] = [];
  if (filter.campusId) conditions.push(eq(ltcTasks.campusId, filter.campusId));
  if (filter.assigneePerId) conditions.push(eq(ltcTasks.assigneePerId, filter.assigneePerId));
  if (filter.statuses?.length) conditions.push(inArray(ltcTasks.status, filter.statuses));
  if (!conditions.length) return db.select().from(ltcTasks);
  return db.select().from(ltcTasks).where(and(...conditions));
}
