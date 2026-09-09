/**
 * incident-lifecycle.ts — cụm "state machine hồ sơ ĐÃ TẠO" của `safety.js`
 * gốc (1147 dòng): changeIncidentPriority, transitionIncidentStatus,
 * confirmIncidentCloseByReporter, reopenIncident, assignCommander,
 * updateIncidentClassification. Tách RIÊNG khỏi cụm "tiếp nhận tin báo/tạo
 * hồ sơ" (submitReport, createIncidentFromReport, activateP0,
 * notifyP1Escalation, notifyUrgentReport, resolveClassRelatedPeople,
 * notifyReporterAndAudit — do Hestia viết, dự kiến `safety.ts`) để 2 người
 * code song song không đụng cùng 1 file — gộp lại (re-export hoặc merge
 * file) khi cả 2 xong, tuỳ Hestia quyết định lúc review.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/safety.js
 * (dòng 683-1147: changeIncidentPriority tới hết file).
 */

import { eq } from 'drizzle-orm';
import * as catalog from './catalog.js';
import { checkAuthorization, type Actor } from './authz.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import * as sla from './sla.js';
import { slaClocks } from './sla-clocks.schema.js';
import * as notify from './notify.js';
import { notifyRequests } from './dispatch.schema.js';
import { AppError, toJsDate, adminArrayUnion, slaClockToRow, notifyRequestToRow, type Db } from './shared.js';
import { incidents } from './incidents.schema.js';
import { reports } from './reports.schema.js';
import { activateP0, notifyP1Escalation, notifyReporterAndAudit, resolveClassRelatedPeople, type SafetyOpts as ReportFlowOpts } from './report-flow.js';

/**
 * `opts` dùng chung cho mọi hàm trong file này — mở rộng `SafetyOpts` của
 * report-flow.ts (dùng CHUNG 1 định nghĩa `dispatch`/`pushBell`/
 * `notifyReporter` cho cả 2 cụm hàm, tránh lệch type khi gọi chéo), chỉ
 * thêm `extraRecipients` (riêng cho assignCommander — bản gốc
 * `safety.js::assignCommander` nhận field này qua opts, report-flow.ts
 * không cần nên không khai báo).
 */
export interface SafetyOpts extends ReportFlowOpts {
  extraRecipients?: string[];
}

async function loadIncident(db: Db, incidentId: string) {
  const [row] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId)).limit(1);
  if (!row) throw new AppError('not_found', 'Không tìm thấy hồ sơ ' + incidentId);
  return row;
}

type StoredPauseEntry = { from: string; to: string | null; reason: string; approved_by: string };

/** Đọc + chuyển 1 đồng hồ SLA (bảng slaClocks, composite PK) sang shape `sla.SlaClock` (snake_case, thuần logic). `pause_history` lưu jsonb dạng chuỗi ISO — chuyển sang `Date` khi đọc, ngược lại khi ghi. */
async function loadSlaClock(db: Db, objectId: string, clockLabel: 'ack' | 'assign'): Promise<sla.SlaClock | null> {
  const rows = await db.select().from(slaClocks).where(eq(slaClocks.objectId, objectId));
  const match = rows.find((r) => r.clockLabel === clockLabel);
  if (!match) return null;
  const storedHistory = (match.pauseHistory as StoredPauseEntry[]) || [];
  return {
    object_id: match.objectId,
    clock_label: match.clockLabel as 'ack' | 'assign',
    priority: match.priority as catalog.Priority,
    start_at: match.startAt,
    deadline_at: match.deadlineAt,
    status: match.status as sla.SlaClockStatus,
    paused: match.paused,
    pause_history: storedHistory.map((h) => ({ from: new Date(h.from), to: h.to ? new Date(h.to) : null, reason: h.reason, approved_by: h.approved_by }))
  };
}

