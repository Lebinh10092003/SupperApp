/**
 * safety.routes.ts — route HTTP cho module An toàn, port từ các Cloud
 * Function tương ứng trong `index.js` gốc. Theo đúng khuôn
 * `work-schedule.routes.ts` (K4): `firebaseAuth` xác thực, phân quyền THẬT
 * nằm trong `authz.ts` (9 bước), route KHÔNG tự chặn thêm bằng
 * `requireCapability`. `actor` LUÔN lấy từ `loadActorContext` (đọc DB thật
 * theo uid đã xác thực) — không tin client tự khai perId/vai trò.
 *
 * PHẠM VI file này: CHỈ 9 route ứng với 14 hàm `safety.js` đã port xong
 * (report-flow.ts + incident-lifecycle.ts). CHƯA CÓ ở đây (việc sau, xem
 * SUPERAPP_MIGRATION_COORDINATION/TASKS.md): lookupReportStatus,
 * addReportSupplement, uploadEvidence, listCategories, và ~40 route
 * liệt kê/thống kê/quản trị khác trong `index.js` gốc.
 *
 * 2 route công khai (`/reports`, `/reports/confirm-close`) KHÔNG dùng
 * `firebaseAuth` — khớp đúng bản gốc dùng `onRequest` (không đăng nhập) chứ
 * không phải `onCall`.
 *
 * LỆCH 1 CHỖ so với bản gốc, CỐ Ý (không phải sai sót khi port): bản gốc
 * `exports.createIncidentDirect` gọi `safety.submitReport` mà KHÔNG truyền
 * email/phone — nhưng `submitReport` (từ quyết định họp 07/09/2026) bắt
 * buộc có 1 trong 2, nên đường này ở bản gốc thực ra LUÔN throw
 * `invalid_input` (bug có sẵn, không phải do di trú gây ra). Route
 * `/incidents/direct` ở đây dùng email tài khoản Workspace của actor đã
 * đăng nhập để qua ràng buộc đó — hợp lý hơn tái tạo lại lỗi gốc.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext, type ActorContext } from '../identity/actor-context.js';
import { inOrgScope } from './authz.js';
import { findLeadershipForCampus, findDeptHeadsForCampus } from './escalation-recipients.js';
import { publicCodes } from './ids.schema.js';
import { incidents } from './incidents.schema.js';
import { AppError } from './shared.js';
import { submitReport } from './report-flow.js';
import {
  changeIncidentPriority,
  transitionIncidentStatus,
  confirmIncidentCloseByReporter,
  reopenIncident,
  assignCommander,
  acknowledgeIncident,
  addIncidentParticipant,
  joinIncident,
  approveJoinRequest,
  rejectJoinRequest,
  leaveIncident,
  requestCancelAcknowledgment,
  approveCancelAcknowledgment,
  mergeDuplicateIncidents,
  updateIncidentClassification
} from './incident-lifecycle.js';
import { makeDispatchHook, makeBellHook, makeNotifyReporterHook } from './notify-hooks.js';

/** `exports.createIncidentFromReport`/`createIncidentDirect` gốc chặn NGAY ở tầng route nếu chưa có vai trò nào — safety.createIncidentFromReport (khác các hàm trong incident-lifecycle.ts) không tự gọi checkAuthorization nội bộ. */
function requireAnyRole(actor: ActorContext) {
  if (!actor.roles || actor.roles.length === 0) {
    throw new HttpError(403, 'Tài khoản chưa được phân vai trò nào trong hệ thống.', 'PERMISSION_ERROR');
  }
}

export const safetyRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  invalid_transition: 409,
  terminal_state: 409,
  reason_required: 400,
  priority_required: 400,
  approval_required: 403,
  reporter_confirmation_pending: 409,
  no_recipients: 422
};

// Bọc quanh mọi handler — dịch `AppError` (lỗi nghiệp vụ, port từ
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

// Hook thật DÙNG CHUNG cho mọi route nội bộ — xem notify-hooks.ts để biết
// vì sao KHÔNG nối thẳng `dispatchRequest`/`pushAdminNotifications` ở đây.
const dispatch = makeDispatchHook();
const pushBell = makeBellHook();
const notifyReporter = makeNotifyReporterHook();

// ---------------------------------------------------------------------
// Cổng công khai — KHÔNG đăng nhập (đúng bản gốc dùng onRequest).
// ---------------------------------------------------------------------

// Port từ `exports.submitReport`.
safetyRouter.post(
  '/reports',
  withAppError(async (req, res) => {
    const idempotencyKey = req.header('X-Idempotency-Key') || undefined;
    const d = req.body || {};
    const result = await submitReport(
      db,
      { ...d, idempotencyKey },
      { requestId: req.header('X-Request-Id') || undefined, dispatch, pushBell }
    );
    res.status(201).json(result);
  })
);

