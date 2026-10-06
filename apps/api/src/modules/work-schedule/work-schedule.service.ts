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

import { and, desc, eq, gt, gte, inArray, isNotNull, lt, lte, ne, or, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  ltcEvents,
  ltcTasks,
  ltcAuditLogs,
  VALID_EVENT_STATUSES,
  VALID_TASK_STATUSES,
  VALID_CAMPUS_IDS,
  type EventStatus,
  type TaskStatus,
  type CampusId
} from './work-schedule.schema.js';
import { evaluateEventApproval, canApproveCampusEvent, isLeadership, type ActorAssignment } from './work-schedule.authz.js';
import { pushAdminNotifications, type PushAdminNotificationsInput } from '../safety/admin-notify.js';
import { getPersonLabelsByPerIds } from '../identity/person-directory.js';
import * as notify from '../safety/notify.js';
import { notifyRequests } from '../safety/dispatch.schema.js';
import { notifyRequestToRow } from '../safety/shared.js';
import { makeDispatchHook } from '../safety/notify-hooks.js';

type Db = NodePgDatabase<Record<string, never>>;

/**
 * Tra tên hiển thị 1 người cho nội dung chuông/email/push — Sin phản hồi
 * 2026-09-24: message ghép thẳng perId (mã "PER_xxx") vào câu, không ai
 * đọc hiểu được (cùng lỗi đã sửa ở incident-lifecycle.ts). Trả về mã gốc
 * nếu không tra được tên (không throw — không chặn luồng nghiệp vụ chính).
 */
async function nameForBell(db: Db, perId: string | null | undefined): Promise<string> {
  if (!perId) return '(không rõ)';
  try {
    const labels = await getPersonLabelsByPerIds(db, [perId]);
    return labels[perId] || perId;
  } catch {
    return perId;
  }
}

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

