/**
 * safety-query.routes.ts — route ĐỌC (liệt kê/tra cứu/chuông thông báo) cho
 * module An toàn, tách riêng khỏi `safety.routes.ts` (route GHI/nghiệp vụ
 * chính) để mỗi file không phình quá lớn — cùng mount vào `/api/safety`
 * (xem server.ts). Port từ các Cloud Function tương ứng trong `index.js`
 * gốc: lookupReportStatus, addReportSupplement, listReportSupplements,
 * listPendingReports, listIncidents, getIncident, readAuditLog,
 * listNotifyRequestsForObject, listMyPendingAcks, acknowledgeNotifyRequest,
 * listAdminNotifications, markAdminNotificationRead, registerPushToken,
 * unregisterPushToken.
 *
 * CHƯA CÓ ở đây (Killshot làm ở K7, `safety-stats.routes.ts` +
 * `trend-alerts.ts`/`campus-comparison-stats.ts`/`people-search.ts`):
 * getIncidentStats/getTrendAlerts/getCampusComparisonStats/getZoneStats/
 * getClassStats/searchPeople. Cũng CHƯA CÓ: uploadEvidence/
 * getEvidenceDownloadUrl (multipart — việc riêng), listCategories/
 * listCampusZonesPublic (đọc catalog tĩnh, chưa gấp), và toàn bộ nhóm
 * `admin*` quản lý tài khoản (cần quyết định kiến trúc trước, xem
 * TASKS.md).
 *
 * `people-search.ts` trong thư mục này là bản Hestia tự port trước khi
 * biết Killshot cũng đã làm ở K7 (gần như giống hệt, có test kèm bên K7) —
 * khi merge 2 nhánh, xoá bản này, dùng bản K7 làm chuẩn (đã có
 * `people-search.test.ts`).
 */

import { Router } from 'express';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { checkAuthorization, actorCeiling, inOrgScope, type Actor } from './authz.js';
import { CATEGORY_CATALOG, confidentialityRank, type Confidentiality } from './catalog.js';
import { publicCodes } from './ids.schema.js';
import { reports, reportIdentities, reportSupplements } from './reports.schema.js';
import { incidents } from './incidents.schema.js';
import { slaClocks } from './sla-clocks.schema.js';
import { notifyRequests } from './dispatch.schema.js';
import { auditLogs } from './audit.schema.js';
import { adminNotifications } from './admin-notify.schema.js';
import { evidence as evidenceTable } from './evidence.schema.js';
import { canViewEvidence } from './evidence.js';
import { markNotificationRead } from './admin-notify.js';
import { registerPushToken, unregisterPushToken } from './push-notify.js';
import { acknowledge } from './notify.js';
import { getDisplayNamesByPerIds } from './people-search.js';
import { filterReportItems, filterIncidentItems, sortReportItemsDefault } from './report-filters.js';
import { resolveClassRelatedPeople } from './report-flow.js';

export const safetyQueryRouter = Router();

const VIEW_ACTION_BY_CONFIDENTIALITY: Record<string, string> = {
  C1: 'incident.view_c1_c2',
  C2: 'incident.view_c1_c2',
  C3: 'incident.view_c3',
  C4: 'incident.view_c4'
};

async function listEvidenceSummaryForReportIds(reportIds: string[]) {
  if (reportIds.length === 0) return [];
  const rows = await db.select().from(evidenceTable).where(and(inArray(evidenceTable.reportId, reportIds), eq(evidenceTable.deleted, false)));
  return rows.map((r) => ({ evidenceId: r.evidenceId, fileType: r.fileType, sizeBytes: r.sizeBytes, scanStatus: r.scanStatus }));
}

// ---------------------------------------------------------------------
// Cổng công khai — KHÔNG đăng nhập.
// ---------------------------------------------------------------------