/** Ghi lại SLA clock đã tính lại (đúng cách Hestia dùng ở report-flow.ts — `slaClockToRow` chuyển snake_case thuần logic sang cột Drizzle). */
async function saveSlaClock(db: Db, clock: sla.SlaClock) {
  const row = slaClockToRow(clock);
  await db
    .update(slaClocks)
    .set({ priority: row.priority, startAt: row.startAt, deadlineAt: row.deadlineAt, status: row.status, paused: row.paused, pauseHistory: row.pauseHistory })
    .where(eq(slaClocks.objectId, clock.object_id));
}

// ---------------------------------------------------------------------------
// Chuyển mức ưu tiên hồ sơ.
// ---------------------------------------------------------------------------

export async function changeIncidentPriority(
  db: Db,
  input: { actor: Actor; incidentId: string; toPriority: string; reason?: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; priority: string }> {
  const now = opts?.now || new Date();
  const incident = await loadIncident(db, input.incidentId);

  const escalating = catalog.isEscalation(incident.priority, input.toPriority);
  const action = escalating ? 'incident.raise_priority' : 'incident.lower_priority';

  const decision = checkAuthorization({
    actor: input.actor,
    action,
    resource: { campusId: incident.campusId, confidentiality: incident.confidentiality }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_reason') && !input.reason) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi ' + (escalating ? 'nâng' : 'hạ') + ' mức ưu tiên.');
  }
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  // Tính lại CẢ HAI đồng hồ (ack + assign) theo đúng quy tắc "không mất thời hạn".
  for (const label of ['ack', 'assign'] as const) {
    const clock = await loadSlaClock(db, input.incidentId, label);
    if (clock) {
      const newClock = sla.recomputeOnPriorityChange(clock, { toPriority: input.toPriority as catalog.Priority, calendar: opts?.calendar });
      await saveSlaClock(db, newClock);
    }
  }

  await db.update(incidents).set({ priority: input.toPriority, version: incident.version + 1, updatedAt: now }).where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      roleUsed: action,
      action: 'incident.priority_changed',
      objectId: input.incidentId,
      before: { priority: incident.priority },
      after: { priority: input.toPriority },
      reason: input.reason,
      now
    })
  );

  if (input.toPriority === catalog.PRIORITY.P0 && incident.priority !== catalog.PRIORITY.P0) {
    await activateP0(db, { incidentId: input.incidentId, campusId: incident.campusId, categoryCode: incident.categoryCode }, opts);
  }
  if (input.toPriority === catalog.PRIORITY.P1 && incident.priority !== catalog.PRIORITY.P1) {
    await notifyP1Escalation(db, { incidentId: input.incidentId, campusId: incident.campusId, categoryCode: incident.categoryCode }, opts);
  }

  if (opts?.pushBell) {
    const bellRecipients = Array.from(
      new Set([input.actor.perId, incident.commanderPerId || null, ...(Array.isArray(incident.assignedTaskPerIds) ? incident.assignedTaskPerIds : [])].filter(Boolean) as string[])
    );
    await opts.pushBell(
      db,
      {
        recipients: bellRecipients,
        title: 'Đã đổi mức ưu tiên hồ sơ ' + input.incidentId,
        message: input.incidentId + ': ' + incident.priority + ' → ' + input.toPriority + ' — ' + input.actor.perId + ' vừa cập nhật.',
        eventType: 'safety.incident.priority_changed',
        objectId: input.incidentId,
        actorPerId: input.actor.perId,
        meta: { from_priority: incident.priority, to_priority: input.toPriority, reason: input.reason || null }
      },
      { now }
    );
  }

  return { incidentId: input.incidentId, priority: input.toPriority };
}

// ---------------------------------------------------------------------------
// Chuyển trạng thái thông thường (không gồm đóng/mở lại).
// ---------------------------------------------------------------------------