// Bổ sung 2026-09-24 — Sin chốt sau khi rà soát: module này (giống An toàn
// trước đây) mới chỉ có chuông trong app, chưa hề gửi email/push thật dù đã
// có adapter thật (email-adapter.ts, push-adapter.ts, dùng chung toàn Super
// App qua notify-hooks.ts). Nối thêm SONG SONG với chuông ở CẢ 9 điểm gọi
// tryPushBell — dùng chung 1 hàm này để không lặp code 9 lần. `urgency`
// mặc định NORMAL (chỉ in_app, giữ nguyên hành vi cũ) — truyền
// `notify.URGENCY.HIGH` ở lời gọi cho các sự kiện CẦN HÀNH ĐỘNG thật (yêu
// cầu duyệt, giao việc, huỷ lịch...) để có thêm email+push.
const dispatch = makeDispatchHook();
async function notifyAll(
  db: Db,
  input: PushAdminNotificationsInput & { deepLink?: string; urgency?: notify.Urgency },
  opts?: { now?: Date }
): Promise<void> {
  await tryPushBell(db, input, opts);
  const recipients = (input.recipients || []).filter((v): v is string => !!v);
  if (recipients.length === 0) return;
  try {
    const now = opts?.now ?? new Date();
    const request = notify.buildNotifyRequest({
      recipients,
      priority: 'P2', // không dùng để tính urgency — urgencyOverride ở dưới luôn thắng
      objectId: input.objectId || 'work-schedule',
      objectCode: input.title,
      actionNeeded: input.message,
      deepLink: input.deepLink,
      eventType: input.eventType,
      urgencyOverride: input.urgency ?? notify.URGENCY.NORMAL
    });
    const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
    if (savedRequest) await dispatch(db, savedRequest, { now });
  } catch (e) {
    console.error('[work-schedule] dispatch email/push lỗi (không chặn luồng nghiệp vụ chính):', e);
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
// SỬA 2026-09-29 (Sin: "cái huỷ thì đừng có hiển ở lịch nữa... mặc định
// là ẩn lịch đã huỷ đi... có option xoá hẳn hoặc khôi phục lại") — thêm
// đường khôi phục CANCELLED -> PUBLISHED.
export const EVENT_ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['DRAFT', 'REVISION_REQUIRED', 'CANCELLED'],
  REVISION_REQUIRED: ['PENDING_APPROVAL', 'CANCELLED'],
  // 'DRAFT' bổ sung 2026-10-05 (Sin: "cho sửa lịch đã ban hành theo luồng
  // Đã ban hành -> về Nháp -> sửa -> ban hành lại") — khớp đúng sơ đồ gốc
  // §26 huong_dan_lich_cong_tac_giao_viec.md ("Đã ban hành -> Chỉnh sửa").
  // Về Dự thảo xong thì đi lại đúng workflow ban hành cũ (DRAFT ->
  // PENDING_APPROVAL -> PUBLISHED cho SCHOOL_WIDE, hoặc sửa xong publish
  // thẳng lại cho CAMPUS — xem updateRevisionEvent/createEvent), không có
  // lối tắt riêng nào khác.
  PUBLISHED: ['CANCELLED', 'DRAFT'],
  CANCELLED: ['PUBLISHED']
};

// 2026-10-05 (huong_dan_lich_cong_tac_giao_viec.md §12.4/§13) — thu gọn
// còn đúng 2 trạng thái: ASSIGNED ("Đã giao") <-> COMPLETED ("Đã hoàn
// thành"). Bỏ hẳn ACCEPTED/IN_PROGRESS/PENDING_ACCEPTANCE/RETURNED/
// CANCELLED và luồng nghiệm thu/từ chối riêng (acceptOrReturnTask đã xoá)
// — chỉ người chủ trì (assigneePerId) được tự chuyển, cho lùi lại ASSIGNED
// nếu đánh dấu nhầm (đối xứng, không cần lý do).
export const TASK_ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  ASSIGNED: ['COMPLETED'],
  COMPLETED: ['ASSIGNED']
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
  args: { excludeEventId: string; startAt: Date; endAt: Date | null; participantPerIds: string[] }
): Promise<LtcEventRow[]> {
  if (!args.participantPerIds.length) return [];
  // 2026-10-05 (Sin: "giờ kết thúc không bắt buộc") — không thể tính
  // "trùng giờ" nếu thiếu 1 trong 2 mốc thời gian, nên: (a) lịch ĐANG xét
  // không có endAt -> bỏ qua hẳn việc dò trùng cho lịch đó; (b) lịch KHÁC
  // trong DB không có endAt -> loại khỏi tập ứng viên so khớp (không coi là
  // trùng với bất kỳ ai).
  if (!args.endAt) return [];
  const rows = await db
    .select()
    .from(ltcEvents)
    .where(
      and(
        ne(ltcEvents.id, args.excludeEventId),
        ne(ltcEvents.status, 'CANCELLED'),
        isNotNull(ltcEvents.endAt),
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
      // KHÔNG kèm mã UUID thô của lịch kia trong ngoặc — vô nghĩa với người
      // dùng cuối, tiêu đề trong ngoặc kép đã đủ nhận diện (Mr Tiến phản hồi
      // 2026-09-21, kèm ví dụ thật còn sót cả UUID lẫn PER_xxx thô).
      // `other.endAt` chắc chắn khác null — `findOverlappingPartners` đã lọc
      // `isNotNull(ltcEvents.endAt)` trước khi trả về, TS không suy ra được
      // qua SQL nên assert tay.
      return `Trùng giờ với lịch "${other.title}" — cùng có ${sharedLabels.join(', ')} tham dự, từ ${formatVnDateTime(other.startAt)} đến ${formatVnDateTime(other.endAt!)}.`;
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
  // Tuỳ chọn (2026-10-05, Sin: "giờ kết thúc không bắt buộc") — null/
  // undefined nghĩa là chưa khai báo thời điểm kết thúc.
  endAt?: Date | null;
  location?: string;
  chairPerId: string;
  participantPerIds?: string[];
  // "Người khác (không có tài khoản)" — chữ tự do, xem ghi chú schema.
  externalParticipants?: string[];
  departmentDomain?: string | null;
  createdByPerId: string;
}

/**
 * Tạo mới 1 sự kiện lịch công tác — luôn khởi tạo trạng thái DRAFT bất kể
 * client gửi gì (mọi sự kiện phải qua DRAFT trước khi vào luồng duyệt).
 */
export async function createEvent(db: Db, input: CreateEventInput, opts: { now?: Date } = {}) {
  const now = opts.now ?? new Date();
  if (!input.title) throw new AppError('invalid_input', 'Thiếu tiêu đề sự kiện.');
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!(input.startAt instanceof Date) || Number.isNaN(input.startAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng startAt.');
  }
  if (input.endAt != null && (!(input.endAt instanceof Date) || Number.isNaN(input.endAt.getTime()))) {
    throw new AppError('invalid_input', 'Sai định dạng endAt.');
  }
  if (input.startAt.getTime() < now.getTime()) {
    throw new AppError('invalid_input', 'Thời gian bắt đầu không được ở trong quá khứ.');
  }
  if (input.endAt != null && input.endAt.getTime() <= input.startAt.getTime()) {
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
      endAt: input.endAt ?? null,
      location: input.location || '',
      chairPerId: input.chairPerId,
      participantPerIds: input.participantPerIds ?? [],
      externalParticipants: input.externalParticipants ?? [],
      // 2026-10-05 (huong_dan_lich_cong_tac_giao_viec.md §3-4) — KHÔI PHỤC
      // gate duyệt cho lịch TOÀN TRƯỜNG (bản 2026-09-29 từng bỏ hẳn duyệt
      // cho mọi scope — spec mới yêu cầu rõ lịch Toàn trường phải qua Hiệu
      // trưởng/Hiệu phó Điểm trường chính duyệt trước khi Đã ban hành,
      // lịch CAMPUS/PH1/PH2 vẫn ban hành ngay như cũ, không đổi). Dùng
      // đúng state machine PENDING_APPROVAL -> (approveEvent) -> PUBLISHED
      // đã có sẵn (work-schedule.authz.ts), giờ đơn giản hoá còn 1 bước.
      status: input.scope === 'SCHOOL_WIDE' ? 'PENDING_APPROVAL' : 'PUBLISHED',
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

  await notifyAll(
    db,
    {
      recipients: [row.chairPerId, ...(row.participantPerIds || [])],
      title: 'Lịch công tác mới: ' + row.title,
      message: (await nameForBell(db, input.createdByPerId)) + ' vừa tạo lịch "' + row.title + '" — bạn được mời tham dự.',
      eventType: 'work_schedule.event.created',
      objectId: row.id,
      actorPerId: input.createdByPerId,
      deepLink: '/work-schedule'
    },
    opts
  );

  return finalRow;
}

/**
 * Chỉnh sửa nội dung lịch — SỬA 2026-09-29 (Sin yêu cầu, bỏ gate duyệt,
 * xem ghi chú ở createEvent): trước đây CHỈ sửa được khi DRAFT/
 * REVISION_REQUIRED (2 trạng thái giờ không còn đường nào tạo ra nữa) và
 * CHỈ người tạo — giờ cho sửa TỰ DO hơn: người tạo HOẶC chủ trì, ở MỌI
 * trạng thái TRỪ CANCELLED (sự kiện đã huỷ là bản ghi lịch sử, sửa lại
 * không có ý nghĩa — muốn làm lại thì tạo lịch mới). Tên hàm giữ nguyên
 * `updateRevisionEvent` (không đổi tên tránh rung chuyển nhiều chỗ gọi)
 * dù không còn gắn chặt với khái niệm "revision" nữa — bản chất giờ là
 * "sửa lịch" nói chung. Vẫn ghi đủ audit log trước/sau (đúng yêu cầu
 * "audit được hết, ai làm sai thì sửa lại thôi") + dò trùng lịch lại như
 * cũ, KHÔNG đổi 2 phần đó. */
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
  if (!(eventData.startAt instanceof Date) || Number.isNaN(eventData.startAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng startAt.');
  }
  if (eventData.endAt != null && (!(eventData.endAt instanceof Date) || Number.isNaN(eventData.endAt.getTime()))) {
    throw new AppError('invalid_input', 'Sai định dạng endAt.');
  }
  if (eventData.startAt.getTime() < (opts.now ?? new Date()).getTime()) {
    throw new AppError('invalid_input', 'Thời gian bắt đầu không được ở trong quá khứ.');
  }
  if (eventData.endAt != null && eventData.endAt.getTime() <= eventData.startAt.getTime()) {
    throw new AppError('invalid_input', 'Thời gian kết thúc phải sau thời gian bắt đầu.');
  }
  const [before] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, input.eventId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy sự kiện ${input.eventId}`);
  // SỬA 2026-09-29 (Sin: "lịch đã huỷ thì vẫn cho edit như thường thôi") —
  // trước đây chặn sửa lịch CANCELLED, giờ bỏ hẳn chốt đó: sửa nội dung
  // KHÔNG tự động khôi phục trạng thái (vẫn CANCELLED sau khi sửa) — khôi
  // phục là thao tác riêng (changeEventStatus CANCELLED -> PUBLISHED).
  if (before.createdByPerId !== input.actorPerId && before.chairPerId !== input.actorPerId) {
    throw new AppError('forbidden', 'Chỉ người tạo lịch hoặc chủ trì mới được chỉnh sửa.');
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
      endAt: eventData.endAt ?? null,
      location: eventData.location || '',
      // 2026-09-30 (Sin: "phó hiệu trưởng nhờ giáo viên tạo hộ lịch") —
      // trước đây route PATCH không hề forward chairPerId (dù cột DB đã có
      // sẵn) — sửa lịch KHÔNG BAO GIỜ đổi được người chủ trì, kể cả khi FE
      // gửi lên. Giữ nguyên chairPerId cũ nếu không truyền (sửa các trường
      // khác không vô tình đổi chủ trì).
      chairPerId: eventData.chairPerId || before.chairPerId,
      participantPerIds: eventData.participantPerIds ?? [],
      externalParticipants: eventData.externalParticipants ?? [],
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

  await notifyAll(
    db,
    {
      recipients: [finalEvent.chairPerId, ...(finalEvent.participantPerIds || [])],
      title: 'Lịch vừa được sửa lại: ' + finalEvent.title,
      message: (await nameForBell(db, input.actorPerId)) + ' vừa cập nhật nội dung lịch "' + finalEvent.title + '".',
      eventType: 'work_schedule.event.updated_for_revision',
      objectId: input.eventId,
      actorPerId: input.actorPerId,
      deepLink: '/work-schedule'
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

  if (nextStatus === 'DRAFT') {
    const isCreator = before.createdByPerId === input.actorPerId;
    if (before.status === 'PENDING_APPROVAL') {
      if (!isCreator) throw new AppError('forbidden', 'Chỉ người tạo mới được thu hồi lịch chưa duyệt về Dự thảo.');
    } else if (before.status === 'PUBLISHED') {
      // Bổ sung 2026-10-05 — "Đã ban hành -> về Nháp để sửa" (xem
      // EVENT_ALLOWED_TRANSITIONS ở trên): cho phép người tạo HOẶC đúng
      // người có quyền duyệt sự kiện này (cùng bộ vai trò dùng để
      // duyệt/huỷ 1 lịch Đã ban hành — evaluateEventApproval ở trên), để
      // không ai ngoài 2 nhóm đó tự ý rút 1 lịch đã công bố về sửa.
      const assignments = input.actorAssignments || [];
      const canApprove = before.scope === 'SCHOOL_WIDE' ? isLeadership(assignments) : canApproveCampusEvent(assignments, before);
      if (!isCreator && !canApprove) {
        throw new AppError('forbidden', 'Chỉ người tạo hoặc người có quyền duyệt lịch này mới được chuyển lại Dự thảo để sửa.');
      }
    } else {
      throw new AppError('forbidden', 'Không thể chuyển sự kiện này về Dự thảo từ trạng thái hiện tại.');
    }
  }
  // SỬA 2026-09-29 (Sin yêu cầu, bỏ gate duyệt — xem ghi chú ở createEvent):
  // trước đây chặn CHÍNH người tạo đổi trạng thái 1 lịch đã PUBLISHED nếu
  // không có vai trò Hiệu trưởng — lý do gốc: "đã ban hành nghĩa là đã có
  // người CÓ THẨM QUYỀN duyệt, người tạo một mình không được tự ý đảo
  // ngược quyết định đó". Lý do đó KHÔNG CÒN ĐÚNG NỮA vì giờ không còn ai
  // duyệt PUBLISHED cả — tạo là ban hành luôn (createEvent status:
  // 'PUBLISHED' ngay). Giữ đúng tinh thần "audit được hết, ai làm sai thì
  // sửa lại thôi": bỏ hẳn chốt chặn này, không thay bằng chốt khác — audit
  // log (writeAuditLog ngay dưới) đã đủ để truy vết ai đổi gì.
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
    await notifyAll(
      db,
      {
        recipients: [before.createdByPerId],
        title: 'Lịch cần sửa lại: ' + before.title,
        message: (await nameForBell(db, input.actorPerId)) + ' yêu cầu sửa lại lịch "' + before.title + '" — lý do: ' + input.note,
        eventType: 'work_schedule.event.revision_required',
        objectId: input.eventId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule',
        urgency: notify.URGENCY.HIGH
      },
      opts
    );
  }
  if (nextStatus === 'CANCELLED') {
    await notifyAll(
      db,
      {
        recipients: [before.createdByPerId, before.chairPerId, ...(before.participantPerIds || [])],
        title: 'Lịch đã bị hủy: ' + before.title,
        message: (await nameForBell(db, input.actorPerId)) + ' đã hủy lịch "' + before.title + '" — lý do: ' + input.note,
        eventType: 'work_schedule.event.cancelled',
        objectId: input.eventId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule',
        urgency: notify.URGENCY.HIGH
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
  // Khôi phục CANCELLED -> PUBLISHED (bổ sung 2026-09-29, Sin: "có option
  // khôi phục lại") — tính lại dò trùng cho lịch vừa khôi phục, y hệt lúc
  // tạo mới (nó có thể nay trùng lịch khác đã phát sinh trong lúc nó bị huỷ).
  if (nextStatus === 'PUBLISHED' && before.status === 'CANCELLED') {
    try {
      await recomputeConflictsForEvent(db, input.eventId);
    } catch {
      // Dò trùng là tính toán PHỤ.
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
    await notifyAll(
      db,
      {
        recipients: [before.createdByPerId, before.chairPerId, ...(before.participantPerIds || [])],
        title: 'Lịch đã được ban hành: ' + before.title,
        message: 'Lịch "' + before.title + '" đã được duyệt xong (ban hành).',
        eventType: 'work_schedule.event.published',
        objectId: input.eventId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule',
        urgency: notify.URGENCY.HIGH
      },
      opts
    );
  } else {
    await notifyAll(
      db,
      {
        recipients: [before.createdByPerId],
        title: 'Lịch vừa được duyệt 1 bước: ' + before.title,
        message: (await nameForBell(db, input.actorPerId)) + ' vừa duyệt lịch "' + before.title + '" (còn chờ bước duyệt tiếp theo).',
        eventType: 'work_schedule.event.approval_step',
        objectId: input.eventId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule'
      },
      opts
    );
  }

  return after!;
}

/**
 * Xoá HẲN 1 sự kiện — bổ sung 2026-09-29 (Sin: "có option... xoá hẳn lịch
 * đã huỷ"). CHỈ áp dụng cho actor là người tạo/chủ trì, hoặc lãnh đạo
 * (`isAdmin`, truyền từ route sau khi kiểm `isLeadership`) — không giới
 * hạn chỉ xoá được lịch đã CANCELLED (route quyết định khi nào cho bấm nút
 * này, service không tự áp thêm luật trạng thái). `ltc_tasks.event_id` có
 * `onDelete: 'set null'` sẵn trong schema — việc nhỏ từng gắn sự kiện này
 * KHÔNG bị xoá theo, chỉ mất liên kết.
 */
export async function deleteEvent(db: Db, eventId: string, actorPerId: string, opts: { isAdmin?: boolean } = {}) {
  const [before] = await db.select().from(ltcEvents).where(eq(ltcEvents.id, eventId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy sự kiện ${eventId}`);
  if (!opts.isAdmin && before.createdByPerId !== actorPerId && before.chairPerId !== actorPerId) {
    throw new AppError('forbidden', 'Chỉ người tạo, chủ trì, hoặc quản trị mới được xoá hẳn lịch.');
  }
  await writeAuditLog(db, { entityType: 'event', entityId: eventId, action: 'event.deleted', actorPerId, before });
  await db.delete(ltcEvents).where(eq(ltcEvents.id, eventId));
}

export async function listEvents(
  db: Db,
  // `forPerId` (bổ sung 2026-09-29, Sin: "lịch của ai thì xem lịch người đó
  // thôi, ko hiện xem tất cả các lịch chung") — khi truyền, CHỈ trả về sự
  // kiện actor là chủ trì HOẶC có trong thành phần tham dự, CỘNG lịch
  // scope=SCHOOL_WIDE nếu `includeSchoolWide` không bị tắt (mặc định BẬT —
  // "có thể ẩn lịch toàn trường hoặc cũng hiện cả lịch toàn trường cho đỡ
  // rối", người dùng tự chọn qua nút ẩn/hiện ở UI, server chỉ theo đúng cờ
  // được truyền). Không truyền `forPerId` = giữ hành vi CŨ (liệt kê tất cả —
  // dùng cho `/calendar.ics` công khai và các job nội bộ không gắn 1 actor
  // cụ thể).
  filter: { campusId?: string; statuses?: string[]; forPerId?: string; includeSchoolWide?: boolean } = {},
  // `withTaskProgress` mặc định BẬT (xem `attachTaskProgress` bên dưới) —
  // TẮT riêng cho `/calendar.ics` (route công khai KHÔNG cần đăng nhập,
  // xem work-schedule.routes.ts): route đó không hiện % tiến độ, thêm 1
  // query task-progress vào đấy chỉ tốn tài nguyên vô ích trên 1 endpoint
  // công khai có thể bị app lịch ngoài (Google Calendar/Outlook) polling
  // lặp lại thường xuyên.
  opts: { withTaskProgress?: boolean } = {}
) {
  const conditions: SQL[] = [];
  if (filter.campusId) conditions.push(eq(ltcEvents.campusId, filter.campusId));
  if (filter.statuses?.length) conditions.push(inArray(ltcEvents.status, filter.statuses));
  if (filter.forPerId) {
    const perId = filter.forPerId;
    const personal = or(eq(ltcEvents.chairPerId, perId), sql`${perId} = ANY(${ltcEvents.participantPerIds})`)!;
    conditions.push(
      filter.includeSchoolWide === false ? personal : or(personal, eq(ltcEvents.scope, 'SCHOOL_WIDE'))!
    );
  }
  // Trước đây KHÔNG có orderBy — trả về theo thứ tự bất kỳ của DB (thường
  // trùng thứ tự chèn, không đáng tin). Mặc định lịch mới nhất lên đầu (Sin
  // yêu cầu 2026-09-21) — trang nào cần thứ tự khác (VD Tổng quan sắp tới
  // gần nhất trước) tự sort lại ở client, không phụ thuộc thứ tự API.
  const base = db.select().from(ltcEvents);
  const query = conditions.length ? base.where(and(...conditions)) : base;
  const events = await query.orderBy(desc(ltcEvents.startAt));
  if (opts.withTaskProgress === false) return events.map((e) => ({ ...e, taskCount: 0, taskCompletedCount: 0, taskProgressPercent: null as number | null }));
  return attachTaskProgress(db, events);
}

/**
 * Gắn `taskCount`/`taskCompletedCount`/`taskProgressPercent` vào mỗi sự
 * kiện — Sin yêu cầu 2026-09-28 (note của 2 thầy dạy Lịch công tác): "việc
 * lớn... ở ngoài hiện tiến độ theo kiểu phần trăm". Trước đây KHÔNG có gì
 * tính tiến độ cả (grep xác nhận không 1 dòng nào nhắc percent/progress
 * trong cả service lẫn EventsListPage.tsx). Gộp 1 lần bằng query riêng
 * (không N+1 theo từng event) — đơn giản hơn hẳn GROUP BY ở tầng SQL vì
 * cần map lại theo `eventId` (có thể null — task không gắn event nào) và
 * số event trong 1 trang thường nhỏ (danh sách lịch, không phải bảng lớn).
 * `taskProgressPercent = null` khi event chưa có việc nhỏ nào (khác 0% —
 * "chưa có việc" và "có việc nhưng chưa xong việc nào" là 2 trạng thái
 * khác nhau, UI cần phân biệt được, không hiện thanh 0% gây hiểu nhầm).
 */
export async function attachTaskProgress<T extends { id: string }>(db: Db, events: T[]) {
  if (events.length === 0) return events as (T & { taskCount: number; taskCompletedCount: number; taskProgressPercent: number | null })[];
  const eventIds = events.map((e) => e.id);
  const taskRows = await db
    .select({ eventId: ltcTasks.eventId, status: ltcTasks.status })
    .from(ltcTasks)
    .where(inArray(ltcTasks.eventId, eventIds));
  const statsByEvent = new Map<string, { total: number; completed: number }>();
  for (const t of taskRows) {
    if (!t.eventId) continue;
    const s = statsByEvent.get(t.eventId) ?? { total: 0, completed: 0 };
    s.total++;
    if (t.status === 'COMPLETED') s.completed++;
    statsByEvent.set(t.eventId, s);
  }
  return events.map((e) => {
    const s = statsByEvent.get(e.id);
    return {
      ...e,
      taskCount: s?.total ?? 0,
      taskCompletedCount: s?.completed ?? 0,
      taskProgressPercent: s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : null
    };
  });
}

// ---------------------------------------------------------------------
// Tasks (ltc_tasks)
// ---------------------------------------------------------------------

export interface CreateTaskInput {
  eventId?: string | null;
  // "Việc nhỏ" — trỏ về id của "việc lớn" chứa nó (xem ghi chú schema).
  // Chỉ chủ trì (assigneePerId) HOẶC người tạo (createdByPerId) của việc
  // lớn mới được thêm việc nhỏ vào đó (kiểm tra bên dưới).
  parentTaskId?: string | null;
  title: string;
  description?: string;
  priority?: string;
  campusId: string;
  assigneePerId: string;
  collaboratorPerIds?: string[];
  location?: string;
  // Tuỳ chọn — NULL nghĩa là việc chỉ có 1 mốc hạn (dueAt) như trước giờ.
  startAt?: Date | null;
  dueAt: Date;
  createdByPerId: string;
}

function validateTaskDateRange(startAt: Date | null | undefined, dueAt: Date): void {
  if (startAt instanceof Date && !Number.isNaN(startAt.getTime()) && startAt.getTime() > dueAt.getTime()) {
    throw new AppError('invalid_input', 'Ngày bắt đầu phải trước hoặc bằng hạn hoàn thành.');
  }
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
  if (input.dueAt.getTime() < (opts.now ?? new Date()).getTime()) {
    throw new AppError('invalid_input', 'Hạn hoàn thành không được ở trong quá khứ.');
  }
  validateTaskDateRange(input.startAt, input.dueAt);
  if (!input.createdByPerId) throw new AppError('invalid_input', 'Thiếu createdByPerId.');

  if (input.parentTaskId) {
    const [parent] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, input.parentTaskId)).limit(1);
    if (!parent) throw new AppError('not_found', `Không tìm thấy việc lớn ${input.parentTaskId}`);
    if (parent.parentTaskId) {
      throw new AppError('invalid_input', 'Việc nhỏ không được có việc nhỏ riêng — chỉ 2 cấp (việc lớn → việc nhỏ).');
    }
    if (parent.createdByPerId !== input.createdByPerId && parent.assigneePerId !== input.createdByPerId) {
      throw new AppError('forbidden', 'Chỉ người giao việc hoặc chủ trì của việc lớn mới được thêm việc nhỏ.');
    }
  }

  const [row] = await db
    .insert(ltcTasks)
    .values({
      eventId: input.eventId || null,
      parentTaskId: input.parentTaskId || null,
      title: input.title,
      description: input.description || '',
      priority: input.priority || 'NORMAL',
      campusId: input.campusId,
      assigneePerId: input.assigneePerId,
      collaboratorPerIds: input.collaboratorPerIds ?? [],
      location: input.location || '',
      startAt: input.startAt || null,
      dueAt: input.dueAt,
      // 2026-10-05 — chỉ còn 2 trạng thái (ASSIGNED/COMPLETED, xem
      // VALID_TASK_STATUSES), nên luôn khởi tạo ASSIGNED kể cả khi tự giao
      // cho chính mình (trước đây có nhánh riêng 'ACCEPTED', nay bỏ).
      status: 'ASSIGNED',
      createdByPerId: input.createdByPerId
    })
    .returning();
  if (!row) throw new Error('Không tạo được công việc.');
  await writeAuditLog(db, { entityType: 'task', entityId: row.id, action: 'task.created', actorPerId: input.createdByPerId, after: row });

  if (row.assigneePerId !== input.createdByPerId) {
    await notifyAll(
      db,
      {
        recipients: [row.assigneePerId, ...(row.collaboratorPerIds || [])],
        title: 'Việc mới được giao: ' + row.title,
        message: (await nameForBell(db, input.createdByPerId)) + ' vừa giao việc "' + row.title + '" cho bạn, hạn ' + row.dueAt.toLocaleString('vi-VN'),
        eventType: 'work_schedule.task.created',
        objectId: row.id,
        actorPerId: input.createdByPerId,
        deepLink: '/work-schedule/tasks',
        urgency: notify.URGENCY.HIGH
      },
      opts
    );
  }
  return row;
}