// Port từ `exports.confirmReportClose` — xác thực CHỈ bằng đúng mã tra cứu
// công khai, không đăng nhập (cùng mức tin cậy với bản gốc).
safetyRouter.post(
  '/reports/confirm-close',
  withAppError(async (req, res) => {
    const publicCode = req.body?.publicCode;
    if (!publicCode) throw new HttpError(400, 'Thiếu mã tra cứu.', 'INVALID_INPUT');
    const [row] = await db.select().from(publicCodes).where(eq(publicCodes.code, String(publicCode))).limit(1);
    if (!row?.reportId) throw new HttpError(404, 'Không tìm thấy mã tra cứu này.', 'NOT_FOUND');
    const result = await confirmIncidentCloseByReporter(db, { reportId: row.reportId }, { now: new Date() });
    res.status(200).json({ ok: true, state: result.state });
  })
);

// ---------------------------------------------------------------------
// Khu vực nội bộ — bắt buộc đăng nhập.
// ---------------------------------------------------------------------

// `POST /incidents` (chuyển tin báo thành hồ sơ / gộp tin báo vào hồ sơ có
// sẵn) — ĐÃ BỎ 2026-09-22. Từ nay `submitReport` tự tạo hồ sơ ngay lúc gửi
// tin (không còn "tin báo chờ chuyển thành hồ sơ" để cần route này nữa).
// Tin báo trùng nhau xử lý bằng `POST /incidents/:id/merge-duplicate`
// (gộp 2 HỒ SƠ đã tồn tại, xem `mergeDuplicateIncidents`).

// Port từ `exports.createIncidentDirect`, cho cổng nội bộ tạo hồ sơ trực
// tiếp không cần có sẵn 1 tin báo trước (VD giáo viên/bảo vệ trực tiếp
// chứng kiến sự việc). Từ 2026-09-22, `submitReport` TỰ tạo luôn hồ sơ
// (xem report-flow.ts) — route này KHÔNG còn gọi `createIncidentFromReport`
// thêm lần nữa (gọi 2 lần sẽ tạo 2 hồ sơ trùng cho cùng 1 tin báo — đã
// chặn cứng ở createIncidentFromReport nếu lỡ gọi lại).
safetyRouter.post(
  '/incidents/direct',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    requireAnyRole(actor);
    const d = req.body || {};
    if (!d.campusId) throw new HttpError(400, 'Thiếu campusId.', 'INVALID_INPUT');
    if (!inOrgScope(actor, { campusId: d.campusId })) {
      throw new HttpError(403, 'Cơ sở này không thuộc phạm vi bạn phụ trách.', 'PERMISSION_ERROR');
    }
    const { reportId, incidentId } = await submitReport(
      db,
      {
        campusId: d.campusId,
        categoryCode: d.categoryCode,
        content: d.content,
        className: d.className,
        stillDangerous: d.stillDangerous,
        evidenceIds: d.evidenceIds,
        priorityOverride: d.priority,
        channel: 'internal_witness',
        createdByPerId: actor.perId,
        contactName: req.appUser!.displayName || undefined,
        // Cổng nội bộ (nhân viên đã đăng nhập, có sẵn tài khoản Workspace)
        // KHÔNG nhất thiết có sẵn email/phone cá nhân trong request — dùng
        // email tài khoản Workspace để qua ràng buộc bắt buộc liên hệ.
        email: req.appUser!.email,
        idempotencyKey: d.idempotencyKey || undefined
      },
      { dispatch, pushBell, notifyReporter }
    );
    res.status(201).json({ reportId, incidentId });
  })
);

// Port từ `exports.changeIncidentPriority`.
safetyRouter.patch(
  '/incidents/:id/priority',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await changeIncidentPriority(
      db,
      { actor, incidentId: String(req.params.id), toPriority: d.toPriority, reason: d.reason },
      { approvedBy: d.approvedBy, dispatch, pushBell }
    );
    res.json(row);
  })
);

// Port từ `exports.updateIncidentState` (đổi tên `transitionIncidentStatus`
// đúng theo `safety.js`, xem ghi chú lịch sử ở `incident-lifecycle.ts`).
safetyRouter.patch(
  '/incidents/:id/status',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await transitionIncidentStatus(
      db,
      { actor, incidentId: String(req.params.id), toState: d.toState, note: d.note, reason: d.reason },
      { notifyReporter, dispatch, pushBell }
    );
    res.json(row);
  })
);

// Port từ `exports.reopenIncident`.
safetyRouter.post(
  '/incidents/:id/reopen',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await reopenIncident(db, { actor, incidentId: String(req.params.id), reason: d.reason }, { approvedBy: d.approvedBy });
    res.json(row);
  })
);

// Port từ `exports.assignCommander`. `extraRecipients` (Phó HT phụ trách
// cơ sở, "Hiệu phó phụ trách chính phân hiệu đó cũng phải nhận được thông
// báo"). Bản gốc tự viết `findVicePrincipalsForCampus` riêng (chỉ Phó HT) —
// ở đây dùng lại `findLeadershipForCampus` (escalation-recipients.ts, đã
// port + test sẵn), trả thêm cả Hiệu trưởng — vô hại vì `bellRecipients`
// trong assignCommander đã gộp qua Set (không gửi trùng), và Hiệu trưởng
// biết việc đổi chỉ huy cũng hợp lý, không phải rò rỉ thông tin sai phạm vi.
safetyRouter.post(
  '/incidents/:id/commander',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, String(req.params.id))).limit(1);
    const now = new Date();
    const extraRecipients = incident ? await findLeadershipForCampus(db, incident.campusId, { now }) : [];
    const row = await assignCommander(
      db,
      { actor, incidentId: String(req.params.id), commanderPerId: d.commanderPerId, reason: d.reason },
      { approvedBy: d.approvedBy, dispatch, pushBell, extraRecipients, now }
    );
    res.json(row);
  })
);