// Port từ `exports.lookupReportStatus` — CHỈ trả trạng thái/mức độ tổng
// quát, TUYỆT ĐỐI không trả nội dung/danh tính/ghi chú nội bộ, và không
// cho suy ra reportId/incidentId thật từ mã công khai theo chiều ngược lại.
safetyQueryRouter.get(
  '/reports/lookup',
  asyncRoute(async (req, res) => {
    const publicCode = req.query.publicCode;
    if (!publicCode) throw new HttpError(400, 'Thiếu mã tra cứu.', 'INVALID_INPUT');
    const [code] = await db.select().from(publicCodes).where(eq(publicCodes.code, String(publicCode))).limit(1);
    if (!code?.reportId) throw new HttpError(404, 'Không tìm thấy mã tra cứu này.', 'NOT_FOUND');
    const [report] = await db.select().from(reports).where(eq(reports.reportId, code.reportId)).limit(1);
    if (!report) throw new HttpError(404, 'Không tìm thấy tin báo.', 'NOT_FOUND');

    let friendlyState = 'Đã tiếp nhận, đang chờ phân loại';
    let canConfirmClose = false;
    if (report.mergedIntoIncidentId) {
      const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, report.mergedIntoIncidentId)).limit(1);
      if (incident) {
        friendlyState = incident.state;
        canConfirmClose = incident.state === 'Đề nghị đóng' && !incident.reporterCloseConfirmedAt;
      }
    }
    res.status(200).json({ publicCode: String(publicCode), state: friendlyState, updatedAt: report.occurredAt, canConfirmClose });
  })
);

// Port từ `exports.addReportSupplement`.
safetyQueryRouter.post(
  '/reports/supplement',
  asyncRoute(async (req, res) => {
    const { publicCode, content } = req.body || {};
    if (!publicCode || !content || !String(content).trim()) {
      throw new HttpError(400, 'Thiếu mã tra cứu hoặc nội dung bổ sung.', 'INVALID_INPUT');
    }
    const [code] = await db.select().from(publicCodes).where(eq(publicCodes.code, String(publicCode))).limit(1);
    if (!code?.reportId) throw new HttpError(404, 'Không tìm thấy mã tra cứu này.', 'NOT_FOUND');
    await db.insert(reportSupplements).values({ reportId: code.reportId, content: String(content).trim(), createdAt: new Date() });
    res.status(201).json({ ok: true });
  })
);

// ---------------------------------------------------------------------
// Khu vực nội bộ — bắt buộc đăng nhập.
// ---------------------------------------------------------------------

/** Kiểm tra actor có được xem 1 report/incident (đã gộp hoặc chưa) — dùng chung cho listReportSupplements/uploadEvidence sau này. */
async function assertCanViewReport(actor: Actor, mergedIntoIncidentId: string | null) {
  if (!mergedIntoIncidentId) {
    if (!actor.roles || actor.roles.length === 0) {
      throw new HttpError(403, 'Tài khoản chưa được phân vai trò nào trong hệ thống.', 'PERMISSION_ERROR');
    }
    return;
  }
  const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, mergedIntoIncidentId)).limit(1);
  if (!incident) return;
  const decision = checkAuthorization({
    actor,
    action: VIEW_ACTION_BY_CONFIDENTIALITY[incident.confidentiality] || 'incident.view_c1_c2',
    resource: { campusId: incident.campusId, confidentiality: incident.confidentiality, commanderPerId: incident.commanderPerId ?? undefined, assignedTaskPerIds: incident.assignedTaskPerIds || [] }
  });
  if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');
}

// Port từ `exports.listReportSupplements`.
safetyQueryRouter.get(
  '/reports/:reportId/supplements',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const reportId = String(req.params.reportId);
    const [report] = await db.select().from(reports).where(eq(reports.reportId, reportId)).limit(1);
    if (!report) throw new HttpError(404, 'Không tìm thấy tin báo ' + reportId, 'NOT_FOUND');
    await assertCanViewReport(actor, report.mergedIntoIncidentId);
    const rows = await db.select().from(reportSupplements).where(eq(reportSupplements.reportId, reportId)).orderBy(desc(reportSupplements.createdAt)).limit(50);
    res.json({ items: rows });
  })
);