export async function transitionIncidentStatus(
  db: Db,
  input: { actor: Actor; incidentId: string; toState: string; note?: string; reason?: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; state: string }> {
  const now = opts?.now || new Date();
  const incident = await loadIncident(db, input.incidentId);

  if (catalog.isTerminal(incident.state as catalog.IncidentState)) {
    throw new AppError('terminal_state', 'Hồ sơ đã ở trạng thái kết thúc (' + incident.state + '), không thể chuyển trực tiếp — dùng chức năng Mở lại nếu cần.');
  }
  if (!catalog.canTransition(incident.state as catalog.IncidentState, input.toState as catalog.IncidentState)) {
    throw new AppError('invalid_transition', 'Không thể chuyển từ "' + incident.state + '" sang "' + input.toState + '".');
  }

  const isClosing = input.toState === catalog.STATE.CLOSED;
  const isRequestingClose = input.toState === catalog.STATE.CLOSE_REQUESTED;
  const action = isClosing ? (catalog.closeRequiresPrincipalApproval(incident.priority as catalog.Priority) ? 'incident.close_p0_p1' : 'incident.close_p2_p3') : 'incident.manage';

  const decision = checkAuthorization({
    actor: input.actor,
    action,
    resource: {
      campusId: incident.campusId,
      confidentiality: incident.confidentiality,
      commanderPerId: incident.commanderPerId ?? undefined,
      assignedTaskPerIds: incident.assignedTaskPerIds || []
    }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);

  // Quyết định họp 07/09/2026: đóng hồ sơ (mọi mức ưu tiên) không còn qua
  // phê duyệt nội bộ — thay bằng xác nhận của CHÍNH người gửi tin báo (xem
  // confirmIncidentCloseByReporter). Nhân viên có quyền vẫn có thể tự đóng,
  // NHƯNG CHỈ SAU KHI đã đủ REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS kể từ lúc
  // chuyển "Đề nghị đóng" mà người báo tin không phản hồi.
  if (isClosing) {
    const requestedAt = incident.closeRequestedAt ? toJsDate(incident.closeRequestedAt) : null;
    const fallbackMs = catalog.REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS * 24 * 60 * 60 * 1000;
    const elapsedOk = requestedAt && now.getTime() - requestedAt.getTime() >= fallbackMs;
    if (!elapsedOk) {
      const daysLeft = requestedAt
        ? Math.max(1, Math.ceil((fallbackMs - (now.getTime() - requestedAt.getTime())) / (24 * 60 * 60 * 1000)))
        : catalog.REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS;
      throw new AppError('reporter_confirmation_pending', 'Cần người gửi tin báo xác nhận đã xử lý xong mới đóng được hồ sơ — hoặc đợi thêm ' + daysLeft + ' ngày nữa để tự đóng.');
    }
  }

  const update: Partial<typeof incidents.$inferInsert> = { state: input.toState, version: incident.version + 1, updatedAt: now };
  if (input.note) update.lastNote = input.note;
  if (isRequestingClose) update.closeRequestedAt = now;
  if (isClosing) {
    update.closedBy = input.actor.perId;
    update.closedAt = now;
  }
  await db.update(incidents).set(update).where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: isClosing ? 'incident.close' : 'incident.state_changed',
      objectId: input.incidentId,
      before: { state: incident.state },
      after: { state: input.toState },
      reason: input.reason || input.note,
      now
    })
  );

  // "Đề nghị đóng" -> mời NGƯỜI GỬI TIN xác nhận (thay hẳn bước Hiệu
  // trưởng phê duyệt cũ). Đóng hồ sơ (nhân viên tự đóng sau khi hết hạn
  // chờ) vẫn báo "đã xử lý xong" như cũ.
  if (isRequestingClose) {
    await notifyReporterAndAudit(db, opts, { incidentId: input.incidentId, eventType: 'reporter.confirm_close_requested' }, now);
  }
  if (isClosing) {
    await notifyReporterAndAudit(db, opts, { incidentId: input.incidentId, eventType: 'reporter.notified.closed' }, now);
  }

  return { incidentId: input.incidentId, state: input.toState };
}

// ---------------------------------------------------------------------------
// Người GỬI TIN BÁO xác nhận đã xử lý xong -> đóng hồ sơ NGAY, không qua
// authz nội bộ (không phải actor nội bộ).
// ---------------------------------------------------------------------------

