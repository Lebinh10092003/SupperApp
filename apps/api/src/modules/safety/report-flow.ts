/**
 * report-flow.ts — Luồng 2 (tiếp nhận tin báo công khai) + Luồng 3 (tạo hồ
 * sơ + kích hoạt/phát cảnh báo P0/P1), port 1-1 từ `safety.js` (project An
 * toàn, Firebase). Cụm hàm do Hestia phụ trách (xem
 * SUPERAPP_MIGRATION_COORDINATION/TASKS.md).
 *
 * `db` truyền vào (dependency injection) — module không tự tạo kết nối.
 * `opts.dispatch`/`opts.pushBell`/`opts.notifyReporter` do tầng route
 * (index.js cũ) truyền vào, KHÔNG gọi trực tiếp dispatch.ts/adminNotify ở
 * đây — giữ đúng quy ước DI/test-được-bằng-mock của toàn bộ `safety.js`.
 */

import { eq } from 'drizzle-orm';
import * as catalog from './catalog.js';
import * as ids from './ids.js';
import * as authz from './authz.js';
import * as audit from './audit.js';
import * as sla from './sla.js';
import * as notify from './notify.js';
import * as escalationRecipients from './escalation-recipients.js';
import { linkEvidenceToReport } from './evidence.js';
import { detectClassNamesFromContent } from './classStats.js';
import { homeroomAssignments, gradeSupervisorAssignments } from '../identity/identity.schema.js';
import { reports, reportIdentities } from './reports.schema.js';
import { publicCodes } from './ids.schema.js';
import { incidents } from './incidents.schema.js';
import { slaClocks } from './sla-clocks.schema.js';
import { notifyRequests } from './dispatch.schema.js';
import { AppError, toJsDate, parseOptionalDate, withIdempotency, adminArrayUnion, slaClockToRow, notifyRequestToRow, type Db } from './shared.js';
import type { Actor } from './authz.js';

export interface DispatchHook {
  // Chữ ký lỏng deliberately: hàm THẬT (notify-hooks.ts) trả về dispatch
  // log/bản ghi đã tạo để tầng route/test có thể kiểm tra lại, nhưng
  // report-flow.ts/incident-lifecycle.ts không đọc giá trị trả về — chỉ
  // gọi `await opts.dispatch(...)` cho có thứ tự, không quan tâm kiểu trả.
  dispatch?: (db: Db, request: Record<string, unknown>, opts: { now: Date }) => Promise<unknown>;
  pushBell?: (db: Db, input: Record<string, unknown>, opts: { now: Date }) => Promise<unknown>;
  notifyReporter?: (db: Db, input: { reportId?: string; incidentId?: string; eventType: string }, opts: Record<string, unknown> & { now: Date }) => Promise<
    { reportId?: string; sent?: boolean; reason?: string } | Array<{ reportId?: string; sent?: boolean; reason?: string }> | void
  >;
}

export interface SafetyOpts extends DispatchHook {
  now?: Date;
  requestId?: string;
  calendar?: sla.Calendar;
  approvedBy?: string;
}

// ---------------------------------------------------------------------------
// Luồng 2 — Tiếp nhận tin báo từ cổng công khai
// ---------------------------------------------------------------------------

export interface SubmitReportInput {
  idempotencyKey?: string;
  campusId: string;
  categoryCode: string;
  email?: string;
  phone?: string;
  occurredFrom?: string | Date;
  occurredTo?: string | Date;
  stillDangerous?: boolean;
  requestedConfidentiality?: string;
  content?: string;
  className?: string;
  reporterRole?: string;
  channel?: string;
  createdByPerId?: string;
  contactName?: string;
  contactChannel?: string;
  safeContactTime?: string;
  evidenceIds?: string[];
}

/**
 * submitReport — KHÔNG yêu cầu đăng nhập (vùng công khai). KHÔNG gọi
 * `authz.checkAuthorization` (không có actor.session) — bảo vệ đầu vào
 * (App Check/reCAPTCHA...) làm ở tầng API Gateway, không phải ở đây.
 */