/**
 * Chỉnh sửa nội dung 1 việc nhỏ — 2026-09-29 (Sin phản hồi: "các đâù mục
 * nhỏ trong lịch công tác vẫn chưa thể edit được"). Trước đây `ltc_tasks`
 * hoàn toàn KHÔNG có đường sửa nội dung sau khi tạo (chỉ đổi status qua
 * changeTaskStatus/acceptOrReturnTask) — thiếu sót thật, không phải cố ý
 * giữ nguyên từ bản gốc. Áp dụng đúng cùng nguyên tắc đã chốt cho sự kiện
 * (updateRevisionEvent, xem ghi chú ở đó): người tạo (người giao việc) HOẶC
 * người được giao (assignee) được sửa, ở MỌI trạng thái TRỪ CANCELLED —
 * audit log ghi đủ trước/sau, không cần gate duyệt riêng. Không đổi
 * eventId (không cho "chuyển" việc sang sự kiện khác qua đường này).
 */
export async function updateTask(
  db: Db,
  input: { taskId: string; taskData: Partial<CreateTaskInput>; actorPerId: string },
  opts: { now?: Date } = {}
) {
  if (!input.taskId || !input.actorPerId) throw new AppError('invalid_input', 'Thiếu taskId hoặc actorPerId.');
  const taskData = input.taskData || {};
  if (!taskData.title) throw new AppError('invalid_input', 'Thiếu tiêu đề công việc.');
  if (!VALID_CAMPUS_IDS.includes(taskData.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'campusId không hợp lệ — phải là MAIN_CAMPUS/CAMPUS_1/CAMPUS_2.');
  }
  if (!taskData.assigneePerId) throw new AppError('invalid_input', 'Thiếu assigneePerId (người được giao).');
  if (!(taskData.dueAt instanceof Date) || Number.isNaN(taskData.dueAt.getTime())) {
    throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng dueAt.');
  }
  if (taskData.dueAt.getTime() < (opts.now ?? new Date()).getTime()) {
    throw new AppError('invalid_input', 'Hạn hoàn thành không được ở trong quá khứ.');
  }
  validateTaskDateRange(taskData.startAt, taskData.dueAt);
  const [before] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, input.taskId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy công việc ${input.taskId}`);
  // SỬA 2026-09-29 (Sin: "lịch đã huỷ thì vẫn cho edit như thường thôi") —
  // bỏ chốt chặn sửa việc CANCELLED, cùng lý do với updateRevisionEvent.
  if (before.createdByPerId !== input.actorPerId && before.assigneePerId !== input.actorPerId) {
    throw new AppError('forbidden', 'Chỉ người giao việc hoặc người được giao mới được chỉnh sửa.');
  }
  const [after] = await db
    .update(ltcTasks)
    .set({
      title: taskData.title,
      description: taskData.description || '',
      priority: taskData.priority || before.priority,
      campusId: taskData.campusId!,
      assigneePerId: taskData.assigneePerId!,
      collaboratorPerIds: taskData.collaboratorPerIds ?? [],
      location: taskData.location || '',
      startAt: taskData.startAt ?? null,
      dueAt: taskData.dueAt!,
      updatedAt: new Date()
    })
    .where(eq(ltcTasks.id, input.taskId))
    .returning();
  await writeAuditLog(db, { entityType: 'task', entityId: input.taskId, action: 'task.updated', actorPerId: input.actorPerId, before, after });

  const newAssignee = after!.assigneePerId;
  if (newAssignee !== input.actorPerId) {
    await notifyAll(
      db,
      {
        recipients: [newAssignee, ...(after!.collaboratorPerIds || [])],
        title: 'Việc vừa được sửa lại: ' + after!.title,
        message: (await nameForBell(db, input.actorPerId)) + ' vừa cập nhật nội dung việc "' + after!.title + '".',
        eventType: 'work_schedule.task.updated',
        objectId: input.taskId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule/tasks'
      },
      opts
    );
  }
  return after!;
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

  // 2026-10-05 (huong_dan_lich_cong_tac_giao_viec.md §13) — chỉ còn 2
  // trạng thái (ASSIGNED/COMPLETED), không còn nghiệm thu/từ chối/huỷ cho
  // việc nhỏ. CHỈ người chủ trì (assigneePerId) được tự chuyển trạng thái
  // — "Người không được giao chủ trì không được tự ý chuyển đầu việc sang
  // Đã hoàn thành" (loại cả người tạo/collaborator khỏi quyền này, khác
  // bản cũ cho phép collaborator đổi trạng thái).
  if (before.assigneePerId !== input.actorPerId) {
    throw new AppError('forbidden', 'Chỉ người chủ trì (được giao) công việc này mới được chuyển trạng thái.');
  }
  const allowed = TASK_ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError('invalid_transition', `Không thể chuyển từ ${currentStatus} sang ${nextStatus}.`);
  }
  const patch: Partial<typeof ltcTasks.$inferInsert> = { status: nextStatus, updatedAt: new Date() };

  const [after] = await db.update(ltcTasks).set(patch).where(eq(ltcTasks.id, input.taskId)).returning();
  await writeAuditLog(db, { entityType: 'task', entityId: input.taskId, action: 'task.status_changed', actorPerId: input.actorPerId, before, after });

  // Báo người giao khi người chủ trì đánh dấu hoàn thành.
  if (before.createdByPerId && before.createdByPerId !== input.actorPerId) {
    await notifyAll(
      db,
      {
        recipients: [before.createdByPerId],
        title: 'Việc đổi trạng thái: ' + before.title,
        message: (await nameForBell(db, input.actorPerId)) + ' đã chuyển việc "' + before.title + '" sang ' + (nextStatus === 'COMPLETED' ? 'Đã hoàn thành' : 'Đã giao') + '.',
        eventType: 'work_schedule.task.status_changed',
        objectId: input.taskId,
        actorPerId: input.actorPerId,
        deepLink: '/work-schedule/tasks',
        urgency: nextStatus === 'COMPLETED' ? notify.URGENCY.HIGH : undefined
      },
      opts
    );
  }
  return after!;
}

/**
 * Xoá HẲN 1 công việc — bổ sung 2026-09-29, cùng đợt với deleteEvent()
 * (xem ghi chú ở đó). CHỈ người giao (createdByPerId) hoặc lãnh đạo.
 */
export async function deleteTask(db: Db, taskId: string, actorPerId: string, opts: { isAdmin?: boolean } = {}) {
  const [before] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, taskId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy công việc ${taskId}`);
  if (!opts.isAdmin && before.createdByPerId !== actorPerId) {
    throw new AppError('forbidden', 'Chỉ người giao việc hoặc quản trị mới được xoá hẳn việc.');
  }
  await writeAuditLog(db, { entityType: 'task', entityId: taskId, action: 'task.deleted', actorPerId, before });
  await db.delete(ltcTasks).where(eq(ltcTasks.id, taskId));
}