export async function confirmIncidentCloseByReporter(db: Db, input: { reportId: string }, opts?: SafetyOpts): Promise<{ incidentId: string; state: string }> {
  const now = opts?.now || new Date();
  if (!input.reportId) throw new AppError('invalid_input', 'Thiếu mã tin báo.');
  const [report] = await db.select().from(reports).where(eq(reports.reportId, input.reportId)).limit(1);
  if (!report) throw new AppError('not_found', 'Không tìm thấy tin báo.');
  const incidentId = report.mergedIntoIncidentId;
  if (!incidentId) throw new AppError('not_found', 'Tin báo chưa được gộp vào hồ sơ nào để xác nhận đóng.');

  const incident = await loadIncident(db, incidentId);
  if (incident.state !== catalog.STATE.CLOSE_REQUESTED) {
    throw new AppError('invalid_transition', 'Hồ sơ hiện không ở trạng thái chờ xác nhận đóng.');
  }

  await db
    .update(incidents)
    .set({
      state: catalog.STATE.CLOSED,
      reporterCloseConfirmedAt: now,
      closedBy: 'REPORTER',
      closedAt: now,
      version: incident.version + 1,
      updatedAt: now
    })
    .where(eq(incidents.incidentId, incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: 'SYSTEM.REPORTER_CONFIRM',
      action: 'incident.close_confirmed_by_reporter',
      objectId: incidentId,
      before: { state: catalog.STATE.CLOSE_REQUESTED },
      after: { state: catalog.STATE.CLOSED },
      reason: 'Người gửi tin báo ' + input.reportId + ' xác nhận đã xử lý xong.',
      now
    })
  );

  return { incidentId, state: catalog.STATE.CLOSED };
}

// ---------------------------------------------------------------------------
// Mở lại hồ sơ đã đóng — chỉ Hiệu trưởng (XR) hoặc Phó HT có phê duyệt (D).
// ---------------------------------------------------------------------------

export async function reopenIncident(db: Db, input: { actor: Actor; incidentId: string; reason?: string }, opts?: SafetyOpts): Promise<{ incidentId: string; state: string }> {
  const now = opts?.now || new Date();
  if (!input.reason || !input.reason.trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi mở lại hồ sơ.');
  }
  const incident = await loadIncident(db, input.incidentId);
  if (incident.state !== catalog.STATE.CLOSED) {
    throw new AppError('invalid_transition', 'Chỉ có thể mở lại hồ sơ đang ở trạng thái "Đã đóng".');
  }

  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.reopen',
    resource: { campusId: incident.campusId, confidentiality: incident.confidentiality }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Phó Hiệu trưởng cần phê duyệt của Hiệu trưởng để mở lại hồ sơ.');
  }

  await db
    .update(incidents)
    .set({ state: catalog.STATE.REOPENED, version: incident.version + 1, updatedAt: now, reopenedBy: input.actor.perId, reopenedAt: now, reopenReason: input.reason })
    .where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: 'incident.reopen',
      objectId: input.incidentId,
      before: { state: catalog.STATE.CLOSED },
      after: { state: catalog.STATE.REOPENED },
      reason: input.reason,
      now
    })
  );

  return { incidentId: input.incidentId, state: catalog.STATE.REOPENED };
}

// ---------------------------------------------------------------------------
// Chỉ định / thay người chỉ huy sự cố.
// ---------------------------------------------------------------------------