export async function submitReport(db: Db, input: SubmitReportInput, opts?: SafetyOpts) {
  const now = opts?.now ?? new Date();
  return withIdempotency(db, input.idempotencyKey, async () => {
    if (!input.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
    if (!input.categoryCode) throw new AppError('invalid_input', 'Thiếu categoryCode.');

    // Quyết định họp 07/09/2026: bỏ gửi ẩn danh hoàn toàn — người báo tin
    // PHẢI để lại ít nhất 1 kênh liên hệ (email hoặc SĐT).
    const submittedEmailValid = !!(input.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.email).trim()));
    const submittedPhoneValid = !!(input.phone && String(input.phone).trim().length >= 8);
    if (!submittedEmailValid && !submittedPhoneValid) {
      throw new AppError('invalid_input', 'Cần để lại ít nhất 1 email hoặc số điện thoại hợp lệ để chúng tôi liên hệ lại khi cần xác nhận.');
    }

    const occurredFrom = parseOptionalDate(input.occurredFrom, 'occurredFrom');
    const occurredTo = parseOptionalDate(input.occurredTo, 'occurredTo');
    if (occurredFrom && occurredTo && occurredFrom.getTime() > occurredTo.getTime()) {
      throw new AppError('invalid_input', 'Mốc bắt đầu phải trước hoặc bằng mốc kết thúc.');
    }

    const reportId = await ids.allocateSequentialId(db, catalog.ID_PREFIX.REPORT, { now });
    const publicCode = await ids.allocatePublicCode(db);

    const confidentiality = catalog.effectiveConfidentiality(input.categoryCode, input.requestedConfidentiality);

    await db.insert(reports).values({
      reportId,
      publicCode,
      channel: input.channel || 'public_web',
      campusId: input.campusId,
      categoryCode: input.categoryCode,
      occurredAt: now,
      occurredFrom,
      occurredTo,
      anonymous: false,
      stillDangerous: !!input.stillDangerous,
      confidentiality,
      content: input.content || '',
      className: input.className || null,
      reporterRole: catalog.isValidReporterRole(input.reporterRole) ? input.reporterRole : null,
      mergedIntoIncidentId: null,
      createdByPerId: input.createdByPerId || null,
      createdAt: now
    });

    if (input.email && !submittedEmailValid) {
      console.warn('submitReport: email không hợp lệ, bỏ qua:', input.email);
    }
    await db.insert(reportIdentities).values({
      reportId,
      contactName: input.contactName || null,
      contactChannel: input.contactChannel || null,
      safeContactTime: input.safeContactTime || null,
      email: submittedEmailValid ? String(input.email).trim().toLowerCase() : null,
      phone: input.phone ? String(input.phone).trim() : null
    });

    // Liên kết mã công khai <-> mã nội bộ CHỈ ở phía máy chủ.
    await db.insert(publicCodes).values({ code: publicCode, reportId, createdAt: now }).onConflictDoUpdate({
      target: publicCodes.code,
      set: { reportId, createdAt: now }
    });

    await audit.writeAuditLog(db, audit.buildAuditRecord({
      actorPerId: 'SYSTEM.PUBLIC_GATEWAY',
      action: 'safety.report.received',
      objectId: reportId,
      after: { campusId: input.campusId, categoryCode: input.categoryCode },
      requestId: opts?.requestId,
      now
    }));

    const initialPriority = input.stillDangerous
      ? catalog.PRIORITY.P0
      : catalog.suggestedPriorityForCategory(input.categoryCode);

    const linkedEvidenceIds = await linkEvidenceToReport(db, { evidenceIds: input.evidenceIds || [], reportId }, { now });

    const suggestedClassNames = detectClassNamesFromContent(input.content);
    await db.update(reports).set({ suggestedClassNames }).where(eq(reports.reportId, reportId));

    if (input.stillDangerous) {
      await notifyUrgentReport(db, { reportId, publicCode, campusId: input.campusId, categoryCode: input.categoryCode }, opts)
        .catch((e) => console.error('[submitReport] notifyUrgentReport thất bại, KHÔNG chặn gửi tin báo:', e instanceof Error ? e.message : e));
    }

    return { reportId, publicCode, confidentiality, initialPriority, linkedEvidenceIds, suggestedClassNames };
  });
}

