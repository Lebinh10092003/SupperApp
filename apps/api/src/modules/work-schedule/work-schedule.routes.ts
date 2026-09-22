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
  changeEventStatus,
  approveEvent,
  listEvents,
  createTask,
  changeTaskStatus,
  acceptOrReturnTask,
  listTasks,
  getAuditLogs
} from './work-schedule.service.js';
import { buildIcsCalendar } from './ics.js';

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
    const row = await createEvent(db, {
      title: d.title,
      description: d.description,
      type: d.type,
      priority: d.priority,
      campusId: d.campusId,
      scope: d.scope,
      startAt: d.startAt ? new Date(d.startAt) : undefined!,
      endAt: d.endAt ? new Date(d.endAt) : undefined!,
      location: d.location,
      chairPerId: d.chairPerId || actor.perId,
      participantPerIds: d.participantPerIds,
      departmentDomain: d.departmentDomain,
      createdByPerId: actor.perId
    });
    res.status(201).json(row);
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

// Port từ `listLtcEvents` — chỉ cần xác thực, không cần actor context (khớp
// bản gốc: `requireAuth(request)` rồi liệt kê thẳng, không lọc theo actor).
workScheduleRouter.get(
  '/events',
  firebaseAuth,
  withAppError(async (req, res) => {
    const rows = await listEvents(db, {
      campusId: typeof req.query.campusId === 'string' ? req.query.campusId : undefined,
      statuses: parseStatuses(req.query.statuses)
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
      title: d.title,
      description: d.description,
      priority: d.priority,
      campusId: d.campusId,
      assigneePerId: d.assigneePerId,
      collaboratorPerIds: d.collaboratorPerIds,
      dueAt: d.dueAt ? new Date(d.dueAt) : undefined!,
      createdByPerId: actor.perId
    });
    res.status(201).json(row);
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

// Port từ `acceptOrReturnLtcTask` — điểm vào DUY NHẤT hợp lệ cho
// COMPLETED/RETURNED, khớp đúng bản gốc.
workScheduleRouter.post(
  '/tasks/:id/accept-or-return',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await acceptOrReturnTask(db, {
      taskId: String(req.params.id),
      nextStatus: d.nextStatus,
      note: d.note,
      actorPerId: actor.perId
    });
    res.json(row);
  })
);

// Port từ `listLtcTasks` — chỉ cần xác thực, khớp bản gốc.
workScheduleRouter.get(
  '/tasks',
  firebaseAuth,
  withAppError(async (req, res) => {
    const rows = await listTasks(db, {
      campusId: typeof req.query.campusId === 'string' ? req.query.campusId : undefined,
      assigneePerId: typeof req.query.assigneePerId === 'string' ? req.query.assigneePerId : undefined,
      statuses: parseStatuses(req.query.statuses)
    });
    // Bổ sung tên hiển thị + chức vụ của người được giao — trước đây frontend
    // chỉ có assigneePerId (mã nội bộ), phải tự hiện thẳng mã đó lên UI cho
    // người dùng thật (Sin phát hiện 13/09/2026, trang Trung tâm phê duyệt;
    // bổ sung thêm chức vụ 21/09/2026).
    const perIds = [...new Set(rows.flatMap((r) => [r.assigneePerId, r.createdByPerId]))];
    const summaries = await getPersonSummariesByPerIds(db, perIds);
    res.json({
      items: rows.map((r) => ({
        ...r,
        assigneeName: summaries[r.assigneePerId]?.name ?? null,
        assigneeRoleLabel: summaries[r.assigneePerId]?.roleLabel ?? null,
        assigneeLabel: formatPersonLabel(r.assigneePerId, summaries[r.assigneePerId]),
        createdByName: summaries[r.createdByPerId]?.name ?? null,
        createdByRoleLabel: summaries[r.createdByPerId]?.roleLabel ?? null,
        createdByLabel: formatPersonLabel(r.createdByPerId, summaries[r.createdByPerId])
      }))
    });
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
    const rows = await listEvents(db, { campusId, statuses: ['PUBLISHED'] });
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