export async function assignCommander(
  db: Db,
  input: { actor: Actor; incidentId: string; commanderPerId: string; reason?: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; commanderPerId: string; previousCommanderPerId: string | null }> {
  const now = opts?.now || new Date();
  if (!input.commanderPerId) throw new AppError('invalid_input', 'Thiếu người được chỉ định làm chỉ huy vụ việc.');
  const incident = await loadIncident(db, input.incidentId);

  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.assign_commander',
    resource: { campusId: incident.campusId, confidentiality: incident.confidentiality }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_reason') && !input.reason) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi chỉ định/thay người chỉ huy sự cố.');
  }
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  const previousCommanderPerId = incident.commanderPerId || null;
  // Người chỉ huy MỚI mặc nhiên được thêm vào assignedTaskPerIds nếu chưa
  // có — để được xem TOÀN BỘ nội dung hồ sơ qua quyền quan hệ "là người chỉ
  // huy vụ việc" (bypassCeiling, xem authz.ts relationalGrant).
  const assignedTaskPerIds = adminArrayUnion(incident.assignedTaskPerIds, input.commanderPerId);

  await db
    .update(incidents)
    .set({ commanderPerId: input.commanderPerId, assignedTaskPerIds, version: incident.version + 1, updatedAt: now })
    .where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: 'incident.reassign_commander',
      objectId: input.incidentId,
      before: { commander_per_id: previousCommanderPerId },
      after: { commander_per_id: input.commanderPerId },
      reason: input.reason,
      now
    })
  );

  // Báo NGAY cho người chỉ huy mới — dùng đúng mức khẩn hiện tại của hồ sơ.
  const request = notify.buildNotifyRequest({
    recipients: [input.commanderPerId],
    priority: incident.priority,
    objectId: input.incidentId,
    objectCode: input.incidentId,
    levelLabel: catalog.PRIORITY_LABEL[incident.priority as catalog.Priority],
    actionNeeded: 'Bạn được chỉ định làm người chỉ huy xử lý sự việc này — vào xem và tiếp nhận ngay',
    deepLink: '/app/incidents/' + input.incidentId,
    eventType: 'safety.incident.commander_assigned'
  });
  const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
  if (opts?.dispatch && savedRequest) {
    await opts.dispatch(db, savedRequest, { now });
  }

  // Chuông thông báo — tới (1) chính actor, (2) chỉ huy CŨ (nếu có), (3)
  // chỉ huy MỚI, (4) Phó HT phụ trách cơ sở (index.js tự tra, truyền qua
  // opts.extraRecipients — module này KHÔNG tự query).
  if (opts?.pushBell) {
    const bellRecipients = Array.from(new Set([input.actor.perId, previousCommanderPerId, input.commanderPerId, ...(opts.extraRecipients || [])].filter(Boolean) as string[]));
    const commanderLabel = previousCommanderPerId ? previousCommanderPerId + ' → ' + input.commanderPerId : input.commanderPerId;
    await opts.pushBell(
      db,
      {
        recipients: bellRecipients,
        title: 'Đã đổi người chỉ huy sự vụ ' + input.incidentId,
        message: input.incidentId + ': ' + commanderLabel + ' — ' + input.actor.perId + ' vừa cập nhật.',
        eventType: 'safety.incident.commander_reassigned',
        objectId: input.incidentId,
        actorPerId: input.actor.perId,
        meta: { previous_commander_per_id: previousCommanderPerId, commander_per_id: input.commanderPerId, campus_id: incident.campusId, reason: input.reason || null }
      },
      { now }
    );
  }

  return { incidentId: input.incidentId, commanderPerId: input.commanderPerId, previousCommanderPerId };
}

// ---------------------------------------------------------------------------
// Sửa tay lớp/khu vực gợi ý cho 1 hồ sơ ĐÃ TẠO.
// ---------------------------------------------------------------------------