// `eventId` bổ sung 2026-09-28 (Sin yêu cầu, note của 2 thầy): "một đầu
// việc lớn, bấm vào sẽ có các đầu việc nhỏ" — trước đây KHÔNG lọc được
// theo event dù cột `ltc_tasks.event_id` đã có sẵn từ đầu (port từ bản
// gốc), route/frontend chưa từng dùng tới cột này.
export async function listTasks(
  db: Db,
  // `forPerId` (bổ sung 2026-09-29, Sin: "giao việc cũng chỉ hiện việc mà
  // mình là người giao hoặc là người phải thực hiện thôi, ko phải ai cũng
  // xem hết việc được giao của nhau đâu") — khi truyền, CHỈ trả về việc
  // actor là người giao (createdByPerId) HOẶC người thực hiện
  // (assigneePerId HOẶC có trong collaboratorPerIds). Không truyền = giữ
  // hành vi CŨ (liệt kê tất cả — dùng khi 1 trang cần xem việc của 1 sự
  // kiện cụ thể do actor chủ trì, xem `eventId` bên dưới, KHÔNG áp
  // `forPerId` vào trường hợp đó ở tầng route).
  filter: {
    campusId?: string;
    assigneePerId?: string;
    statuses?: string[];
    eventId?: string;
    forPerId?: string;
    // "Xem việc nhỏ của 1 việc lớn cụ thể" — dùng ở dialog chi tiết việc
    // lớn (KHÔNG áp forPerId vào trường hợp này ở tầng route, giống hệt
    // cách eventId đã làm — chỉ chủ trì/người tạo việc lớn mới được gọi,
    // route tự kiểm tra trước khi gọi listTasks không lọc theo actor).
    parentTaskId?: string;
  } = {}
) {
  const conditions: SQL[] = [];
  if (filter.campusId) conditions.push(eq(ltcTasks.campusId, filter.campusId));
  if (filter.assigneePerId) conditions.push(eq(ltcTasks.assigneePerId, filter.assigneePerId));
  if (filter.statuses?.length) conditions.push(inArray(ltcTasks.status, filter.statuses));
  if (filter.eventId) conditions.push(eq(ltcTasks.eventId, filter.eventId));
  if (filter.parentTaskId) conditions.push(eq(ltcTasks.parentTaskId, filter.parentTaskId));
  if (filter.forPerId) {
    const perId = filter.forPerId;
    conditions.push(
      or(
        eq(ltcTasks.createdByPerId, perId),
        eq(ltcTasks.assigneePerId, perId),
        sql`${perId} = ANY(${ltcTasks.collaboratorPerIds})`,
        // Việc lớn (parentTaskId IS NULL) mà TÔI phụ trách/cùng làm 1 việc
        // nhỏ bên trong — hiện dòng việc lớn để có ngữ cảnh (chỉ đọc, xem
        // ghi chú updateTask/changeTaskStatus — không phải creator/chủ trì
        // thì không sửa được) dù tôi không trực tiếp liên quan tới chính
        // việc lớn đó.
        sql`${ltcTasks.parentTaskId} IS NULL AND EXISTS (
          SELECT 1 FROM ltc_tasks child
          WHERE child.parent_task_id = ${ltcTasks.id}
            AND (child.assignee_per_id = ${perId} OR ${perId} = ANY(child.collaborator_per_ids))
        )`
      )!
    );
  }
  // Mặc định việc mới giao gần đây nhất lên đầu — cùng lý do listEvents ở trên.
  const base = db.select().from(ltcTasks);
  const query = conditions.length ? base.where(and(...conditions)) : base;
  return query.orderBy(desc(ltcTasks.createdAt));
}