// Port từ `exports.listPendingReports` — tin báo CHƯA gộp vào hồ sơ nào.
safetyQueryRouter.get(
  '/reports/pending',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    if (!actor.roles || actor.roles.length === 0) {
      throw new HttpError(403, 'Tài khoản chưa được phân vai trò nào trong hệ thống — liên hệ quản trị.', 'PERMISSION_ERROR');
    }
    const q = req.query as Record<string, string | undefined>;
    const categoryCodes = q.categoryCodes ? q.categoryCodes.split(',').filter(Boolean) : undefined;

    const rows = await db.select().from(reports).where(isNull(reports.mergedIntoIncidentId)).orderBy(desc(reports.occurredAt)).limit(500);

    let items = rows.map((r) => ({
      reportId: r.reportId,
      publicCode: r.publicCode,
      campusId: r.campusId,
      categoryCode: r.categoryCode,
      categoryLabel: CATEGORY_CATALOG[r.categoryCode]?.label || r.categoryCode,
      stillDangerous: !!r.stillDangerous,
      reporterRole: r.reporterRole,
      confidentiality: r.confidentiality as Confidentiality,
      content: r.content || '',
      occurredAt: r.occurredAt,
      occurredFrom: r.occurredFrom,
      occurredTo: r.occurredTo,
      channel: r.channel,
      className: r.className,
      suggestedClassNames: r.suggestedClassNames || [],
      redacted: false as boolean,
      canViewEvidence: false as boolean,
      evidenceList: [] as Array<{ evidenceId: string; fileType: string; sizeBytes: number; scanStatus: string }>
    }));

    // Lọc phạm vi cơ sở TRƯỚC khi áp filter client — vai trò không "toàn
    // trường" (mọi vai trò trừ Hiệu trưởng) chỉ được thấy tin báo thuộc
    // đúng cơ sở mình phụ trách (mục V.2 phạm vi tổ chức).
    items = items.filter((it) => inOrgScope(actor, { campusId: it.campusId }));
    const urgentCount = items.filter((it) => it.stillDangerous).length;
    items = filterReportItems(items, { campusId: q.campusId, categoryCodes, searchText: q.searchText, stillDangerous: q.stillDangerous === undefined ? undefined : q.stillDangerous === 'true', fromDate: q.fromDate, toDate: q.toDate });
    items = sortReportItemsDefault(items);
    const limit = q.limit ? Number(q.limit) : 50;
    const sliced = items.slice(0, limit);

    const ceiling = actorCeiling(actor);
    for (const it of sliced) {
      if (confidentialityRank(it.confidentiality) > confidentialityRank(ceiling)) {
        it.content = '';
        it.className = null;
        it.suggestedClassNames = [];
        it.redacted = true;
      }
      it.canViewEvidence = canViewEvidence(actor, { campus_id: it.campusId, confidentiality: it.confidentiality });
    }
    const evidenceMap = new Map<string, Awaited<ReturnType<typeof listEvidenceSummaryForReportIds>>>();
    const viewableIds = sliced.filter((it) => it.canViewEvidence).map((it) => it.reportId);
    if (viewableIds.length) {
      const rowsEv = await db.select().from(evidenceTable).where(and(inArray(evidenceTable.reportId, viewableIds), eq(evidenceTable.deleted, false)));
      for (const r of rowsEv) {
        if (!r.reportId) continue;
        const list = evidenceMap.get(r.reportId) || [];
        list.push({ evidenceId: r.evidenceId, fileType: r.fileType, sizeBytes: r.sizeBytes, scanStatus: r.scanStatus });
        evidenceMap.set(r.reportId, list);
      }
    }
    for (const it of sliced) {
      it.evidenceList = evidenceMap.get(it.reportId) || [];
    }

    res.json({ items: sliced, urgentCount });
  })
);