export async function updateIncidentClassification(
  db: Db,
  input: { actor: Actor; incidentId: string; className?: string | null; zoneIds?: string[]; reason?: string },
  opts?: SafetyOpts
): Promise<{
  incidentId: string;
  className: string | null;
  zoneIds: string[];
  assignedTaskPerIds: string[];
  newlyAddedPerIds: string[];
  homeroomPerId: string | null;
  gradeSupervisorPerId: string | null;
}> {
  const now = opts?.now || new Date();
  if (!input.reason || !String(input.reason).trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi sửa lớp/khu vực của hồ sơ.');
  }
  const incident = await loadIncident(db, input.incidentId);

  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.correct_classification',
    resource: { campusId: incident.campusId, confidentiality: incident.confidentiality }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  const previousClassName = incident.className || null;
  const previousZoneIds = Array.isArray(incident.zoneIds) ? incident.zoneIds.slice() : [];

  const effectiveClassName = input.className !== undefined ? input.className || null : previousClassName;
  const effectiveZoneIds = Array.isArray(input.zoneIds) ? input.zoneIds : previousZoneIds;

  const assignedTaskPerIds: string[] = Array.isArray(incident.assignedTaskPerIds) ? incident.assignedTaskPerIds.slice() : [];
  let homeroomPerId: string | null = null;
  let gradeSupervisorPerId: string | null = null;
  const newlyAddedPerIds: string[] = [];

  // CHỈ tra lại người liên quan khi lớp THỰC SỰ đổi (không truyền
  // className -> giữ nguyên lớp cũ, không tra lại người).
  if (input.className !== undefined && effectiveClassName !== previousClassName) {
    const resolved = await resolveClassRelatedPeople(db, effectiveClassName);
    homeroomPerId = resolved.homeroomPerId;
    gradeSupervisorPerId = resolved.gradeSupervisorPerId;
    for (const perId of [homeroomPerId, gradeSupervisorPerId]) {
      if (perId && !assignedTaskPerIds.includes(perId)) {
        assignedTaskPerIds.push(perId);
        newlyAddedPerIds.push(perId);
      }
    }
  }

  await db
    .update(incidents)
    .set({
      className: effectiveClassName,
      zoneIds: effectiveZoneIds,
      // zone_id (đơn): KHÔNG dùng trong code mới, giữ để tương thích ngược.
      zoneId: effectiveZoneIds[0] || null,
      assignedTaskPerIds,
      version: incident.version + 1,
      updatedAt: now
    })
    .where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: 'incident.classification_corrected',
      objectId: input.incidentId,
      before: { class_name: previousClassName, zone_ids: previousZoneIds },
      after: { class_name: effectiveClassName, zone_ids: effectiveZoneIds },
      reason: input.reason,
      now
    })
  );

  // Có người MỚI (GVCN/phụ trách khối mới) -> báo ngay, dùng ĐÚNG cơ chế
  // dispatch/pushBell/audit mà createIncidentFromReport đã dùng khi gắn
  // người mới liên quan tới lớp.
  if (newlyAddedPerIds.length > 0) {
    const request = notify.buildNotifyRequest({
      recipients: newlyAddedPerIds,
      priority: incident.priority,
      objectId: input.incidentId,
      objectCode: input.incidentId,
      levelLabel: catalog.PRIORITY_LABEL[incident.priority as catalog.Priority],
      actionNeeded: 'Hồ sơ vừa được sửa lại lớp, có liên quan đến lớp/khối bạn phụ trách — xem và phối hợp xử lý',
      deepLink: '/app/incidents/' + input.incidentId,
      eventType: 'safety.incident.homeroom_notified'
    });
    const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
    if (opts?.dispatch && savedRequest) {
      await opts.dispatch(db, savedRequest, { now });
    }
    if (opts?.pushBell) {
      await opts.pushBell(
        db,
        {
          recipients: newlyAddedPerIds,
          title: 'Hồ sơ ' + input.incidentId + ' vừa được sửa lại lớp, có liên quan đến bạn',
          message: request.message,
          eventType: 'safety.incident.homeroom_notified',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { class_name: effectiveClassName, homeroom_per_id: homeroomPerId, grade_supervisor_per_id: gradeSupervisorPerId }
        },
        { now }
      );
    }
    await writeAuditLog(
      db,
      buildAuditRecord({
        actorPerId: 'SYSTEM.SAFETY',
        action: 'safety.incident.homeroom_notified',
        objectId: input.incidentId,
        after: { homeroom_per_id: homeroomPerId, grade_supervisor_per_id: gradeSupervisorPerId, class_name: effectiveClassName },
        now
      })
    );
  }

  return { incidentId: input.incidentId, className: effectiveClassName, zoneIds: effectiveZoneIds, assignedTaskPerIds, newlyAddedPerIds, homeroomPerId, gradeSupervisorPerId };
}