// ---------------------------------------------------------------------------
// Liên thông lớp <-> GVCN + giáo viên phụ trách KHỐI — dùng chung bởi
// createIncidentFromReport và updateIncidentClassification (phần Killshot).
// ---------------------------------------------------------------------------
export async function resolveClassRelatedPeople(db: Db, className: string | null | undefined) {
  let homeroomPerId: string | null = null;
  let gradeSupervisorPerId: string | null = null;
  if (className) {
    const [hr] = await db.select().from(homeroomAssignments).where(eq(homeroomAssignments.className, String(className))).limit(1);
    if (hr?.perId) homeroomPerId = hr.perId;

    const grade = catalog.extractGradeFromClassName(className);
    if (grade) {
      const [gs] = await db.select().from(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, grade)).limit(1);
      if (gs?.perId) gradeSupervisorPerId = gs.perId;
    }
  }
  return { homeroomPerId, gradeSupervisorPerId };
}

/** Dừng leo thang cho tin báo "còn nguy hiểm" ngay khi hồ sơ đã được tạo — không throw nếu không có notify_request nào để dừng. */
export async function resolveUrgentReportNotify(db: Db, reportId: string, now: Date) {
  const rows = await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, reportId));
  const targets = rows.filter((r) => r.eventType === 'safety.report.urgent_notified' && r.status === 'pending');
  await Promise.all(targets.map((r) =>
    db.update(notifyRequests).set({ status: 'resolved' }).where(eq(notifyRequests.notifyRequestId, r.notifyRequestId))
  ));
  void now; // giữ tham số để khớp chữ ký gốc, chưa cần dùng (bản gốc cũng không dùng `now` trong thân hàm)
}

// ---------------------------------------------------------------------------
// Tạo/gộp hồ sơ sự cố từ tin báo
// ---------------------------------------------------------------------------
export interface CreateIncidentFromReportInput {
  reportId: string;
  // Bắt buộc ở nhánh tạo MỚI, bỏ qua ở nhánh gộp (mergeIntoIncidentId) —
  // hồ sơ đích đã có priority riêng, không đổi khi gộp thêm 1 tin báo vào.
  priority?: catalog.Priority;
  mergeIntoIncidentId?: string;
  className?: string;
}

