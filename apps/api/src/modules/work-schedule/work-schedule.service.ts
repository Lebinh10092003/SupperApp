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

import { and, desc, eq, gt, inArray, lt, ne, type SQL } from 'drizzle-orm';
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
import { pushAdminNotifications, type PushAdminNotificationsInput } from '../safety/admin-notify.js';
import { getPersonLabelsByPerIds } from '../identity/person-directory.js';

type Db = NodePgDatabase<Record<string, never>>;

// `admin_notifications` (bảng "chuông thông báo") ĐANG nằm ở module An
// toàn vì được xây trước — chính tài liệu ở đó đã ghi rõ CHỦ Ý dùng chung
// cho "mọi module trong Super App", chưa module nào khác nối vào (Lịch
// công tác là module ĐẦU TIÊN nối vào ngoài An toàn). KHÔNG port lại 1 bảng
// riêng ở đây — sẽ tách 2 chuông độc lập, sai với thiết kế gốc.
//
// Trước 2026-09-21, module này KHÔNG hề gọi tới đây — mọi hành động (tạo
// lịch, đổi trạng thái, giao việc, nghiệm thu...) THÀNH CÔNG ở tầng service
// nhưng người liên quan không hề biết, phải tự vào xem lại trang mới thấy
// (Sin phát hiện, yêu cầu rà soát toàn bộ trang Lịch công tác). Bổ sung ở
// đây — best-effort, KHÔNG BAO GIỜ để lỗi ghi chuông làm hỏng luồng nghiệp
// vụ chính (đúng triết lý `notify-hooks.ts` bên An toàn).
async function tryPushBell(db: Db, input: PushAdminNotificationsInput, opts?: { now?: Date }): Promise<void> {
  try {
    await pushAdminNotifications(db, input, opts);
  } catch (e) {
    console.error('[work-schedule] pushAdminNotifications lỗi (không chặn luồng nghiệp vụ chính):', e);
  }
}

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
// Dò "Lịch trùng" (conflictNote) — S3 trong CLAUDE.md cấp trên không nhắc
// tới trường này, đây là tính toán PHỤ port từ nghiệp vụ mới xác nhận: 2
// lịch TRÙNG khi (a) khoảng thời gian giao nhau thật sự và (b) có chung
// ít nhất 1 người trong participantPerIds. Chỉ xét lịch không phải
// CANCELLED. Tính đồng bộ ngay trong luồng tạo/sửa/hủy lịch (không phải
// job nền) để `RemindersPage.tsx` đọc được ngay khi tải trang.
//
// GIẢ ĐỊNH CHƯA XÁC NHẬN (nêu rõ để điều chỉnh sau nếu cần):
//   - Chỉ so participantPerIds, KHÔNG tính chairPerId là "người tham dự"
//     — đúng theo chữ nghĩa yêu cầu gốc, dù chủ trì thực tế cũng bận.
//   - Lịch scope=SCHOOL_WIDE nếu participantPerIds rỗng thì KHÔNG BAO GIỜ
//     bị tính là trùng với ai (giao với tập rỗng luôn rỗng) — cố tình
//     không tự suy diễn "toàn trường" thành danh sách người cụ thể.
//   - KHÔNG lọc theo campusId — 1 người có thể được xếp lịch ở 2 cơ sở
//     cùng giờ vẫn là xung đột thật (schema không đưa campusId vào điều
//     kiện dò trùng theo yêu cầu gốc).
//   - conflictNote dùng ID (UUID) của lịch kia làm "mã" vì bảng ltc_events
//     không có mã ngắn riêng như SC/TB bên module An toàn.
//   - Ghi participantPerIds (per_id thô) vào conflictNote, KHÔNG resolve
//     ra tên người — module này không có quyền/đường truy cập bảng
//     người dùng dùng chung (tránh truy cập chéo CSDL giữa các module).
//   - Thời gian nêu trong conflictNote là start/end của LỊCH KIA (không
//     phải khoảng giao nhau).
//   - Đổi conflictNote KHÔNG bump `version` và KHÔNG ghi audit log riêng
//     — coi đây là trường suy diễn/cache, không phải chỉnh sửa nghiệp vụ.
// ---------------------------------------------------------------------

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