// Port từ `exports.listIncidents`.
safetyQueryRouter.get(
  '/incidents',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const q = req.query as Record<string, string | undefined>;
    const limit = q.limit ? Number(q.limit) : 50;

    // Lấy 1 lô RỘNG HƠN giới hạn hiển thị rồi mới lọc quyền — nếu lọc SAU khi
    // đã áp limit ở tầng truy vấn, 1 Phó HT có thể "mất" đúng hồ sơ cơ sở
    // mình chỉ vì không nằm trong N bản ghi mới nhất TOÀN TRƯỜNG.
    const rows = await db.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(Math.max(limit * 4, 1000));
    type IncidentRow = (typeof rows)[number];
    type VisibleItem = Partial<IncidentRow> & Pick<IncidentRow, 'incidentId' | 'priority' | 'confidentiality' | 'state' | 'campusId'> & { redacted?: boolean };
    const visible: VisibleItem[] = [];
    for (const incident of rows) {
      const decision = checkAuthorization({
        actor,
        action: VIEW_ACTION_BY_CONFIDENTIALITY[incident.confidentiality] || 'incident.view_c1_c2',
        resource: { campusId: incident.campusId, confidentiality: incident.confidentiality, commanderPerId: incident.commanderPerId ?? undefined, assignedTaskPerIds: incident.assignedTaskPerIds || [] }
      });
      if (!decision.allowed) continue;
      if (decision.conditions.includes('redacted')) {
        visible.push({ incidentId: incident.incidentId, priority: incident.priority, confidentiality: incident.confidentiality, state: incident.state, campusId: incident.campusId, redacted: true });
      } else {
        visible.push(incident);
      }
    }

    const categoryCodes = q.categoryCodes ? q.categoryCodes.split(',').filter(Boolean) : undefined;
    const priorities = q.priorities ? q.priorities.split(',').filter(Boolean) : undefined;
    const states = q.states ? q.states.split(',').filter(Boolean) : undefined;
    let out = filterIncidentItems(visible, {
      campusId: q.campusId,
      categoryCodes,
      priorities,
      states,
      searchText: q.searchText,
      onlyMinePerId: q.onlyMine === 'true' ? actor.perId : null,
      fromDate: q.fromDate,
      toDate: q.toDate
    });
    out = out.slice(0, limit);

    const ids = out.map((it) => it.incidentId).filter(Boolean);
    const clockMap: Record<string, Record<string, { deadlineAt: Date; status: string; paused: boolean }>> = {};
    if (ids.length > 0) {
      const clocks = await db.select().from(slaClocks).where(inArray(slaClocks.objectId, ids));
      for (const c of clocks) {
        clockMap[c.objectId] = clockMap[c.objectId] || {};
        clockMap[c.objectId]![c.clockLabel] = { deadlineAt: c.deadlineAt, status: c.status, paused: !!c.paused };
      }
    }
    const commanderPerIds = out.map((it) => it.commanderPerId).filter((v): v is string => !!v);
    const commanderNameMap = await getDisplayNamesByPerIds(db, commanderPerIds);

    res.json(
      out.map((it) => ({
        ...it,
        categoryLabel: it.categoryCode ? CATEGORY_CATALOG[it.categoryCode]?.label || it.categoryCode : null,
        slaClocks: clockMap[it.incidentId] || null,
        commanderName: it.commanderPerId ? (commanderNameMap[it.commanderPerId] ?? null) : null
      }))
    );
  })
);