/**
 * Gắn thêm thông tin "việc lớn ↔ việc nhỏ" vào 1 danh sách task đã tải —
 * cùng cách `attachTaskProgress` làm cho event (2 lượt query gộp theo lô,
 * không N+1): dòng KHÔNG có parentTaskId (có thể là "việc lớn") được gắn
 * `subtaskCount`/`subtaskCompletedCount`/`subtaskProgressPercent`; dòng CÓ
 * parentTaskId (là "việc nhỏ") được gắn `parentTaskTitle` (tên việc lớn,
 * hiện chip "việc nhỏ của: ..." ở FE không cần tải riêng việc lớn).
 */
export async function attachSubtaskInfo<T extends { id: string; parentTaskId: string | null }>(db: Db, tasks: T[]) {
  type Out = T & { subtaskCount: number; subtaskCompletedCount: number; subtaskProgressPercent: number | null; parentTaskTitle: string | null };
  if (tasks.length === 0) return tasks as Out[];

  const parentCandidateIds = tasks.filter((t) => !t.parentTaskId).map((t) => t.id);
  const statsByParent = new Map<string, { total: number; completed: number }>();
  if (parentCandidateIds.length > 0) {
    const childRows = await db
      .select({ parentTaskId: ltcTasks.parentTaskId, status: ltcTasks.status })
      .from(ltcTasks)
      .where(inArray(ltcTasks.parentTaskId, parentCandidateIds));
    for (const c of childRows) {
      if (!c.parentTaskId) continue;
      const s = statsByParent.get(c.parentTaskId) ?? { total: 0, completed: 0 };
      s.total++;
      if (c.status === 'COMPLETED') s.completed++;
      statsByParent.set(c.parentTaskId, s);
    }
  }

  const childParentIds = [...new Set(tasks.filter((t) => t.parentTaskId).map((t) => t.parentTaskId as string))];
  const titleByParentId = new Map<string, string>();
  if (childParentIds.length > 0) {
    const parentRows = await db.select({ id: ltcTasks.id, title: ltcTasks.title }).from(ltcTasks).where(inArray(ltcTasks.id, childParentIds));
    for (const p of parentRows) titleByParentId.set(p.id, p.title);
  }

  return tasks.map((t) => {
    const s = statsByParent.get(t.id);
    return {
      ...t,
      subtaskCount: s?.total ?? 0,
      subtaskCompletedCount: s?.completed ?? 0,
      subtaskProgressPercent: s && s.total > 0 ? Math.round((s.completed / s.total) * 100) : null,
      parentTaskTitle: t.parentTaskId ? titleByParentId.get(t.parentTaskId) || null : null
    };
  }) as Out[];
}

