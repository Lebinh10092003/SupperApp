/**
 * work-schedule.routes.ts — 8 route HTTP, port 1-1 từ 8 hàm `onCall` gốc
 * (`App_lich_cong_tac_giao_viec/functions/src/index.js`):
 *   createLtcEvent, changeLtcEventStatus, approveLtcEvent, listLtcEvents,
 *   createLtcTask, changeLtcTaskStatus, acceptOrReturnLtcTask, listLtcTasks.
 *
 * Chỉ dùng `firebaseAuth` (xác thực) — KHÔNG gắn `requireCapability` như
 * các module School Intelligence khác trong app này: bản gốc chỉ đòi hỏi
 * đăng nhập (`requireAuth`), toàn bộ phân quyền thật nằm trong
 * `work-schedule.authz.ts` (theo vai trò/campus/domain đọc từ bảng identity
 * dùng chung qua `loadActorContext`) — gắn thêm `requireCapability` ở đây
 * sẽ là 1 lớp chặn KHÔNG có trong nghiệp vụ gốc.
 *
 * `actorAssignments` truyền cho service LUÔN lấy từ `loadActorContext` (đọc
 * DB thật theo uid đã xác thực) — không tin bất kỳ gì client tự khai.
 *
 * CHƯA CÓ ở đây (giữ đúng phạm vi "8 route của bản gốc"):
 *   - `updateRevisionEvent` (có trong `work-schedule.service.ts` nhưng
 *     KHÔNG có `onCall` tương ứng trong `index.js` gốc — có thể là thiếu
 *     sót ở bản gốc, cần hỏi lại Mr Tiến trước khi thêm route cho hàm này).
 *   - `progress` mà `changeLtcTaskStatus` gốc truyền cho Cloud Function
 *     không được `changeTaskStatus` (service đã port) nhận — bỏ qua field
 *     này khi forward, khớp đúng chữ ký hàm đã port, không tự thêm cột mới.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { getPersonSummariesByPerIds, formatPersonLabel } from '../identity/person-directory.js';
import {
  AppError,
  createEvent,
  updateRevisionEvent,
  changeEventStatus,
  approveEvent,
  listEvents,
  deleteEvent,
  createTask,
  updateTask,
  changeTaskStatus,
  listTasks,
  deleteTask,
  attachSubtaskInfo,
  attachEventTitles,
  getAuditLogs,
  getPublicHolidays,
  getDashboardSummary
} from './work-schedule.service.js';
import { canCreateScheduleForOthers, canManageSchoolCalendar, isLeadership } from './work-schedule.authz.js';
import { buildIcsCalendar } from './ics.js';
import { ltcTasks } from './work-schedule.schema.js';
import { eq } from 'drizzle-orm';
import { validateEventImportRows, validateTaskImportRows, type EventImportRow, type ImportError, type TaskImportRow } from './work-schedule-import.js';

export const workScheduleRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  invalid_transition: 409
};

// Bọc quanh mọi handler — dịch `AppError` (lỗi nghiệp vụ từ service, port từ
// `wrapAppError` gốc) sang `HttpError` đúng status; lỗi khác để nguyên cho
// `errorHandler` toàn cục xử lý (500).
function withAppError(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return asyncRoute(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      if (e instanceof AppError) {
        throw new HttpError(APP_ERROR_STATUS[e.code] ?? 500, e.message, e.code.toUpperCase());
      }
      throw e;
    }
  });
}

function parseStatuses(raw: unknown): string[] | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function validateImport(kind: string, rows: unknown[], actorPerId: string) {
  return kind === 'events'
    ? validateEventImportRows(rows as EventImportRow[], actorPerId)
    : kind === 'tasks'
      ? validateTaskImportRows(rows as TaskImportRow[], actorPerId)
      : null;
}

workScheduleRouter.post('/imports/preview', firebaseAuth, withAppError(async (req, res) => {
  const actor = await loadActorContext(db, req.appUser!.uid);
  const kind = String(req.body?.kind || '');
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const result = validateImport(kind, rows, actor.perId);
  if (!result) throw new HttpError(400, 'Loại import không hợp lệ.', 'INVALID_INPUT');
  const errors: ImportError[] = [...result.errors];
  if (kind === 'events') {
    for (const row of result.normalized as ReturnType<typeof validateEventImportRows>['normalized']) {
      if (row.scope === 'SCHOOL_WIDE' && !canManageSchoolCalendar(actor.roles)) errors.push({ row: row.rowNumber, column: 'Phạm vi', value: row.scope, message: 'Không có quyền tạo lịch toàn trường.' });
      if (row.chairPerId !== actor.perId && !canCreateScheduleForOthers(actor.roles)) errors.push({ row: row.rowNumber, column: 'Chủ trì', value: row.chairPerId, message: 'Không có quyền tạo lịch cho người khác.' });
    }
  }
  res.json({ valid: errors.length === 0, errors, rows: result.normalized.map((row) => ({ ...row, startAt: row.startAt?.toISOString() || null, endAt: 'endAt' in row ? row.endAt?.toISOString() || null : undefined, dueAt: 'dueAt' in row ? row.dueAt?.toISOString() || null : undefined })) });
}));

workScheduleRouter.post('/imports/apply', firebaseAuth, withAppError(async (req, res) => {
  if (req.body?.confirm !== true) throw new HttpError(400, 'Phải xác nhận bản xem trước trước khi import.', 'CONFIRMATION_REQUIRED');
  const actor = await loadActorContext(db, req.appUser!.uid);
  const kind = String(req.body?.kind || '');
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  const result = validateImport(kind, rows, actor.perId);
  if (!result) throw new HttpError(400, 'Loại import không hợp lệ.', 'INVALID_INPUT');
  const errors: ImportError[] = [...result.errors];
  if (kind === 'events') {
    for (const row of result.normalized as ReturnType<typeof validateEventImportRows>['normalized']) {
      if (row.scope === 'SCHOOL_WIDE' && !canManageSchoolCalendar(actor.roles)) errors.push({ row: row.rowNumber, column: 'Phạm vi', value: row.scope, message: 'Không có quyền tạo lịch toàn trường.' });
      if (row.chairPerId !== actor.perId && !canCreateScheduleForOthers(actor.roles)) errors.push({ row: row.rowNumber, column: 'Chủ trì', value: row.chairPerId, message: 'Không có quyền tạo lịch cho người khác.' });
    }
  }
  if (errors.length) return void res.status(400).json({ error: { message: 'Dữ liệu import chưa hợp lệ.' }, errors });
  const created = await db.transaction(async (tx) => {
    const output: unknown[] = [];
    if (kind === 'events') {
      for (const row of result.normalized as ReturnType<typeof validateEventImportRows>['normalized']) output.push(await createEvent(tx as any, { ...row, createdByPerId: actor.perId, startAt: row.startAt!, endAt: row.endAt }));
    } else {
      for (const row of result.normalized as ReturnType<typeof validateTaskImportRows>['normalized']) output.push(await createTask(tx as any, { ...row, createdByPerId: actor.perId, dueAt: row.dueAt! }));
    }
    return output;
  });
  res.status(201).json({ imported: created.length, items: created });
}));

// ---------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------

// Port từ `createLtcEvent`.
workScheduleRouter.post(
  '/events',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    // 2026-09-29 (Sin: "lịch toàn trường thì ko thể edit trừ tk có thẩm
    // quyền kiêủ hiệu trưởng hiệu phó") — chặn NGAY ở route (không tin
    // client tự khai scope), trước khi vào service.
    if (d.scope === 'SCHOOL_WIDE' && !canManageSchoolCalendar(actor.roles)) {
      throw new HttpError(403, 'Bạn không có quyền tạo lịch toàn trường.', 'FORBIDDEN');
    }
    const chairPerId = typeof d.chairPerId === 'string' && d.chairPerId ? d.chairPerId : actor.perId;
    if (chairPerId !== actor.perId && !canCreateScheduleForOthers(actor.roles)) {
      throw new HttpError(403, 'Bạn chỉ được tạo lịch cá nhân cho chính mình.', 'FORBIDDEN');
    }
    const row = await createEvent(db, {
      title: d.title,
      description: d.description,
      type: d.type,
      campusId: d.campusId,
      scope: d.scope,
      startAt: d.startAt ? new Date(d.startAt) : undefined!,
      endAt: d.endAt ? new Date(d.endAt) : undefined!,
      location: d.location,
      chairPerId,
      participantPerIds: d.participantPerIds,
      externalParticipants: d.externalParticipants,
      departmentDomain: d.departmentDomain,
      createdByPerId: actor.perId
    });
    res.status(201).json(row);
  })
);

// `updateRevisionEvent` đã được port sẵn trong work-schedule.service.ts từ
// trước (kèm test) nhưng CHƯA từng có route nối tới — bản gốc thật
// (App_lich_cong_tac_giao_viec/FT_Lich_cong_tac_V30_source) có hẳn nút
// "Chỉnh sửa" cho lịch Dự thảo/Cần sửa lại, gọi PATCH /api/events; port
// trước đây bỏ sót route này (Sin phát hiện 2026-09-21, đối chiếu lại bản
// gốc theo note của Mr Tiến). Chỉ cho phép DRAFT/REVISION_REQUIRED và đúng
// người tạo — `updateRevisionEvent` tự kiểm tra, ở đây chỉ forward.
workScheduleRouter.patch(
  '/events/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    // Cùng chốt chặn với POST /events ở trên — sửa 1 lịch (đang hoặc sẽ)
    // toàn trường cũng cần đúng vai trò lãnh đạo, không chỉ lúc tạo mới.
    if (d.scope === 'SCHOOL_WIDE' && !canManageSchoolCalendar(actor.roles)) {
      throw new HttpError(403, 'Bạn không có quyền sửa lịch toàn trường.', 'FORBIDDEN');
    }
    if (d.chairPerId && d.chairPerId !== actor.perId && !canCreateScheduleForOthers(actor.roles)) {
      throw new HttpError(403, 'Bạn không có quyền chuyển lịch cho người khác.', 'FORBIDDEN');
    }
    const row = await updateRevisionEvent(db, {
      eventId: String(req.params.id),
      actorPerId: actor.perId,
      actorAssignments: actor.roles,
      eventData: {
        title: d.title,
        description: d.description,
        type: d.type,
        campusId: d.campusId,
        scope: d.scope,
        startAt: d.startAt ? new Date(d.startAt) : undefined!,
        endAt: d.endAt ? new Date(d.endAt) : undefined!,
        location: d.location,
        chairPerId: d.chairPerId,
        participantPerIds: d.participantPerIds,
        externalParticipants: d.externalParticipants
      }
    });
    // Gắn tên hiển thị vào response — thiếu bước này thì sau khi đổi chủ
    // trì/thành phần tham dự, dialog chi tiết vẫn hiện tên CŨ (hoặc mã
    // PER_xxx thô) cho tới lúc tự tải lại trang, cùng lỗi đã sửa ở PATCH
    // /tasks/:id trước đó (xem ghi chú ở route đó).
    const perIds = [...new Set([row.chairPerId, ...row.participantPerIds])];
    const summaries = await getPersonSummariesByPerIds(db, perIds);
    res.json({
      ...row,
      chairName: summaries[row.chairPerId]?.name ?? null,
      chairRoleLabel: summaries[row.chairPerId]?.roleLabel ?? null,
      chairLabel: formatPersonLabel(row.chairPerId, summaries[row.chairPerId]),
      participantLabels: row.participantPerIds.map((pid) => formatPersonLabel(pid, summaries[pid]))
    });
  })
);

// Port từ `changeLtcEventStatus`.
workScheduleRouter.patch(
  '/events/:id/status',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await changeEventStatus(db, {
      eventId: String(req.params.id),
      nextStatus: d.nextStatus,
      note: d.note,
      actorPerId: actor.perId,
      actorAssignments: actor.roles
    });
    res.json(row);
  })
);

// Port từ `approveLtcEvent` — điểm vào DUY NHẤT hợp lệ để duyệt
// PENDING_APPROVAL -> PUBLISHED, khớp đúng bản gốc.
workScheduleRouter.post(
  '/events/:id/approve',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const row = await approveEvent(db, {
      eventId: String(req.params.id),
      actorPerId: actor.perId,
      actorAssignments: actor.roles
    });
    res.json(row);
  })
);

// SỬA 2026-09-29 (Sin: "lịch của ai thì xem lịch người đó thôi, ko hiện
// xem tất cả các lịch chung") — KHÁC hẳn ghi chú gốc phía trên (đã lỗi
// thời): giờ LUÔN lọc theo đúng actor đang đăng nhập (chủ trì HOẶC thành
// phần tham dự), cộng lịch toàn trường trừ khi `includeSchoolWide=false`
// (nút ẩn/hiện lịch toàn trường ở UI). Không còn cách nào từ route này xem
// được lịch của người khác nữa — kể cả Hiệu trưởng/Phó Hiệu trưởng.
workScheduleRouter.get(
  '/events',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const rows = await listEvents(db, {
      campusId: typeof req.query.campusId === 'string' ? req.query.campusId : undefined,
      statuses: parseStatuses(req.query.statuses),
      forPerId: actor.perId,
      includeSchoolWide: req.query.includeSchoolWide !== 'false'
    });
    // Hiện tên + chức vụ thay vì mã `PER_xxx` thô (Sin phát hiện 21/09/2026,
    // modal chi tiết lịch công tác) — cùng cơ chế `getPersonSummariesByPerIds`
    // dùng chung với `/tasks`/`/audit-logs` bên dưới.
    const perIds = [...new Set(rows.flatMap((r) => [r.chairPerId, ...r.participantPerIds]))];
    const summaries = await getPersonSummariesByPerIds(db, perIds);
    res.json({
      items: rows.map((r) => ({
        ...r,
        chairName: summaries[r.chairPerId]?.name ?? null,
        chairRoleLabel: summaries[r.chairPerId]?.roleLabel ?? null,
        chairLabel: formatPersonLabel(r.chairPerId, summaries[r.chairPerId]),
        participantLabels: r.participantPerIds.map((pid) => formatPersonLabel(pid, summaries[pid]))
      }))
    });
  })
);

// Xoá HẲN 1 sự kiện — bổ sung 2026-09-29 (Sin: "có option xoá hẳn lịch đã
// huỷ"). Người tạo/chủ trì hoặc lãnh đạo mới xoá được (deleteEvent tự
// kiểm, ở đây chỉ tính `isAdmin` để truyền vào).
workScheduleRouter.delete(
  '/events/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    await deleteEvent(db, String(req.params.id), actor.perId, { isAdmin: canManageSchoolCalendar(actor.roles) });
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------

// Port từ `createLtcTask`.
workScheduleRouter.post(
  '/tasks',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await createTask(db, {
      eventId: d.eventId,
      parentTaskId: d.parentTaskId,
      title: d.title,
      description: d.description,
      campusId: d.campusId,
      assigneePerId: d.assigneePerId,
      collaboratorPerIds: d.collaboratorPerIds,
      location: d.location,
      startAt: d.startAt ? new Date(d.startAt) : null,
      dueAt: d.dueAt ? new Date(d.dueAt) : undefined!,
      createdByPerId: actor.perId
    });
    res.status(201).json(row);
  })
);

// Chỉnh sửa nội dung việc nhỏ — bổ sung 2026-09-29 (Sin yêu cầu, xem ghi
// chú ở updateTask trong work-schedule.service.ts), cùng khuôn với PATCH
// /events/:id ở trên.
workScheduleRouter.patch(
  '/tasks/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await updateTask(db, {
      taskId: String(req.params.id),
      actorPerId: actor.perId,
      taskData: {
        title: d.title,
        description: d.description,
        campusId: d.campusId,
        assigneePerId: d.assigneePerId,
        collaboratorPerIds: d.collaboratorPerIds,
        location: d.location,
        startAt: d.startAt ? new Date(d.startAt) : null,
        dueAt: d.dueAt ? new Date(d.dueAt) : undefined!
      }
    });
    // Gắn tên hiển thị vào response y hệt GET /tasks — thiếu bước này thì
    // sau khi sửa (vd. đổi người được giao/thêm người cùng làm), dialog chi
    // tiết vẫn hiện tên CŨ cho tới lúc tự tải lại trang (Hestia tự phát
    // hiện 2026-09-29 khi live-test tính năng vừa thêm, không phải Sin báo).
    const perIds = [...new Set([row.assigneePerId, row.createdByPerId, ...row.collaboratorPerIds])];
    const summaries = await getPersonSummariesByPerIds(db, perIds);
    res.json({
      ...row,
      assigneeName: summaries[row.assigneePerId]?.name ?? null,
      assigneeRoleLabel: summaries[row.assigneePerId]?.roleLabel ?? null,
      assigneeLabel: formatPersonLabel(row.assigneePerId, summaries[row.assigneePerId]),
      createdByName: summaries[row.createdByPerId]?.name ?? null,
      createdByRoleLabel: summaries[row.createdByPerId]?.roleLabel ?? null,
      createdByLabel: formatPersonLabel(row.createdByPerId, summaries[row.createdByPerId]),
      collaboratorLabels: row.collaboratorPerIds.map((pid) => formatPersonLabel(pid, summaries[pid]))
    });
  })
);

// Port từ `changeLtcTaskStatus` (không forward `progress` — service đã port
// không nhận field này, xem ghi chú đầu file).
workScheduleRouter.patch(
  '/tasks/:id/status',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await changeTaskStatus(db, {
      taskId: String(req.params.id),
      nextStatus: d.nextStatus,
      note: d.note,
      evidenceUrl: d.evidenceUrl,
      actorPerId: actor.perId
    });
    res.json(row);
  })
);

// SỬA 2026-09-29 (Sin: "giao việc cũng chỉ hiện việc mà mình là người giao
// hoặc là người phải thực hiện thôi, ko phải ai cũng xem hết việc được
// giao của nhau đâu") — LUÔN lọc theo actor (người giao HOẶC người thực
// hiện/cùng làm), không còn cách nào xem việc của người khác qua route
// này — kể cả kèm `eventId` (chỉ thấy việc nhỏ của sự kiện đó NẾU actor
// cũng liên quan tới chính việc nhỏ đó).
workScheduleRouter.get(
  '/tasks',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const parentTaskId = typeof req.query.parentTaskId === 'string' ? req.query.parentTaskId : undefined;
    // "Xem TOÀN BỘ việc nhỏ của 1 việc lớn" (dialog chi tiết) — KHÔNG áp
    // forPerId (mới thấy đúng phần của mình) mà phải thấy hết mọi việc nhỏ
    // dù người phụ trách là ai — nhưng CHỈ chủ trì/người tạo việc lớn đó
    // mới được xem đủ (2026-09-30, Sin: "chỉ cho người chủ trì hoặc người
    // tạo chỉnh sửa" — xem theo dõi tiến độ đầy đủ cũng chỉ 2 người này).
    if (parentTaskId) {
      const [parent] = await db.select().from(ltcTasks).where(eq(ltcTasks.id, parentTaskId)).limit(1);
      if (!parent) throw new AppError('not_found', `Không tìm thấy việc lớn ${parentTaskId}`);
      if (parent.createdByPerId !== actor.perId && parent.assigneePerId !== actor.perId) {
        throw new AppError('forbidden', 'Chỉ người giao việc hoặc chủ trì của việc lớn mới được xem đủ danh sách việc nhỏ.');
      }
    }
    const rows = await listTasks(db, {
      campusId: typeof req.query.campusId === 'string' ? req.query.campusId : undefined,
      assigneePerId: typeof req.query.assigneePerId === 'string' ? req.query.assigneePerId : undefined,
      statuses: parseStatuses(req.query.statuses),
      // Bổ sung 2026-09-28 — "bấm vào việc lớn xem các việc nhỏ" (xem
      // work-schedule.service.ts::listTasks).
      eventId: typeof req.query.eventId === 'string' ? req.query.eventId : undefined,
      parentTaskId,
      // parentTaskId đã tự kiểm tra quyền ở trên — KHÔNG áp thêm forPerId
      // nữa (áp thêm sẽ vô tình lọc mất việc nhỏ của người khác, phá đúng
      // mục đích "xem đủ" của chủ trì/người tạo).
      forPerId: parentTaskId ? undefined : actor.perId
    });
    const rowsWithSubtaskInfo = await attachEventTitles(db, await attachSubtaskInfo(db, rows));
    // Bổ sung tên hiển thị + chức vụ của người được giao — trước đây frontend
    // chỉ có assigneePerId (mã nội bộ), phải tự hiện thẳng mã đó lên UI cho
    // người dùng thật (Sin phát hiện 13/09/2026, trang Trung tâm phê duyệt;
    // bổ sung thêm chức vụ 21/09/2026). collaboratorPerIds bổ sung
    // 2026-09-28 — trước đây KHÔNG hề gắn tên, "nhiều người cùng làm" hiện
    // ra toàn mã PER_xxx thô nếu có chỗ nào lỡ hiện (thực ra chưa chỗ nào
    // hiện — TasksListPage.tsx chỉ DÙNG collaboratorPerIds để lọc, không
    // hiện tên) — thêm nhãn sẵn để UI hiện được ngay, không phải sửa thêm
    // route lần nữa khi frontend cần.
    const perIds = [...new Set(rowsWithSubtaskInfo.flatMap((r) => [r.assigneePerId, r.createdByPerId, ...r.collaboratorPerIds]))];
    const summaries = await getPersonSummariesByPerIds(db, perIds);
    res.json({
      items: rowsWithSubtaskInfo.map((r) => ({
        ...r,
        assigneeName: summaries[r.assigneePerId]?.name ?? null,
        assigneeRoleLabel: summaries[r.assigneePerId]?.roleLabel ?? null,
        assigneeLabel: formatPersonLabel(r.assigneePerId, summaries[r.assigneePerId]),
        createdByName: summaries[r.createdByPerId]?.name ?? null,
        createdByRoleLabel: summaries[r.createdByPerId]?.roleLabel ?? null,
        createdByLabel: formatPersonLabel(r.createdByPerId, summaries[r.createdByPerId]),
        collaboratorLabels: r.collaboratorPerIds.map((pid) => formatPersonLabel(pid, summaries[pid]))
      }))
    });
  })
);

// Xoá HẲN 1 công việc — bổ sung 2026-09-29, cùng đợt với DELETE /events/:id.
workScheduleRouter.delete(
  '/tasks/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    await deleteTask(db, String(req.params.id), actor.perId, { isAdmin: isLeadership(actor.roles) });
    res.json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// Nhật ký kiểm toán — trước đây bảng `ltc_audit_logs` chỉ được GHI (mọi
// hàm đổi trạng thái ở service), chưa có route nào ĐỌC lại. Theo đúng
// khuôn `safety-query.routes.ts::/audit-logs`, chỉ cần đăng nhập (không
// thêm lớp phân quyền riêng — lịch sử thao tác không nhạy cảm hơn chính
// nội dung lịch/việc mà mọi nhân viên đã xem được).
// ---------------------------------------------------------------------

workScheduleRouter.get(
  '/audit-logs',
  firebaseAuth,
  withAppError(async (req, res) => {
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : undefined;
    const entityId = typeof req.query.entityId === 'string' ? req.query.entityId : undefined;
    const rows = await getAuditLogs(db, { entityType, entityId });
    const summaries = await getPersonSummariesByPerIds(db, rows.map((r) => r.actorPerId));
    res.json({
      items: rows.map((r) => ({
        ...r,
        actorName: summaries[r.actorPerId]?.name ?? null,
        actorRoleLabel: summaries[r.actorPerId]?.roleLabel ?? null,
        actorLabel: formatPersonLabel(r.actorPerId, summaries[r.actorPerId])
      }))
    });
  })
);

// ---------------------------------------------------------------------
// Ngày nghỉ lễ (holiday) — bổ sung 2026-09-29, xem getPublicHolidays().
// ---------------------------------------------------------------------

workScheduleRouter.get(
  '/holidays',
  firebaseAuth,
  withAppError(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const items = await getPublicHolidays(year);
    res.json({ items });
  })
);

// ---------------------------------------------------------------------
// Dashboard — bổ sung 2026-10-05 (mo_ta_dashboard_lich_cong_tac.md). Cùng
// nguyên tắc với /audit-logs/holidays ở trên: chỉ cần đăng nhập, không
// thêm capability gate riêng (số liệu tổng hợp không nhạy cảm hơn chính
// danh sách lịch/việc mọi nhân viên đã xem được qua /events, /tasks).
// `from`/`to` bắt buộc dạng 'YYYY-MM-DD' — route tự quy về đầu/cuối ngày.
// ---------------------------------------------------------------------

workScheduleRouter.get(
  '/dashboard-summary',
  firebaseAuth,
  withAppError(async (req, res) => {
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    if (!fromRaw || !toRaw || !/^\d{4}-\d{2}-\d{2}$/.test(fromRaw) || !/^\d{4}-\d{2}-\d{2}$/.test(toRaw)) {
      throw new HttpError(400, 'Thiếu hoặc sai định dạng from/to (YYYY-MM-DD).', 'INVALID_INPUT');
    }
    // KHÔNG thêm hậu tố 'Z' — khớp đúng quy ước `new Date(d.startAt)` đã
    // dùng cho createEvent/updateRevisionEvent (xem đầu file): server VPS
    // chạy timezone Asia/Ho_Chi_Minh (+07:00), chuỗi không có 'Z' được
    // Node hiểu theo giờ local của máy chủ = giờ Việt Nam. Thêm 'Z' sẽ ép
    // về UTC, lệch 7 tiếng so với mốc đầu/cuối ngày thật ở Việt Nam.
    const from = new Date(`${fromRaw}T00:00:00.000`);
    const to = new Date(`${toRaw}T23:59:59.999`);
    const campusId = typeof req.query.campusId === 'string' && req.query.campusId ? req.query.campusId : undefined;
    const type = typeof req.query.type === 'string' && req.query.type ? req.query.type : undefined;
    const summary = await getDashboardSummary(db, { from, to, campusId, type });
    res.json(summary);
  })
);

// ---------------------------------------------------------------------
// Xuất lịch .ics — khớp `/api/calendar.ics` bản gốc, LỆCH đường dẫn CÓ CHỦ
// Ý (gộp vào chung tiền tố `/api/work-schedule` cho nhất quán routing của
// cả app, không phải quên). CỐ TÌNH KHÔNG `firebaseAuth` — đây là link
// "đăng ký lịch" để mở trực tiếp bằng ứng dụng lịch ngoài (Google
// Calendar/Outlook...), các app đó KHÔNG gửi kèm Bearer token của hệ
// thống. An toàn vì chỉ xuất lịch đã PUBLISHED (không phải nội dung nội
// bộ DRAFT/PENDING_APPROVAL) — xem `ics.ts`.
// ---------------------------------------------------------------------

workScheduleRouter.get(
  '/calendar.ics',
  withAppError(async (req, res) => {
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : undefined;
    const rows = await listEvents(db, { campusId, statuses: ['PUBLISHED'] }, { withTaskProgress: false });
    const ics = buildIcsCalendar(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        location: r.location,
        startAt: r.startAt,
        endAt: r.endAt,
        updatedAt: r.updatedAt
      }))
    );
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="lich-cong-tac.ics"');
    res.send(ics);
  })
);