export async function createIncidentFromReport(db: Db, input: CreateIncidentFromReportInput, opts?: SafetyOpts) {
  const now = opts?.now ?? new Date();
  const [report] = await db.select().from(reports).where(eq(reports.reportId, input.reportId)).limit(1);
  if (!report) throw new AppError('not_found', 'Không tìm thấy tin báo ' + input.reportId);

  if (input.mergeIntoIncidentId) {
    const [incident] = await db.select().from(incidents).where(eq(incidents.incidentId, input.mergeIntoIncidentId)).limit(1);
    if (!incident) throw new AppError('not_found', 'Không tìm thấy hồ sơ ' + input.mergeIntoIncidentId);
    await db.update(incidents).set({ reportIds: adminArrayUnion(incident.reportIds, input.reportId) }).where(eq(incidents.incidentId, input.mergeIntoIncidentId));
    await db.update(reports).set({ mergedIntoIncidentId: input.mergeIntoIncidentId }).where(eq(reports.reportId, input.reportId));
    await resolveUrgentReportNotify(db, input.reportId, now);
    await audit.writeAuditLog(db, audit.buildAuditRecord({
      actorPerId: 'SYSTEM.SAFETY', action: 'safety.report.merged', objectId: input.mergeIntoIncidentId,
      after: { reportId: input.reportId }, now
    }));
    return { incidentId: input.mergeIntoIncidentId, merged: true };
  }

  if (!input.priority) throw new AppError('invalid_input', 'Thiếu priority khi tạo hồ sơ mới (chỉ nhánh gộp mới được bỏ qua).');
  const priority = input.priority;

  const incidentId = await ids.allocateSequentialId(db, catalog.ID_PREFIX.INCIDENT, { now });
  const confidentiality = catalog.effectiveConfidentiality(report.categoryCode, report.confidentiality);
  const state = priority === catalog.PRIORITY.P0 ? catalog.STATE.EMERGENCY : catalog.STATE.NEW;

  const effectiveClassName = input.className !== undefined ? (input.className || null) : (report.className || null);
  const { homeroomPerId, gradeSupervisorPerId } = await resolveClassRelatedPeople(db, effectiveClassName);
  const classRelatedPerIds = Array.from(new Set([homeroomPerId, gradeSupervisorPerId].filter((v): v is string => !!v)));
  const assignedTaskPerIds = classRelatedPerIds;

  await db.insert(incidents).values({
    incidentId,
    campusId: report.campusId,
    categoryCode: report.categoryCode,
    className: effectiveClassName,
    suggestedClassNames: report.suggestedClassNames || [],
    reporterRole: report.reporterRole || null,
    priority,
    confidentiality,
    state,
    reportIds: [input.reportId],
    commanderPerId: null,
    assignedTaskPerIds,
    version: 1,
    createdAt: now,
    updatedAt: now
  });
  await db.update(reports).set({ mergedIntoIncidentId: incidentId }).where(eq(reports.reportId, input.reportId));
  await resolveUrgentReportNotify(db, input.reportId, now);

  await audit.writeAuditLog(db, audit.buildAuditRecord({
    actorPerId: 'SYSTEM.SAFETY', action: 'safety.incident.created', objectId: incidentId,
    after: { priority, campus_id: report.campusId, category_code: report.categoryCode, class_name: effectiveClassName }, now
  }));

  // Đăng ký CẢ HAI đồng hồ S10: ack + assign.
  const ackClock = sla.registerSlaClock({ objectId: incidentId, clockLabel: 'ack', priority, startAt: now, calendar: opts?.calendar });
  await db.insert(slaClocks).values(slaClockToRow(ackClock));
  const assignClock = sla.registerSlaClock({ objectId: incidentId, clockLabel: 'assign', priority, startAt: now, calendar: opts?.calendar });
  await db.insert(slaClocks).values(slaClockToRow(assignClock));

  if (priority === catalog.PRIORITY.P0) {
    await activateP0(db, { incidentId, campusId: report.campusId, categoryCode: report.categoryCode, extraRecipients: classRelatedPerIds }, opts);
  } else {
    if (priority === catalog.PRIORITY.P1) {
      await notifyP1Escalation(db, { incidentId, campusId: report.campusId, categoryCode: report.categoryCode }, opts);
    }
    if (classRelatedPerIds.length > 0) {
      const request = notify.buildNotifyRequest({
        recipients: classRelatedPerIds,
        priority,
        objectId: incidentId,
        objectCode: incidentId,
        levelLabel: catalog.PRIORITY_LABEL[priority],
        actionNeeded: 'Có sự việc liên quan đến lớp/khối bạn phụ trách — xem và phối hợp xử lý',
        deepLink: '/app/incidents/' + incidentId,
        eventType: 'safety.incident.homeroom_notified'
      });
      const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
      if (opts?.dispatch && savedRequest) await opts.dispatch(db, savedRequest, { now });
      if (opts?.pushBell) {
        await opts.pushBell(db, {
          recipients: classRelatedPerIds,
          title: 'Sự việc mới liên quan lớp/khối bạn phụ trách',
          message: request.message,
          eventType: 'safety.incident.homeroom_notified',
          objectId: incidentId,
          actorPerId: 'SYSTEM.SAFETY',
          meta: { class_name: effectiveClassName, homeroom_per_id: homeroomPerId, grade_supervisor_per_id: gradeSupervisorPerId }
        }, { now });
      }
      await audit.writeAuditLog(db, audit.buildAuditRecord({
        actorPerId: 'SYSTEM.SAFETY', action: 'safety.incident.homeroom_notified', objectId: incidentId,
        after: { homeroom_per_id: homeroomPerId, grade_supervisor_per_id: gradeSupervisorPerId, class_name: effectiveClassName }, now
      }));
    }
  }

  // Email TỰ ĐỘNG cho người báo tin — CHỈ nhánh tạo hồ sơ MỚI.
  await notifyReporterAndAudit(db, opts, { reportId: input.reportId, eventType: 'reporter.notified.received' }, now);

  return { incidentId, merged: false, homeroomPerId, gradeSupervisorPerId };
}

/**
 * Email TỰ ĐỘNG cho người báo tin — TÁCH BIỆT hoàn toàn khỏi opts.dispatch/
 * opts.pushBell (2 hook đó gửi cho NHÂN VIÊN nội bộ theo perId; hook này
 * gửi cho NGƯỜI BÁO TIN theo email tự khai). Chỉ ghi 1 dòng audit tối thiểu
 * cho mỗi report được thử gửi (KHÔNG ghi email vào audit log).
 */