// Port từ `exports.getIncident`.
safetyQueryRouter.get(
  '/incidents/:id',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const incidentId = String(req.params.id);
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId)).limit(1);
    if (!incident) throw new HttpError(404, 'Không tìm thấy hồ sơ ' + incidentId, 'NOT_FOUND');
    const decision = checkAuthorization({
      actor,
      action: VIEW_ACTION_BY_CONFIDENTIALITY[incident.confidentiality] || 'incident.view_c1_c2',
      resource: { campusId: incident.campusId, confidentiality: incident.confidentiality, commanderPerId: incident.commanderPerId ?? undefined, assignedTaskPerIds: incident.assignedTaskPerIds || [] }
    });
    if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');

    await db.insert(auditLogs).values({
      occurredAt: new Date(),
      actorPerId: actor.perId,
      action: incident.confidentiality === 'C3' ? 'incident.view_c3' : incident.confidentiality === 'C4' ? 'incident.view_c4' : 'incident.view',
      objectId: incident.incidentId
    });

    const isRedacted = decision.conditions.includes('redacted');
    const canView = canViewEvidence(actor, { campus_id: incident.campusId, confidentiality: incident.confidentiality, commander_per_id: incident.commanderPerId, assigned_task_per_ids: incident.assignedTaskPerIds || [] });
    const evidenceList = canView ? await listEvidenceSummaryForReportIds(incident.reportIds || []) : [];

    const clockRows = await db.select().from(slaClocks).where(eq(slaClocks.objectId, incident.incidentId));
    const slaClockMap: Record<string, { deadlineAt: Date; status: string; paused: boolean }> = {};
    for (const c of clockRows) slaClockMap[c.clockLabel] = { deadlineAt: c.deadlineAt, status: c.status, paused: !!c.paused };

    let commanderName: string | null = null;
    if (incident.commanderPerId) {
      const map = await getDisplayNamesByPerIds(db, [incident.commanderPerId]);
      commanderName = map[incident.commanderPerId] ?? null;
    }

    let homeroomConfigured: boolean | null = null;
    let gradeSupervisorConfigured: boolean | null = null;
    if (!isRedacted && incident.className) {
      const classRelated = await resolveClassRelatedPeople(db, incident.className);
      homeroomConfigured = !!classRelated.homeroomPerId;
      gradeSupervisorConfigured = !!classRelated.gradeSupervisorPerId;
    }

    const base = isRedacted
      ? { incidentId: incident.incidentId, priority: incident.priority, confidentiality: incident.confidentiality, state: incident.state, campusId: incident.campusId, redacted: true }
      : incident;

    res.json({
      ...base,
      canViewEvidence: canView,
      evidenceList,
      categoryLabel: isRedacted ? null : CATEGORY_CATALOG[incident.categoryCode]?.label || incident.categoryCode,
      slaClocks: slaClockMap,
      commanderName,
      homeroomConfigured,
      gradeSupervisorConfigured
    });
  })
);

// Port từ `exports.readAuditLog`.
safetyQueryRouter.get(
  '/audit-logs',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'audit.read', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');
    const objectId = typeof req.query.objectId === 'string' ? req.query.objectId : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const rows = objectId
      ? await db.select().from(auditLogs).where(eq(auditLogs.objectId, objectId)).orderBy(desc(auditLogs.occurredAt)).limit(limit)
      : await db.select().from(auditLogs).orderBy(desc(auditLogs.occurredAt)).limit(limit);
    res.json({ items: rows });
  })
);

// Port từ `exports.listNotifyRequestsForObject`.
safetyQueryRouter.get(
  '/notify-requests',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const objectId = req.query.objectId;
    if (!objectId) throw new HttpError(400, 'Thiếu objectId.', 'INVALID_INPUT');
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, String(objectId))).limit(1);
    if (incident) {
      const decision = checkAuthorization({
        actor,
        action: VIEW_ACTION_BY_CONFIDENTIALITY[incident.confidentiality] || 'incident.view_c1_c2',
        resource: { campusId: incident.campusId, confidentiality: incident.confidentiality, commanderPerId: incident.commanderPerId ?? undefined, assignedTaskPerIds: incident.assignedTaskPerIds || [] }
      });
      if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');
    } else if (!actor.roles || actor.roles.length === 0) {
      throw new HttpError(403, 'Tài khoản chưa được phân vai trò nào trong hệ thống.', 'PERMISSION_ERROR');
    }
    const items = await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, String(objectId))).orderBy(desc(notifyRequests.createdAt)).limit(50);
    const perIds: string[] = [];
    for (const it of items) {
      perIds.push(...it.recipients, ...it.ackBy);
      for (const log of (it.dispatchLog as Array<{ per_id?: string }>) || []) {
        if (log.per_id) perIds.push(log.per_id);
      }
    }
    const perNames = await getDisplayNamesByPerIds(db, perIds);
    res.json({ items, perNames });
  })
);