// Tự tiếp nhận — Sin chốt 2026-09-22: ai bấm sẽ TỰ trở thành chỉ huy, không
// qua matrix `incident.assign_commander` (chỉ Hiệu trưởng/Phó HT) vì đây là
// hành động tự nhận trách nhiệm, không phải chỉ định người khác. Xem
// `acknowledgeIncident` (incident-lifecycle.ts) cho phần phân quyền thật.
safetyRouter.post(
  '/incidents/:id/acknowledge',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, String(req.params.id))).limit(1);
    const now = new Date();
    const extraRecipients = incident ? await findLeadershipForCampus(db, incident.campusId, { now }) : [];
    const row = await acknowledgeIncident(db, { actor, incidentId: String(req.params.id), priority: d.priority }, { dispatch, pushBell, extraRecipients, now });
    res.json(row);
  })
);

// Chỉ huy hồ sơ thêm người cùng xử lý — xem `addIncidentParticipant`
// (incident-lifecycle.ts). Route chỉ chuyển tiếp, phân quyền thật ở đó
// (chỉ chính người chỉ huy hiện tại mới gọi được).
safetyRouter.post(
  '/incidents/:id/participants',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await addIncidentParticipant(db, { actor, incidentId: String(req.params.id), perId: d.perId }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

// Tự tham gia / tự rời sự vụ — xem `joinIncident`/`leaveIncident`
// (incident-lifecycle.ts). Bắt buộc lý do mỗi lần.
safetyRouter.post(
  '/incidents/:id/join',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await joinIncident(db, { actor, incidentId: String(req.params.id), reason: d.reason }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

// Duyệt/từ chối yêu cầu tự tham gia — chỉ huy hồ sơ hoặc cấp cao (Hiệu
// trưởng/Phó HT/Tổ trưởng), xem `approveJoinRequest`/`rejectJoinRequest`
// (incident-lifecycle.ts).
safetyRouter.post(
  '/incidents/:id/join-requests/:perId/approve',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const row = await approveJoinRequest(db, { actor, incidentId: String(req.params.id), perId: String(req.params.perId) }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

safetyRouter.post(
  '/incidents/:id/join-requests/:perId/reject',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await rejectJoinRequest(db, { actor, incidentId: String(req.params.id), perId: String(req.params.perId), reason: d.reason }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

safetyRouter.post(
  '/incidents/:id/leave',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await leaveIncident(db, { actor, incidentId: String(req.params.id), reason: d.reason }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

// Huỷ tiếp nhận — quy trình yêu cầu/duyệt thật, xem
// `requestCancelAcknowledgment`/`approveCancelAcknowledgment`
// (incident-lifecycle.ts). Diện nhận thông báo yêu cầu treo: Tổ trưởng +
// Phó HT/Hiệu trưởng đúng cơ sở (gộp findDeptHeadsForCampus +
// findLeadershipForCampus, cùng cách route /commander đã dùng).
safetyRouter.post(
  '/incidents/:id/cancel-acknowledgment/request',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, String(req.params.id))).limit(1);
    const now = new Date();
    const extraRecipients = incident
      ? Array.from(new Set([...(await findDeptHeadsForCampus(db, incident.campusId, { now })), ...(await findLeadershipForCampus(db, incident.campusId, { now }))]))
      : [];
    const row = await requestCancelAcknowledgment(db, { actor, incidentId: String(req.params.id), reason: d.reason }, { dispatch, pushBell, extraRecipients, now });
    res.json(row);
  })
);

safetyRouter.post(
  '/incidents/:id/cancel-acknowledgment/decide',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await approveCancelAcknowledgment(db, { actor, incidentId: String(req.params.id), approve: !!d.approve, note: d.note }, { dispatch, pushBell, now: new Date() });
    res.json(row);
  })
);

// Gộp 2 sự vụ trùng nhau — xem `mergeDuplicateIncidents` (incident-lifecycle.ts).
safetyRouter.post(
  '/incidents/:id/merge-duplicate',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await mergeDuplicateIncidents(
      db,
      { actor, keepIncidentId: String(d.keepIncidentId), duplicateIncidentId: String(req.params.id), reason: d.reason },
      { dispatch, pushBell }
    );
    res.json(row);
  })
);

// Port từ `exports.updateIncidentClassification`.
safetyRouter.patch(
  '/incidents/:id/classification',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const row = await updateIncidentClassification(
      db,
      { actor, incidentId: String(req.params.id), className: d.className, reason: d.reason },
      { approvedBy: d.approvedBy, dispatch, pushBell }
    );
    res.json(row);
  })
);