/**
 * Gắn `eventTitle` (tên lịch công tác gốc) vào 1 danh sách task — Sin yêu
 * cầu 2026-10-05: "việc sinh từ 1 lịch công tác phải hiện TÊN lịch, không
 * chỉ ID, bấm vào mở đúng phiếu lịch nguồn". `eventId` có thể null (việc
 * tạo độc lập, không gắn lịch nào) — dòng đó nhận `eventTitle: null`, FE tự
 * ẩn phần liên kết. Cùng cách gộp theo lô (1 query, không N+1) như
 * `attachSubtaskInfo`/`attachTaskProgress` ở trên.
 */
export async function attachEventTitles<T extends { id: string; eventId: string | null }>(db: Db, tasks: T[]) {
  type Out = T & { eventTitle: string | null };
  if (tasks.length === 0) return tasks as Out[];
  const eventIds = [...new Set(tasks.filter((t) => t.eventId).map((t) => t.eventId as string))];
  const titleByEventId = new Map<string, string>();
  if (eventIds.length > 0) {
    const eventRows = await db.select({ id: ltcEvents.id, title: ltcEvents.title }).from(ltcEvents).where(inArray(ltcEvents.id, eventIds));
    for (const e of eventRows) titleByEventId.set(e.id, e.title);
  }
  return tasks.map((t) => ({
    ...t,
    eventTitle: t.eventId ? titleByEventId.get(t.eventId) || null : null
  })) as Out[];
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

// ---------------------------------------------------------------------
// Ngày nghỉ lễ (Holiday) — bổ sung 2026-09-29 (Sin: "thêm cái là lịch
// holiday nữa, cái này thì gọi api đi cho nhanh") — GỌI THẲNG Nager.Date
// (date.nager.at, API công khai miễn phí, có dữ liệu ngày lễ Việt Nam
// "VN") thay vì tự tay nhập/tính âm lịch — đúng yêu cầu "cho nhanh", không
// tự xây lại lịch âm-dương phức tạp. Cache theo NĂM trong bộ nhớ tiến trình
// (process-level Map, KHÔNG phải DB) — dữ liệu ngày lễ 1 năm không đổi
// trong ngày, cache 24h là đủ, không cần bảng riêng.
// ---------------------------------------------------------------------

export interface PublicHoliday {
  date: string; // "YYYY-MM-DD"
  localName: string;
}

// ---------------------------------------------------------------------
// Dashboard Lịch công tác & Quản lý công việc (bổ sung 2026-10-05, theo
// mo_ta_dashboard_lich_cong_tac.md) — tổng hợp số liệu cho Ban Giám hiệu.
// MỌI con số đều tính trực tiếp từ `ltc_events`/`ltc_tasks` thật, không
// bịa thêm trạng thái/cột nào ngoài những gì schema đã có:
//   - Tài liệu gốc mô tả 4 trạng thái việc (Đã giao/Đang thực hiện/Đã
//     hoàn thành/Quá hạn), nhưng `VALID_TASK_STATUSES` CHỈ có 2 giá trị
//     thật (ASSIGNED/COMPLETED) — KHÔNG có "Đang thực hiện". Thu gọn còn
//     ĐÚNG 3 nhóm suy ra được từ dữ liệu thật: ASSIGNED chưa quá hạn,
//     OVERDUE (ASSIGNED + dueAt đã qua), COMPLETED.
//   - Không có cột `completedAt` riêng cho task — dùng `updatedAt` làm mốc
//     gần đúng nhất cho "thời điểm hoàn thành" (mọi lần đổi status đều cập
//     nhật `updatedAt`, xem `changeTaskStatus`), có ghi chú rõ trong code.
//   - Loại trừ event CANCELLED khỏi mọi thống kê — không tính là "kế
//     hoạch" đang hoạt động.
// ---------------------------------------------------------------------

export interface DashboardSummaryFilter {
  from: Date;
  to: Date;
  campusId?: string;
  type?: string;
}

export async function getDashboardSummary(db: Db, filter: DashboardSummaryFilter) {
  const eventConditions: SQL[] = [gte(ltcEvents.startAt, filter.from), lte(ltcEvents.startAt, filter.to), ne(ltcEvents.status, 'CANCELLED')];
  if (filter.campusId) eventConditions.push(eq(ltcEvents.campusId, filter.campusId));
  if (filter.type) eventConditions.push(eq(ltcEvents.type, filter.type));
  const events = await db
    .select()
    .from(ltcEvents)
    .where(and(...eventConditions));

  // "Tổng việc"/tiến độ tính theo NGÀY GIAO (createdAt) nằm trong khoảng
  // lọc — khớp trục X "Tiến độ công việc theo thời gian" (theo tuần giao
  // việc), nhất quán với cách "Tổng lịch" lọc theo startAt.
  const taskConditions: SQL[] = [gte(ltcTasks.createdAt, filter.from), lte(ltcTasks.createdAt, filter.to)];
  if (filter.campusId) taskConditions.push(eq(ltcTasks.campusId, filter.campusId));
  const tasks = await db
    .select()
    .from(ltcTasks)
    .where(and(...taskConditions));

  const now = Date.now();
  const isOverdue = (t: (typeof tasks)[number]) => t.status === 'ASSIGNED' && t.dueAt.getTime() < now;

  const totalEvents = events.length;
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'COMPLETED').length;
  const overdueTasks = tasks.filter(isOverdue).length;

  const taskStatusBreakdown = [
    { status: 'ASSIGNED' as const, count: totalTasks - completedTasks - overdueTasks },
    { status: 'OVERDUE' as const, count: overdueTasks },
    { status: 'COMPLETED' as const, count: completedTasks }
  ];

  // Lô 7 ngày tính từ `from` — khớp cách tài liệu minh hoạ "Tuần 1 -> Tuần
  // 4" cho khoảng 1 tháng, áp dụng tổng quát cho khoảng ngày bất kỳ người
  // dùng chọn (không hard-code đúng 4 tuần).
  const msPerWeek = 7 * 24 * 3600 * 1000;
  const weekCount = Math.max(1, Math.ceil((filter.to.getTime() - filter.from.getTime() + 1) / msPerWeek));
  const taskTrendByWeek = Array.from({ length: weekCount }, (_, i) => {
    const weekStart = filter.from.getTime() + i * msPerWeek;
    const weekEnd = Math.min(weekStart + msPerWeek - 1, filter.to.getTime());
    const assigned = tasks.filter((t) => t.createdAt.getTime() >= weekStart && t.createdAt.getTime() <= weekEnd).length;
    const completed = tasks.filter((t) => t.status === 'COMPLETED' && t.updatedAt.getTime() >= weekStart && t.updatedAt.getTime() <= weekEnd).length;
    return { weekStart: new Date(weekStart).toISOString().slice(0, 10), weekLabel: `Tuần ${i + 1}`, assigned, completed };
  });

  const campusIds: CampusId[] = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'];
  const tasksByCampus = campusIds.map((cid) => {
    const rows = tasks.filter((t) => t.campusId === cid);
    return { campusId: cid, total: rows.length, completed: rows.filter((t) => t.status === 'COMPLETED').length, overdue: rows.filter(isOverdue).length };
  });

  const eventsByDateMap = new Map<string, number>();
  for (const e of events) {
    const d = e.startAt.toISOString().slice(0, 10);
    eventsByDateMap.set(d, (eventsByDateMap.get(d) ?? 0) + 1);
  }
  const eventsByDate = [...eventsByDateMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));

  // "Toàn trường" tách riêng khỏi campusId vật lý (SCHOOL_WIDE luôn lưu
  // campusId=MAIN_CAMPUS — xem ghi chú createEvent) để khớp đúng 4 nhóm
  // §3.5 tài liệu gốc (3 cơ sở + Toàn trường), không lẫn vào cột MAIN_CAMPUS.
  const eventsByCampusMap = new Map<string, number>();
  for (const e of events) {
    const bucket = e.scope === 'SCHOOL_WIDE' ? 'SCHOOL_WIDE' : e.campusId;
    eventsByCampusMap.set(bucket, (eventsByCampusMap.get(bucket) ?? 0) + 1);
  }
  const eventsByCampus = [...eventsByCampusMap.entries()].map(([bucket, count]) => ({ bucket, count }));

  const completionRateByCampus = campusIds
    .map((cid) => {
      const rows = tasks.filter((t) => t.campusId === cid);
      const total = rows.length;
      const completed = rows.filter((t) => t.status === 'COMPLETED').length;
      return { campusId: cid, total, completed, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
    })
    .sort((a, b) => b.rate - a.rate);

  // Danh sách "loại lịch" thật đã từng được tạo (KHÔNG hard-code 3 ví dụ
  // trong tài liệu — hiện tại `type` luôn mặc định 'MEETING' vì UI tạo
  // lịch chưa có ô chọn loại, nhưng cột đã tồn tại sẵn trong schema, nên
  // đọc DISTINCT thật thay vì bịa danh sách). Không giới hạn theo bộ lọc
  // đang áp dụng — luôn liệt kê đủ để người dùng đổi bộ lọc mà không mất
  // lựa chọn.
  const typeRows = await db
    .selectDistinct({ type: ltcEvents.type })
    .from(ltcEvents)
    .where(ne(ltcEvents.status, 'CANCELLED'));
  const availableTypes = typeRows.map((r) => r.type).sort();

  return {
    kpis: { totalEvents, totalTasks, completedTasks, overdueTasks },
    taskStatusBreakdown,
    taskTrendByWeek,
    tasksByCampus,
    eventsByDate,
    eventsByCampus,
    completionRateByCampus,
    availableTypes,
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      startAt: e.startAt.toISOString(),
      campusId: e.campusId,
      scope: e.scope,
      status: e.status
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      dueAt: t.dueAt.toISOString(),
      createdAt: t.createdAt.toISOString(),
      campusId: t.campusId,
      status: t.status,
      assigneePerId: t.assigneePerId
    }))
  };
}

const holidayCache = new Map<number, { at: number; items: PublicHoliday[] }>();
const HOLIDAY_CACHE_TTL_MS = 24 * 3600 * 1000;

export async function getPublicHolidays(year: number): Promise<PublicHoliday[]> {
  const cached = holidayCache.get(year);
  if (cached && Date.now() - cached.at < HOLIDAY_CACHE_TTL_MS) return cached.items;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/VN`);
    if (!res.ok) throw new Error(`Nager.Date trả về ${res.status}`);
    const raw = (await res.json()) as Array<{ date: string; localName: string }>;
    const items = raw.map((h) => ({ date: h.date, localName: h.localName }));
    holidayCache.set(year, { at: Date.now(), items });
    return items;
  } catch (e) {
    console.error('[work-schedule] getPublicHolidays lỗi (không chặn trang lịch chính):', e);
    return cached?.items ?? [];
  }
}