// Port từ `exports.listMyPendingAcks`.
safetyQueryRouter.get(
  '/notify-requests/mine/pending',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    if (!actor.perId) return res.json({ items: [] });
    const rows = await db
      .select()
      .from(notifyRequests)
      .where(and(eq(notifyRequests.status, 'pending')))
      .orderBy(desc(notifyRequests.createdAt))
      .limit(50);
    const items = rows.filter((r) => r.recipients.includes(actor.perId) && r.requireAck === true && !r.ackBy.includes(actor.perId)).slice(0, 20);
    res.json({ items });
  })
);

// Port từ `exports.acknowledgeNotifyRequest`.
safetyQueryRouter.post(
  '/notify-requests/:id/ack',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const notifyRequestId = String(req.params.id);
    const [record] = await db.select().from(notifyRequests).where(eq(notifyRequests.notifyRequestId, notifyRequestId)).limit(1);
    if (!record) throw new HttpError(404, 'Không tìm thấy yêu cầu thông báo ' + notifyRequestId, 'NOT_FOUND');
    if (!record.recipients.includes(actor.perId)) {
      throw new HttpError(403, 'Bạn không phải người nhận của thông báo này.', 'PERMISSION_ERROR');
    }
    const now = new Date();
    const updated = acknowledge(
      {
        object_id: record.objectId,
        event_type: record.eventType ?? null,
        urgency: record.urgency as never,
        channels: record.channels as never,
        simultaneous: record.simultaneous,
        message: record.message,
        recipients: record.recipients,
        require_ack: record.requireAck,
        status: record.status as never,
        attempts: record.attempts,
        dedupe_keys: record.dedupeKeys,
        ack_by: record.ackBy,
        created_at: record.createdAt
      },
      { perId: actor.perId, now }
    );
    await db.update(notifyRequests).set({ ackBy: updated.ack_by, status: updated.status, acknowledgedAt: updated.acknowledged_at }).where(eq(notifyRequests.notifyRequestId, notifyRequestId));
    await db.insert(auditLogs).values({ occurredAt: now, actorPerId: actor.perId, action: 'notify.acknowledged', objectId: record.objectId, after: { notifyRequestId } });
    res.json({ ok: true, notifyRequestId });
  })
);

// Port từ `exports.listAdminNotifications`.
safetyQueryRouter.get(
  '/notifications',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const rows = await db.select().from(adminNotifications).where(eq(adminNotifications.recipientPerId, actor.perId)).orderBy(desc(adminNotifications.createdAt)).limit(limit);
    const unreadCount = rows.filter((r) => !r.read).length;
    res.json({ items: rows, unreadCount });
  })
);

// Port từ `exports.markAdminNotificationRead`.
safetyQueryRouter.post(
  '/notifications/:id/read',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const notificationId = String(req.params.id);
    const [notification] = await db.select().from(adminNotifications).where(eq(adminNotifications.notificationId, notificationId)).limit(1);
    if (!notification) throw new HttpError(404, 'Không tìm thấy thông báo ' + notificationId, 'NOT_FOUND');
    if (notification.recipientPerId !== actor.perId) {
      throw new HttpError(403, 'Bạn không phải người nhận của thông báo này.', 'PERMISSION_ERROR');
    }
    const result = await markNotificationRead(db, { notificationId }, { now: new Date() });
    res.json(result);
  })
);

// Port từ `exports.registerPushToken`/`exports.unregisterPushToken`.
safetyQueryRouter.post(
  '/push-tokens',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const result = await registerPushToken(db, { perId: actor.perId, token: d.token, userAgent: d.userAgent }, { now: new Date() });
    res.json(result);
  })
);
safetyQueryRouter.delete(
  '/push-tokens',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const d = req.body || {};
    const result = await unregisterPushToken(db, { token: d.token });
    res.json(result);
  })
);

// `exports.searchPeople` -> route `/people/search` do Killshot làm ở K7
// (`safety-stats.routes.ts`, cùng nhánh port `people-search.ts`) — KHÔNG
// đăng ký lại ở đây để tránh 2 router cùng khai `/people/search` khi merge.