function formatVnDateTime(date: Date): string {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())} ${pad(shifted.getUTCDate())}/${pad(shifted.getUTCMonth() + 1)}/${shifted.getUTCFullYear()}`;
}

type LtcEventRow = typeof ltcEvents.$inferSelect;

async function findOverlappingPartners(
  db: Db,
  args: { excludeEventId: string; startAt: Date; endAt: Date; participantPerIds: string[] }
): Promise<LtcEventRow[]> {
  if (!args.participantPerIds.length) return [];
  const rows = await db
    .select()
    .from(ltcEvents)
    .where(
      and(
        ne(ltcEvents.id, args.excludeEventId),
        ne(ltcEvents.status, 'CANCELLED'),
        lt(ltcEvents.startAt, args.endAt),
        gt(ltcEvents.endAt, args.startAt)
      )
    );
  return rows.filter((other) => other.participantPerIds.some((pid) => args.participantPerIds.includes(pid)));
}

/**
 * Trước đây ghi thẳng `per_id` thô vào conflictNote (lý do cũ: "module này
 * không có quyền/đường truy cập bảng người dùng dùng chung, tránh truy cập
 * chéo CSDL giữa các module") — lý do đó KHÔNG còn đúng: từ 2026-09-21
 * module này đã import `identity/person-directory.ts` để hiện tên+chức vụ
 * ở khắp nơi khác (chairLabel/participantLabels/assigneeLabel...), riêng
 * chỗ này bị bỏ sót nên vẫn lộ mã `PER_xxx` (Sin phát hiện qua ảnh chụp
 * banner "Trùng lịch"). Nay resolve tên giống hệt các chỗ khác.
 */
async function buildConflictNoteText(db: Db, event: LtcEventRow, partners: LtcEventRow[]): Promise<string> {
  if (!partners.length) return '';
  const allSharedPerIds = new Set<string>();
  for (const other of partners) {
    for (const pid of event.participantPerIds) {
      if (other.participantPerIds.includes(pid)) allSharedPerIds.add(pid);
    }
  }
  const labels = await getPersonLabelsByPerIds(db, Array.from(allSharedPerIds));
  return partners
    .map((other) => {
      const sharedPerIds = event.participantPerIds.filter((pid) => other.participantPerIds.includes(pid));
      const sharedLabels = sharedPerIds.map((pid) => labels[pid] ?? pid);
      return `Trùng giờ với lịch "${other.title}" (${other.id}) — cùng có ${sharedLabels.join(', ')} tham dự, từ ${formatVnDateTime(other.startAt)} đến ${formatVnDateTime(other.endAt)}.`;
    })
    .join('; ');
}

/**
 * Tính lại và ghi đè `conflictNote` cho ĐÚNG 1 lịch, dựa trên trạng thái
 * hiện tại của toàn bộ bảng (không cố giữ lịch sử ghi chú cũ). Không tự
 * lan sang lịch khác — dùng nội bộ bởi `recomputeConflictsForEvent`.
 */
async function computeAndPersistNoteForEvent(db: Db, eventId: string): Promise<{ event: LtcEventRow | null; partnerIds: string[] }> {
  const [event] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventId)).limit(1);
  if (!event) return { event: null, partnerIds: [] };

  if (event.status === 'CANCELLED') {
    if (event.conflictNote) {
      await db.update(ltcEvents).set({ conflictNote: '' }).where(eq(ltcEvents.id, eventId));
    }
    return { event, partnerIds: [] };
  }

  const partners = await findOverlappingPartners(db, {
    excludeEventId: eventId,
    startAt: event.startAt,
    endAt: event.endAt,
    participantPerIds: event.participantPerIds
  });
  const note = await buildConflictNoteText(db, event, partners);
  if (event.conflictNote !== note) {
    await db.update(ltcEvents).set({ conflictNote: note }).where(eq(ltcEvents.id, eventId));
  }
  return { event, partnerIds: partners.map((p) => p.id) };
}

/**
 * Điểm vào DUY NHẤT để dò/ghi lại "Lịch trùng" — gọi sau khi tạo lịch,
 * sau khi sửa thời gian/thành phần tham dự, và sau khi hủy lịch. `eventId`
 * là lịch vừa thay đổi; `alsoRefreshEventIds` là các lịch KHÁC cần tính
 * lại cùng lượt (ví dụ: lịch từng trùng với lịch này TRƯỚC khi sửa/hủy,
 * để họ được xoá conflictNote nếu nay hết trùng — quan hệ trùng là 2
 * chiều nhưng đối xứng theo trạng thái MỚI, nên cần truyền tường minh tập
 * đối tác CŨ, không tự suy ra được).
 */
export async function recomputeConflictsForEvent(
  db: Db,
  eventId: string,
  opts: { alsoRefreshEventIds?: string[] } = {}
): Promise<void> {
  const { partnerIds } = await computeAndPersistNoteForEvent(db, eventId);
  const idsToRefresh = new Set<string>([...(opts.alsoRefreshEventIds ?? []), ...partnerIds]);
  idsToRefresh.delete(eventId);
  for (const id of idsToRefresh) {
    await computeAndPersistNoteForEvent(db, id);
  }
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
export async function createEvent(db: Db, input: CreateEventInput, opts: { now?: Date } = {}) {
  if (!input.title) throw new AppError('invalid_input', 'Thiếu tiêu đề sự kiện.');
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!(input.startAt instanceof Date) || !(input.endAt instanceof Date) || Number.isNaN(input.startAt.getTime()) || Number.isNaN(input.endAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng startAt/endAt.');
  }
  if (input.startAt.getTime() < Date.now()) {
    throw new AppError('invalid_input', 'Thời gian bắt đầu không được ở trong quá khứ.');
  }
  if (input.endAt.getTime() <= input.startAt.getTime()) {
    throw new AppError('invalid_input', 'Thời gian kết thúc phải sau thời gian bắt đầu.');
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

  try {
    await recomputeConflictsForEvent(db, row.id);
  } catch {
    // Dò trùng là tính toán PHỤ — lỗi ở đây không được làm hỏng luồng tạo lịch chính.
  }
  const [freshRow] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, row.id)).limit(1);
  const finalRow = freshRow ?? row;

  await tryPushBell(
    db,
    {
      recipients: [row.chairPerId, ...(row.participantPerIds || [])],
      title: 'Lịch công tác mới: ' + row.title,
      message: input.createdByPerId + ' vừa tạo lịch "' + row.title + '" — bạn được mời tham dự.',
      eventType: 'work_schedule.event.created',
      objectId: row.id,
      actorPerId: input.createdByPerId
    },
    opts
  );

  return finalRow;
}

/**
 * Chỉnh sửa nội dung lịch bị trả lại. Chỉ người tạo được sửa và chỉ khi
 * lịch đang ở DRAFT hoặc REVISION_REQUIRED — trạng thái GIỮ NGUYÊN để
 * người tạo tự kiểm tra rồi bấm "Gửi duyệt lại" sau khi lưu.
 */
export async function updateRevisionEvent(
  db: Db,
  input: { eventId: string; eventData: Partial<CreateEventInput>; actorPerId: string },
  opts: { now?: Date } = {}
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
  if (eventData.startAt.getTime() < Date.now()) {
    throw new AppError('invalid_input', 'Thời gian bắt đầu không được ở trong quá khứ.');
  }
  if (eventData.endAt.getTime() <= eventData.startAt.getTime()) {
    throw new AppError('invalid_input', 'Thời gian kết thúc phải sau thời gian bắt đầu.');
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

  try {
    const oldPartnerIds = (
      await findOverlappingPartners(db, {
        excludeEventId: input.eventId,
        startAt: before.startAt,
        endAt: before.endAt,
        participantPerIds: before.participantPerIds
      })
    ).map((p) => p.id);
    await recomputeConflictsForEvent(db, input.eventId, { alsoRefreshEventIds: oldPartnerIds });
  } catch {
    // Dò trùng là tính toán PHỤ — lỗi ở đây không được làm hỏng luồng sửa lịch chính.
  }
  const [freshAfter] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
  const finalEvent = freshAfter ?? after!;

  await tryPushBell(
    db,
    {
      recipients: [finalEvent.chairPerId, ...(finalEvent.participantPerIds || [])],
      title: 'Lịch vừa được sửa lại: ' + finalEvent.title,
      message: input.actorPerId + ' vừa cập nhật nội dung lịch "' + finalEvent.title + '".',
      eventType: 'work_schedule.event.updated_for_revision',
      objectId: input.eventId,
      actorPerId: input.actorPerId
    },
    opts
  );

  return finalEvent;
}

/**
 * Đổi trạng thái 1 sự kiện. KHÔNG kiểm tra actor có quyền duyệt hay không
 * (xem ghi chú đầu file) — chỉ đảm bảo bước chuyển hợp lệ theo state
 * machine. `note` bắt buộc khi chuyển sang REVISION_REQUIRED/CANCELLED.
 */
export async function changeEventStatus(
  db: Db,
  input: { eventId: string; nextStatus: string; note?: string; actorPerId: string; actorAssignments?: ActorAssignment[] },
  opts: { now?: Date } = {}
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

  if (nextStatus === 'REVISION_REQUIRED') {
    await tryPushBell(
      db,
      {
        recipients: [before.createdByPerId],
        title: 'Lịch cần sửa lại: ' + before.title,
        message: input.actorPerId + ' yêu cầu sửa lại lịch "' + before.title + '" — lý do: ' + input.note,
        eventType: 'work_schedule.event.revision_required',
        objectId: input.eventId,
        actorPerId: input.actorPerId
      },
      opts
    );
  }
  if (nextStatus === 'CANCELLED') {
    await tryPushBell(
      db,
      {
        recipients: [before.createdByPerId, before.chairPerId, ...(before.participantPerIds || [])],
        title: 'Lịch đã bị hủy: ' + before.title,
        message: input.actorPerId + ' đã hủy lịch "' + before.title + '" — lý do: ' + input.note,
        eventType: 'work_schedule.event.cancelled',
        objectId: input.eventId,
        actorPerId: input.actorPerId
      },
      opts
    );
  }

  if (nextStatus === 'CANCELLED') {
    try {
      const oldPartnerIds = (
        await findOverlappingPartners(db, {
          excludeEventId: input.eventId,
          startAt: before.startAt,
          endAt: before.endAt,
          participantPerIds: before.participantPerIds
        })
      ).map((p) => p.id);
      // Lịch vừa bị hủy tự xoá conflictNote của chính nó (nhánh CANCELLED
      // trong computeAndPersistNoteForEvent); các lịch từng trùng với nó
      // (oldPartnerIds, tính từ dữ liệu TRƯỚC khi hủy) được tính lại để
      // xoá phần nhắc tới lịch này nếu nay không còn trùng ai khác.
      await recomputeConflictsForEvent(db, input.eventId, { alsoRefreshEventIds: oldPartnerIds });
    } catch {
      // Dò trùng là tính toán PHỤ — lỗi ở đây không được làm hỏng luồng hủy lịch chính.
    }
    const [freshAfter] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
    return freshAfter ?? after!;
  }
  return after!;
}

/**
 * Duyệt 1 sự kiện đang PENDING_APPROVAL — điểm vào DUY NHẤT hợp lệ cho
 * bước "duyệt". `actorAssignments` phải được tầng gọi nạp THẬT từ bảng
 * identity dùng chung trước khi gọi hàm này — không tự tin bất kỳ gì
 * client tự khai về vai trò.
 */
export async function approveEvent(
  db: Db,
  input: { eventId: string; actorPerId: string; actorAssignments: ActorAssignment[] },
  opts: { now?: Date } = {}
) {
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

  if (decision.becomesPublished) {
    await tryPushBell(
      db,
      {
        recipients: [before.createdByPerId, before.chairPerId, ...(before.participantPerIds || [])],
        title: 'Lịch đã được ban hành: ' + before.title,
        message: 'Lịch "' + before.title + '" đã được duyệt xong (ban hành).',
        eventType: 'work_schedule.event.published',
        objectId: input.eventId,
        actorPerId: input.actorPerId
      },
      opts
    );
  } else {
    await tryPushBell(
      db,
      {
        recipients: [before.createdByPerId],
        title: 'Lịch vừa được duyệt 1 bước: ' + before.title,
        message: input.actorPerId + ' vừa duyệt lịch "' + before.title + '" (còn chờ bước duyệt tiếp theo).',
        eventType: 'work_schedule.event.approval_step',
        objectId: input.eventId,
        actorPerId: input.actorPerId
      },
      opts
    );
  }

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

export async function createTask(db: Db, input: CreateTaskInput, opts: { now?: Date } = {}) {
  if (!input.title) throw new AppError('invalid_input', 'Thiếu tiêu đề công việc.');
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!input.assigneePerId) throw new AppError('invalid_input', 'Thiếu assigneePerId (người được giao).');
  if (!(input.dueAt instanceof Date) || Number.isNaN(input.dueAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng dueAt.');
  }
  if (input.dueAt.getTime() < Date.now()) {
    throw new AppError('invalid_input', 'Hạn hoàn thành không được ở trong quá khứ.');
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

  if (row.assigneePerId !== input.createdByPerId) {
    await tryPushBell(
      db,
      {
        recipients: [row.assigneePerId, ...(row.collaboratorPerIds || [])],
        title: 'Việc mới được giao: ' + row.title,
        message: input.createdByPerId + ' vừa giao việc "' + row.title + '" cho bạn, hạn ' + row.dueAt.toISOString(),
        eventType: 'work_schedule.task.created',
        objectId: row.id,
        actorPerId: input.createdByPerId
      },
      opts
    );
  }
  return row;
}

export async function changeTaskStatus(
  db: Db,
  input: { taskId: string; nextStatus: string; note?: string; evidenceUrl?: string; actorPerId: string },
  opts: { now?: Date } = {}
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

  // Báo "phía bên kia" — người giao khi người thực hiện đổi trạng thái
  // (quan trọng nhất: PENDING_ACCEPTANCE, báo người giao vào nghiệm thu),
  // hoặc người thực hiện khi người giao hủy việc.
  const otherPartyPerId = input.actorPerId === before.assigneePerId ? before.createdByPerId : before.assigneePerId;
  if (otherPartyPerId && otherPartyPerId !== input.actorPerId) {
    const isCancelled = nextStatus === 'CANCELLED';
    await tryPushBell(
      db,
      {
        recipients: [otherPartyPerId],
        title: (isCancelled ? 'Việc đã bị hủy: ' : 'Việc đổi trạng thái: ') + before.title,
        message:
          input.actorPerId +
          ' đã chuyển việc "' +
          before.title +
          '" sang trạng thái ' +
          nextStatus +
          (nextStatus === 'PENDING_ACCEPTANCE' ? ' — cần bạn nghiệm thu.' : '.') +
          (isCancelled && input.note ? ' Lý do: ' + input.note : ''),
        eventType: 'work_schedule.task.status_changed',
        objectId: input.taskId,
        actorPerId: input.actorPerId
      },
      opts
    );
  }
  return after!;
}

/**
 * Nghiệm thu (COMPLETED) hoặc trả lại (RETURNED) 1 công việc đang
 * PENDING_ACCEPTANCE — điểm vào DUY NHẤT hợp lệ. Nguyên văn Mr Tiến:
 * "Luồng giao việc do người giao xác nhận nghiệm thu" — actor PHẢI là
 * task.createdByPerId, không phải theo vai trò.
 */
export async function acceptOrReturnTask(
  db: Db,
  input: { taskId: string; nextStatus: 'COMPLETED' | 'RETURNED'; note?: string; actorPerId: string },
  opts: { now?: Date } = {}
) {
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

  await tryPushBell(
    db,
    {
      recipients: [before.assigneePerId],
      title: (input.nextStatus === 'COMPLETED' ? 'Việc đã được nghiệm thu: ' : 'Việc bị trả lại: ') + before.title,
      message:
        input.actorPerId +
        (input.nextStatus === 'COMPLETED' ? ' đã nghiệm thu việc "' : ' trả lại việc "') +
        before.title +
        '".' +
        (input.note ? ' Ghi chú: ' + input.note : ''),
      eventType: input.nextStatus === 'COMPLETED' ? 'work_schedule.task.accepted' : 'work_schedule.task.returned',
      objectId: input.taskId,
      actorPerId: input.actorPerId
    },
    opts
  );

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

// ---------------------------------------------------------------------
// Nhật ký kiểm toán (ltc_audit_logs) — CHỈ đọc, ghi đã có sẵn trong mọi
// hàm đổi trạng thái ở trên (`writeAuditLog`). Trước đây KHÔNG có route
// HTTP nào đọc lại bảng này — bổ sung để frontend hiển thị panel lịch sử.
// ---------------------------------------------------------------------

export interface GetAuditLogsFilter {
  entityType?: string;
  entityId?: string;
  limit?: number;
}

export async function getAuditLogs(db: Db, filter: GetAuditLogsFilter = {}) {
  const conditions: SQL[] = [];
  if (filter.entityType) conditions.push(eq(ltcAuditLogs.entityType, filter.entityType));
  if (filter.entityId) conditions.push(eq(ltcAuditLogs.entityId, filter.entityId));
  const limit = filter.limit && filter.limit > 0 ? Math.min(filter.limit, 200) : 50;
  const base = db.select().from(ltcAuditLogs);
  const query = conditions.length ? base.where(and(...conditions)) : base;
  return query.orderBy(desc(ltcAuditLogs.createdAt)).limit(limit);
}