export async function notifyReporterAndAudit(
  db: Db,
  opts: SafetyOpts | undefined,
  input: { reportId?: string; incidentId?: string; eventType: string },
  now: Date
) {
  if (!opts?.notifyReporter) return;
  const result = await opts.notifyReporter(db, input, { ...opts, now });
  const results = Array.isArray(result) ? result : (result ? [result] : []);
  for (const r of results) {
    const objectId = r.reportId || input.reportId || input.incidentId;
    if (!objectId) continue;
    await audit.writeAuditLog(db, audit.buildAuditRecord({
      actorPerId: 'SYSTEM.SAFETY', action: 'safety.report.reporter_notified', objectId,
      after: { event_type: input.eventType, sent: !!r.sent, reason: r.reason ?? null }, now
    }));
  }
}

// ---------------------------------------------------------------------------
// Luồng 3 — Kích hoạt và phát cảnh báo P0
// ---------------------------------------------------------------------------
export async function activateP0(
  db: Db,
  input: { incidentId: string; campusId: string; categoryCode?: string; extraRecipients?: string[] },
  opts?: SafetyOpts
) {
  const now = opts?.now ?? new Date();
  const { leadershipPerIds, onDutyPerIds } = await escalationRecipients.getEscalationRecipients(db, { campusId: input.campusId }, { now });
  const coreRecipients = Array.from(new Set([...onDutyPerIds, ...leadershipPerIds]));

  if (coreRecipients.length === 0) {
    throw new AppError('no_recipients', `Không xác định được người trực/lãnh đạo để phát cảnh báo P0 tại cơ sở ${input.campusId} — KHÔNG được để trống, phải có ca trực hợp lệ.`);
  }
  const recipients = Array.from(new Set([...coreRecipients, ...(input.extraRecipients ?? [])]));

  const request = notify.buildNotifyRequest({
    recipients,
    priority: catalog.PRIORITY.P0,
    objectId: input.incidentId,
    objectCode: input.incidentId,
    levelLabel: catalog.PRIORITY_LABEL.P0,
    actionNeeded: 'Xác nhận đã nhận và tới hiện trường',
    deepLink: '/app/incidents/' + input.incidentId,
    eventType: 'safety.incident.p0_activated'
  });
  const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
  // Đường P0 KHÔNG được chờ — gửi thật ngay, không phụ thuộc bước duyệt nào khác.
  if (opts?.dispatch && savedRequest) await opts.dispatch(db, savedRequest, { now });

  await db.update(incidents).set({ state: catalog.STATE.EMERGENCY, priority: catalog.PRIORITY.P0, updatedAt: now }).where(eq(incidents.incidentId, input.incidentId));

  await audit.writeAuditLog(db, audit.buildAuditRecord({
    actorPerId: 'SYSTEM.SAFETY', action: 'safety.incident.p0_activated', objectId: input.incidentId,
    after: { recipients }, now
  }));

  return { notifyRequestId: savedRequest?.notifyRequestId, recipients };
}

/** P1 — cùng diện người nhận như P0, NHƯNG KHÔNG bắt buộc phải có người nhận (chỉ ghi audit cảnh báo, không throw). */
export async function notifyP1Escalation(
  db: Db,
  input: { incidentId: string; campusId: string; categoryCode?: string; extraRecipients?: string[] },
  opts?: SafetyOpts
) {
  const now = opts?.now ?? new Date();
  const { leadershipPerIds, onDutyPerIds } = await escalationRecipients.getEscalationRecipients(db, { campusId: input.campusId }, { now });
  const recipients = Array.from(new Set([...leadershipPerIds, ...onDutyPerIds, ...(input.extraRecipients ?? [])]));

  if (recipients.length === 0) {
    await audit.writeAuditLog(db, audit.buildAuditRecord({
      actorPerId: 'SYSTEM.SAFETY', action: 'safety.incident.p1_no_recipients', objectId: input.incidentId,
      after: { campusId: input.campusId }, now
    }));
    return { notified: false as const };
  }

  const request = notify.buildNotifyRequest({
    recipients,
    priority: catalog.PRIORITY.P1,
    objectId: input.incidentId,
    objectCode: input.incidentId,
    levelLabel: catalog.PRIORITY_LABEL.P1,
    actionNeeded: 'Sự việc mức P1 vừa được ghi nhận — xem và phối hợp xử lý/giám sát',
    deepLink: '/app/incidents/' + input.incidentId,
    eventType: 'safety.incident.p1_escalation_notified'
  });
  const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
  if (opts?.dispatch && savedRequest) await opts.dispatch(db, savedRequest, { now });
  if (opts?.pushBell) {
    await opts.pushBell(db, {
      recipients,
      title: 'Sự việc mức P1 mới được ghi nhận',
      message: request.message,
      eventType: 'safety.incident.p1_escalation_notified',
      objectId: input.incidentId,
      actorPerId: 'SYSTEM.SAFETY',
      meta: { campus_id: input.campusId, category_code: input.categoryCode ?? null }
    }, { now });
  }

  await audit.writeAuditLog(db, audit.buildAuditRecord({
    actorPerId: 'SYSTEM.SAFETY', action: 'safety.incident.p1_escalation_notified', objectId: input.incidentId,
    after: { recipients }, now
  }));

  return { notifyRequestId: savedRequest?.notifyRequestId, recipients, notified: true as const };
}

/**
 * Tin báo "còn nguy hiểm ngay lúc này" chưa được ai tạo hồ sơ — báo NGAY
 * cho trực ban/lãnh đạo bằng CHÍNH cơ chế notify_request/dispatch/pushBell
 * dùng cho P0/P1, `object_id` là `reportId` (mã TB.) thay vì `incidentId`.
 */
export async function notifyUrgentReport(
  db: Db,
  input: { reportId: string; publicCode?: string; campusId: string; categoryCode?: string },
  opts?: SafetyOpts
) {
  const now = opts?.now ?? new Date();
  const { leadershipPerIds, onDutyPerIds } = await escalationRecipients.getEscalationRecipients(db, { campusId: input.campusId }, { now });
  const recipients = Array.from(new Set([...leadershipPerIds, ...onDutyPerIds]));

  if (recipients.length === 0) {
    await audit.writeAuditLog(db, audit.buildAuditRecord({
      actorPerId: 'SYSTEM.SAFETY', action: 'safety.report.urgent_no_recipients', objectId: input.reportId,
      after: { campusId: input.campusId }, now
    }));
    return { notified: false as const };
  }

  // KHÔNG dùng objectCode = publicCode: nội dung thông báo gửi cho NHÂN
  // VIÊN nội bộ phải dùng mã NỘI BỘ (reportId).
  const request = notify.buildNotifyRequest({
    recipients,
    priority: catalog.PRIORITY.P0,
    objectId: input.reportId,
    objectCode: input.reportId,
    levelLabel: 'Tin báo khẩn — còn nguy hiểm, CHƯA có hồ sơ',
    actionNeeded: 'Xem tin báo và tạo hồ sơ xử lý ngay nếu cần',
    deepLink: '/app/reports/' + input.reportId,
    eventType: 'safety.report.urgent_notified'
  });
  const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
  if (opts?.dispatch && savedRequest) await opts.dispatch(db, savedRequest, { now });
  if (opts?.pushBell) {
    await opts.pushBell(db, {
      recipients,
      title: 'Tin báo khẩn vừa gửi — còn nguy hiểm ngay lúc này',
      message: request.message,
      eventType: 'safety.report.urgent_notified',
      objectId: input.reportId,
      actorPerId: 'SYSTEM.SAFETY',
      meta: { campus_id: input.campusId, category_code: input.categoryCode ?? null }
    }, { now });
  }

  await audit.writeAuditLog(db, audit.buildAuditRecord({
    actorPerId: 'SYSTEM.SAFETY', action: 'safety.report.urgent_notified', objectId: input.reportId,
    after: { recipients }, now
  }));

  return { notifyRequestId: savedRequest?.notifyRequestId, recipients, notified: true as const };
}

// Giữ tham chiếu type Actor để các hàm export ở trên có thể mở rộng chữ ký
// (VD nếu sau này cần truyền actor cho audit) mà không phải sửa import.
export type { Actor };
export { toJsDate };
