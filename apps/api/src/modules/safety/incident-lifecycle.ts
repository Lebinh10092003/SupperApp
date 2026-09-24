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

import { and, eq } from 'drizzle-orm';
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
import { assignments } from '../identity/identity.schema.js';
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

/**
 * Ghi lại SLA clock đã tính lại (đúng cách Hestia dùng ở report-flow.ts —
 * `slaClockToRow` chuyển snake_case thuần logic sang cột Drizzle).
 *
 * LỖI TỰ PHÁT HIỆN 2026-09-21: WHERE trước đây chỉ lọc theo `objectId`,
 * KHÔNG lọc thêm `clockLabel` — khoá chính là (objectId, clockLabel) nên 1
 * hồ sơ có 2 dòng (ack + assign) cùng objectId. Vòng lặp gọi hàm này 2 lần
 * liên tiếp (1 lần/clockLabel) trong `changeIncidentPriority` — do thiếu
 * điều kiện lọc, MỖI LẦN GỌI ghi đè giá trị của CẢ 2 dòng cùng lúc, khiến
 * dòng ghi SAU (assign) cuối cùng đè luôn lên dòng ack, làm sai lệch cả 2
 * đồng hồ mỗi khi đổi mức ưu tiên. Bổ sung `and(eq(objectId), eq(clockLabel))`.
 * Cũng nhân dịp reset `escalatedAt` về null — hạn được tính lại thì phải
 * cho báo lại nếu vẫn/lại quá hạn, không giữ mãi trạng thái "đã báo rồi".
 */
async function saveSlaClock(db: Db, clock: sla.SlaClock) {
  const row = slaClockToRow(clock);
  await db
    .update(slaClocks)
    .set({ priority: row.priority, startAt: row.startAt, deadlineAt: row.deadlineAt, status: row.status, paused: row.paused, pauseHistory: row.pauseHistory, escalatedAt: null })
    .where(and(eq(slaClocks.objectId, clock.object_id), eq(slaClocks.clockLabel, clock.clock_label)));
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

  // Hồ sơ CHƯA có priority (chưa ai tiếp nhận) -> coi việc CHỌN mức đầu tiên
  // là "nâng mức" (an toàn hơn, đòi quyền raise_priority thay vì lower).
  const escalating = incident.priority ? catalog.isEscalation(incident.priority, input.toPriority) : true;
  const action = escalating ? 'incident.raise_priority' : 'incident.lower_priority';

  // CHỈ truyền commanderPerId (KHÔNG truyền assignedTaskPerIds) — Sin chốt
  // 2026-09-22: đổi mức ưu tiên chỉ dành cho chỉ huy hoặc cấp cao, participant
  // thường (dù đang tham gia hồ sơ) KHÔNG được đổi, khác hẳn transitionIncidentStatus.
  const decision = checkAuthorization({
    actor: input.actor,
    action,
    resource: { campusId: incident.campusId, commanderPerId: incident.commanderPerId ?? undefined }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_reason') && !input.reason) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi ' + (escalating ? 'nâng' : 'hạ') + ' mức ưu tiên.');
  }
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  // Tính lại CẢ HAI đồng hồ (ack + assign) theo đúng quy tắc "không mất thời hạn".
  // Hồ sơ CHƯA từng có priority (chưa qua acknowledgeIncident) -> chưa có
  // clock nào -> đăng ký MỚI (startAt = now) thay vì recompute.
  for (const label of ['ack', 'assign'] as const) {
    const clock = await loadSlaClock(db, input.incidentId, label);
    if (clock) {
      const newClock = sla.recomputeOnPriorityChange(clock, { toPriority: input.toPriority as catalog.Priority, calendar: opts?.calendar });
      await saveSlaClock(db, newClock);
    } else {
      const newClock = sla.registerSlaClock({ objectId: input.incidentId, clockLabel: label, priority: input.toPriority as catalog.Priority, startAt: now, calendar: opts?.calendar });
      await db.insert(slaClocks).values(slaClockToRow(newClock));
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
  // Thêm 2026-09-11: người báo tin trước đây chỉ nhận email lúc tiếp nhận
  // và lúc đóng, không biết gì ở giữa. Gửi thêm khi chuyển ĐÚNG vào "Đang
  // xử lý" — mọi lần (kể cả sau khi mở lại/hết chờ bên ngoài), không chỉ
  // lần đầu, vì mỗi lần đều là tin thật đáng báo "đang có người xử lý".
  if (input.toState === catalog.STATE.IN_PROGRESS) {
    await notifyReporterAndAudit(db, opts, { incidentId: input.incidentId, eventType: 'reporter.notified.in_progress' }, now);
  }

  // Chỉ huy + người tham gia hồ sơ — Sin phát hiện 2026-09-24: hàm này
  // trước giờ CHỈ báo người báo tin (reporter), KHÔNG hề báo đội xử lý nội
  // bộ khi đổi trạng thái/đóng hồ sơ (không giống các hàm khác trong file
  // này đều có pushBell). Đóng hồ sơ luôn ép tối thiểu HIGH (email+push) vì
  // là mốc kết thúc quan trọng bất kể mức ưu tiên hồ sơ, giống lý do đã áp
  // dụng cho assignCommander; các lần đổi trạng thái khác chỉ cần chuông
  // trong app (đỡ gây phiền với việc chưa hẳn cần hành động ngay).
  const bellRecipients = Array.from(new Set([...(incident.assignedTaskPerIds || []), ...(opts?.extraRecipients || [])].filter((p): p is string => !!p && p !== input.actor.perId)));
  if (bellRecipients.length > 0) {
    const stateChangeTitle = isClosing ? 'Đã đóng hồ sơ ' + input.incidentId : 'Đổi trạng thái hồ sơ ' + input.incidentId;
    const stateChangeMessage = input.incidentId + ': ' + incident.state + ' → ' + input.toState + ' — ' + input.actor.perId + ' cập nhật.' + (input.note ? ' Ghi chú: ' + input.note : '');
    if (opts?.pushBell) {
      await opts.pushBell(
        db,
        {
          recipients: bellRecipients,
          title: stateChangeTitle,
          message: stateChangeMessage,
          eventType: isClosing ? 'safety.incident.closed' : 'safety.incident.state_changed',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { from_state: incident.state, to_state: input.toState, campus_id: incident.campusId }
        },
        { now }
      );
    }
    if (isClosing) {
      const closeUrgency = notify.urgencyForPriority(incident.priority || catalog.PRIORITY.P3);
      const request = notify.buildNotifyRequest({
        recipients: bellRecipients,
        priority: incident.priority || catalog.PRIORITY.P3,
        objectId: input.incidentId,
        objectCode: input.incidentId,
        levelLabel: incident.priority ? catalog.PRIORITY_LABEL[incident.priority as catalog.Priority] : 'Chưa phân loại',
        actionNeeded: stateChangeMessage,
        deepLink: '/app/incidents/' + input.incidentId,
        eventType: 'safety.incident.closed',
        urgencyOverride: closeUrgency === notify.URGENCY.NORMAL ? notify.URGENCY.HIGH : undefined
      });
      const [savedRequest] = await db.insert(notifyRequests).values({ ...notifyRequestToRow(request), createdAt: now }).returning();
      if (opts?.dispatch && savedRequest) await opts.dispatch(db, savedRequest, { now });
    }
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
    resource: { campusId: incident.campusId }
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
    resource: { campusId: incident.campusId }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_reason') && !input.reason) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi chỉ định/thay người chỉ huy sự cố.');
  }
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  // Bàn giao theo đúng cấp bậc — Sin chốt 2026-09-22 (catalog.ts
  // HANDOFF_TARGET_ROLES_BY_ACTOR_ROLE): Tổ trưởng chỉ giao được cho cấp
  // dưới, không được ngang/lên cấp. Lấy quy tắc RỘNG NHẤT trong các vai
  // trò actor đang giữ (có Hiệu trưởng thì không giới hạn, dù cũng đang
  // giữ thêm vai trò Tổ trưởng).
  const actorRoleIds = (input.actor.roles ?? []).map((r) => r.roleId as catalog.RoleId);
  let allowedTargetRoles: catalog.RoleId[] | null | undefined;
  for (const roleId of actorRoleIds) {
    if (!(roleId in catalog.HANDOFF_TARGET_ROLES_BY_ACTOR_ROLE)) continue;
    const rule = catalog.HANDOFF_TARGET_ROLES_BY_ACTOR_ROLE[roleId];
    if (rule === null) {
      allowedTargetRoles = null; // không giới hạn — thắng tuyệt đối
      break;
    }
    allowedTargetRoles = allowedTargetRoles === undefined ? rule : Array.from(new Set([...(allowedTargetRoles ?? []), ...(rule ?? [])]));
  }
  if (allowedTargetRoles !== null && allowedTargetRoles !== undefined) {
    const targetRows = await db.select().from(assignments).where(eq(assignments.perId, input.commanderPerId));
    const targetRoleIds = targetRows
      .filter((r) => (!r.fromDate || toJsDate(r.fromDate).getTime() <= now.getTime()) && (!r.toDate || toJsDate(r.toDate).getTime() >= now.getTime()))
      .map((r) => r.roleId as catalog.RoleId);
    const ok = targetRoleIds.some((r) => allowedTargetRoles!.includes(r));
    if (!ok) {
      throw new AppError('forbidden', 'Bạn chỉ được bàn giao cho đúng cấp dưới phụ trách, không được bàn giao cho người này.');
    }
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

  // Báo NGAY cho người chỉ huy mới — hồ sơ có thể CHƯA có priority nếu
  // chưa từng được tiếp nhận (mặc định P3). Sin phản hồi 2026-09-24: "bị
  // gán chỉ huy thì không hiện thông báo đẩy" — mức khẩn theo priority thô
  // (P2/P3/chưa phân loại -> NORMAL, notify.ts CHANNEL_TABLE chỉ có
  // in_app) khiến phần lớn lượt gán chỉ huy (đa số hồ sơ KHÔNG phải P0/P1)
  // im lặng không email/push. Được CHỈ ĐỊNH LÀM CHỈ HUY luôn là việc cần
  // biết ngay bất kể mức ưu tiên hồ sơ -> ép tối thiểu HIGH (in_app+email+
  // push), KHÔNG hạ nếu hồ sơ đã P0/P1 (giữ nguyên đường riêng của 2 mức
  // đó, xem CHANNEL_TABLE).
  const commanderAssignedUrgency = notify.urgencyForPriority(incident.priority || catalog.PRIORITY.P3);
  const request = notify.buildNotifyRequest({
    recipients: [input.commanderPerId],
    priority: incident.priority || catalog.PRIORITY.P3,
    objectId: input.incidentId,
    objectCode: input.incidentId,
    levelLabel: incident.priority ? catalog.PRIORITY_LABEL[incident.priority as catalog.Priority] : 'Chưa phân loại',
    actionNeeded: 'Bạn được chỉ định làm người chỉ huy xử lý sự việc này — vào xem và tiếp nhận ngay',
    deepLink: '/app/incidents/' + input.incidentId,
    eventType: 'safety.incident.commander_assigned',
    urgencyOverride: commanderAssignedUrgency === notify.URGENCY.NORMAL ? notify.URGENCY.HIGH : undefined
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
// Tự tiếp nhận — bổ sung 2026-09-22, Sin chốt cách "Xác nhận tiếp nhận" phải
// hoạt động: ai bấm tiếp nhận sẽ TỰ trở thành chỉ huy (không cần Hiệu
// trưởng/Phó HT chỉ định qua assignCommander ở trên — khác hẳn về phân
// quyền: đây là hành động TỰ NHẬN, không phải CHỈ ĐỊNH người khác, nên
// KHÔNG dùng lại `incident.assign_commander` — matrix đó chỉ cấp
// Hiệu trưởng/Phó HT). Điều kiện duy nhất: actor xem được hồ sơ (đúng cơ
// sở) và hồ sơ CHƯA có chỉ huy (người đến trước được tiếp nhận — người đến
// sau thấy đã có chỉ huy thì không cần bấm nữa, đúng yêu cầu "để biết được
// sự vụ đang có người xử lý thì những người liên quan thấy được mà không
// cần phải nhận nữa").
// ---------------------------------------------------------------------------

export async function acknowledgeIncident(
  db: Db,
  input: { actor: Actor; incidentId: string; priority?: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; commanderPerId: string; priority: string }> {
  const now = opts?.now || new Date();
  if (!input.actor.perId) throw new AppError('forbidden', 'Tài khoản chưa được gắn với hồ sơ nhân sự (perId) nào.');
  const incident = await loadIncident(db, input.incidentId);

  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.view',
    resource: { campusId: incident.campusId }
  });
  if (!decision.allowed) {
    throw new AppError('forbidden', 'Bạn không đủ quyền xem hồ sơ này để tiếp nhận xử lý.');
  }
  if (incident.commanderPerId) {
    throw new AppError(
      'already_acknowledged',
      incident.commanderPerId === input.actor.perId ? 'Bạn đã là người tiếp nhận hồ sơ này.' : 'Hồ sơ đã có người khác tiếp nhận xử lý.'
    );
  }

  // Chưa có priority (chưa ai chọn mức ưu tiên) -> BẮT BUỘC chọn ngay lúc
  // tiếp nhận (Sin chốt 2026-09-22) — gợi ý phía frontend qua
  // `suggestedPriorityForCategory`, KHÔNG tự áp nếu actor không xác nhận.
  let priority = incident.priority;
  if (!priority) {
    if (!input.priority || !catalog.isValidPriority(input.priority)) {
      throw new AppError('priority_required', 'Bắt buộc chọn mức ưu tiên khi tiếp nhận hồ sơ chưa được phân loại.');
    }
    priority = input.priority;
  }

  const assignedTaskPerIds = adminArrayUnion(incident.assignedTaskPerIds, input.actor.perId);
  await db
    .update(incidents)
    .set({ commanderPerId: input.actor.perId, assignedTaskPerIds, priority, version: incident.version + 1, updatedAt: now })
    .where(eq(incidents.incidentId, input.incidentId));

  const ackClock = await loadSlaClock(db, input.incidentId, 'ack');
  if (ackClock) {
    // Đồng hồ SLA "ack" đã có sẵn từ lúc tạo (priority không null lúc tạo) —
    // coi như đã hoàn thành ngay khi có người tiếp nhận, tránh
    // check-sla-overdue.ts tiếp tục báo quá hạn cho việc đã xong.
    if (ackClock.status !== 'met') await saveSlaClock(db, { ...ackClock, status: 'met' });
  } else {
    // Chưa có clock nào (priority null lúc tạo) -> đăng ký CẢ HAI đồng hồ
    // NGAY BÂY GIỜ, startAt = now (KHÔNG phải lúc tạo hồ sơ — trước đó
    // chưa có priority để tính hạn được). "ack" coi như xong ngay.
    const newAck = sla.registerSlaClock({ objectId: input.incidentId, clockLabel: 'ack', priority: priority as catalog.Priority, startAt: now, calendar: opts?.calendar });
    await db.insert(slaClocks).values(slaClockToRow({ ...newAck, status: 'met' }));
    const newAssign = sla.registerSlaClock({ objectId: input.incidentId, clockLabel: 'assign', priority: priority as catalog.Priority, startAt: now, calendar: opts?.calendar });
    await db.insert(slaClocks).values(slaClockToRow(newAssign));
  }

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId,
      action: 'incident.acknowledged',
      objectId: input.incidentId,
      before: { commander_per_id: null },
      after: { commander_per_id: input.actor.perId },
      now
    })
  );

  if (opts?.pushBell) {
    const bellRecipients = Array.from(new Set([...(incident.assignedTaskPerIds || []), input.actor.perId, ...(opts.extraRecipients || [])].filter(Boolean) as string[]));
    await opts.pushBell(
      db,
      {
        recipients: bellRecipients,
        title: 'Đã có người tiếp nhận xử lý ' + input.incidentId,
        message: input.incidentId + ': ' + input.actor.perId + ' đã tiếp nhận, giữ vai trò chỉ huy sự vụ.',
        eventType: 'safety.incident.acknowledged',
        objectId: input.incidentId,
        actorPerId: input.actor.perId,
        meta: { commander_per_id: input.actor.perId, campus_id: incident.campusId }
      },
      { now }
    );
  }

  return { incidentId: input.incidentId, commanderPerId: input.actor.perId, priority };
}

// ---------------------------------------------------------------------------
// Chỉ huy hồ sơ thêm người cùng xử lý — bổ sung 2026-09-22, "sự vụ có thể có
// nhiều người cùng xử lý thì người chỉ huy có thể thêm những người xử lý vào
// được". Tái dùng thẳng `assignedTaskPerIds` (đã dùng để cấp bypassCeiling
// xem hồ sơ cho người được giao việc) làm danh sách "người tham gia xử lý"
// — KHÔNG tạo cột riêng, tránh 2 khái niệm chồng chéo (người tự động gắn
// theo lớp qua resolveClassRelatedPeople cũng nằm chung mảng này, hợp lý vì
// cả hai đều là "người đang xử lý hồ sơ", chỉ khác nguồn gán tự động/tay).
// Người chỉ huy hiện tại HOẶC tài khoản cấp cao (Hiệu trưởng/Phó Hiệu
// trưởng/Tổ trưởng, action `incident.add_participant`, Sin chốt
// 2026-09-24) mới được thêm — không phải ai xem được hồ sơ cũng thêm được
// người khác vào.
// ---------------------------------------------------------------------------

export async function addIncidentParticipant(
  db: Db,
  input: { actor: Actor; incidentId: string; perId: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; assignedTaskPerIds: string[] }> {
  const now = opts?.now || new Date();
  if (!input.perId) throw new AppError('invalid_input', 'Thiếu người được thêm vào xử lý.');
  const incident = await loadIncident(db, input.incidentId);

  // Chỉ huy hồ sơ (đường quan hệ) HOẶC cấp cao — Hiệu trưởng/Phó HT/Tổ
  // trưởng (đường vai trò, `incident.add_participant`) — Sin chốt
  // 2026-09-24. CỐ Ý không truyền `assignedTaskPerIds` để participant
  // thường (không phải chỉ huy/cấp cao) vẫn KHÔNG thêm được người khác.
  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.add_participant',
    resource: { campusId: incident.campusId, commanderPerId: incident.commanderPerId ?? undefined }
  });
  if (!decision.allowed) throw new AppError('forbidden', 'Chỉ người chỉ huy hồ sơ hoặc tài khoản cấp cao (Hiệu trưởng/Phó Hiệu trưởng/Tổ trưởng) mới được thêm người tham gia xử lý.');

  const before = incident.assignedTaskPerIds || [];
  const assignedTaskPerIds = adminArrayUnion(before, input.perId);
  await db.update(incidents).set({ assignedTaskPerIds, version: incident.version + 1, updatedAt: now }).where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: 'incident.participant_added',
      objectId: input.incidentId,
      before: { assigned_task_per_ids: before },
      after: { assigned_task_per_ids: assignedTaskPerIds },
      now
    })
  );

  if (opts?.pushBell) {
    await opts.pushBell(
      db,
      {
        recipients: [input.perId],
        title: 'Bạn được thêm vào xử lý sự vụ ' + input.incidentId,
        message: input.incidentId + ': ' + input.actor.perId + ' đã thêm bạn cùng tham gia xử lý.',
        eventType: 'safety.incident.participant_added',
        objectId: input.incidentId,
        actorPerId: input.actor.perId,
        meta: { added_per_id: input.perId, campus_id: incident.campusId }
      },
      { now }
    );
  }

  return { incidentId: input.incidentId, assignedTaskPerIds };
}

// ---------------------------------------------------------------------------
// Tự tham gia / tự rời sự vụ — bổ sung 2026-09-22. KHÁC `addIncidentParticipant`
// ở trên (chỉ huy CHỦ ĐỘNG thêm người khác): đây là actor TỰ nguyện tham
// gia/rời chính mình, bắt buộc nêu lý do mỗi lần (audit trail rõ ràng "ai
// vào/ra vì sao"). Không giới hạn actor phải là ai — bất kỳ ai xem được hồ
// sơ (`incident.view`, đúng cơ sở) đều tự tham gia được.
// ---------------------------------------------------------------------------

export async function joinIncident(
  db: Db,
  input: { actor: Actor; incidentId: string; reason: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; assignedTaskPerIds: string[] }> {
  const now = opts?.now || new Date();
  if (!input.actor.perId) throw new AppError('forbidden', 'Tài khoản chưa được gắn với hồ sơ nhân sự (perId) nào.');
  if (!input.reason || !input.reason.trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi tham gia sự vụ.');
  }
  const incident = await loadIncident(db, input.incidentId);

  const decision = checkAuthorization({ actor: input.actor, action: 'incident.view', resource: { campusId: incident.campusId } });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);

  if (incident.commanderPerId === input.actor.perId || (incident.assignedTaskPerIds || []).includes(input.actor.perId)) {
    throw new AppError('already_joined', 'Bạn đã tham gia sự vụ này rồi.');
  }

  const assignedTaskPerIds = adminArrayUnion(incident.assignedTaskPerIds, input.actor.perId);
  await db.update(incidents).set({ assignedTaskPerIds, version: incident.version + 1, updatedAt: now }).where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId,
      action: 'incident.participant_joined',
      objectId: input.incidentId,
      after: { joined_per_id: input.actor.perId },
      reason: input.reason,
      now
    })
  );

  if (opts?.pushBell) {
    const recipients = Array.from(new Set([incident.commanderPerId, ...(incident.assignedTaskPerIds || [])].filter(Boolean) as string[]));
    if (recipients.length > 0) {
      await opts.pushBell(
        db,
        {
          recipients,
          title: 'Có người mới tham gia sự vụ ' + input.incidentId,
          message: input.incidentId + ': ' + input.actor.perId + ' đã tự tham gia xử lý — lý do: ' + input.reason,
          eventType: 'safety.incident.participant_joined',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { joined_per_id: input.actor.perId, campus_id: incident.campusId }
        },
        { now }
      );
    }
  }

  return { incidentId: input.incidentId, assignedTaskPerIds };
}

export async function leaveIncident(
  db: Db,
  input: { actor: Actor; incidentId: string; reason: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; assignedTaskPerIds: string[] }> {
  const now = opts?.now || new Date();
  if (!input.actor.perId) throw new AppError('forbidden', 'Tài khoản chưa được gắn với hồ sơ nhân sự (perId) nào.');
  if (!input.reason || !input.reason.trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi rời sự vụ.');
  }
  const incident = await loadIncident(db, input.incidentId);

  if (incident.commanderPerId === input.actor.perId) {
    throw new AppError('invalid_state', 'Bạn đang là chỉ huy sự vụ này — dùng chức năng "Huỷ tiếp nhận" thay vì rời.');
  }
  if (!(incident.assignedTaskPerIds || []).includes(input.actor.perId)) {
    throw new AppError('not_participant', 'Bạn hiện không tham gia sự vụ này.');
  }

  const assignedTaskPerIds = (incident.assignedTaskPerIds || []).filter((p) => p !== input.actor.perId);
  await db.update(incidents).set({ assignedTaskPerIds, version: incident.version + 1, updatedAt: now }).where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId,
      action: 'incident.participant_left',
      objectId: input.incidentId,
      after: { left_per_id: input.actor.perId },
      reason: input.reason,
      now
    })
  );

  if (opts?.pushBell && incident.commanderPerId) {
    await opts.pushBell(
      db,
      {
        recipients: [incident.commanderPerId],
        title: 'Có người rời khỏi sự vụ ' + input.incidentId,
        message: input.incidentId + ': ' + input.actor.perId + ' đã rời sự vụ — lý do: ' + input.reason,
        eventType: 'safety.incident.participant_left',
        objectId: input.incidentId,
        actorPerId: input.actor.perId,
        meta: { left_per_id: input.actor.perId, campus_id: incident.campusId }
      },
      { now }
    );
  }

  return { incidentId: input.incidentId, assignedTaskPerIds };
}

// ---------------------------------------------------------------------------
// Huỷ tiếp nhận — quy trình yêu cầu/duyệt thật, bổ sung 2026-09-22 (Sin chốt
// "phải được xác nhận ở tk cấp trên mới cho huỷ" nghĩa là 1 luồng
// request/approve thật, KHÔNG phải honor-system gõ mã người duyệt như
// `approvedBy` ở các action khác). Chỉ CHÍNH chỉ huy hiện tại được yêu cầu;
// chỉ Tổ trưởng/Phó HT/Hiệu trưởng đúng cơ sở được duyệt/từ chối. Mỗi hồ sơ
// chỉ có 1 yêu cầu treo tại 1 thời điểm (3 cột cancelRequested*).
// ---------------------------------------------------------------------------

export async function requestCancelAcknowledgment(
  db: Db,
  input: { actor: Actor; incidentId: string; reason: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; cancelRequestedBy: string; cancelRequestReason: string }> {
  const now = opts?.now || new Date();
  if (!input.actor.perId) throw new AppError('forbidden', 'Tài khoản chưa được gắn với hồ sơ nhân sự (perId) nào.');
  if (!input.reason || !input.reason.trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi yêu cầu huỷ tiếp nhận.');
  }
  const incident = await loadIncident(db, input.incidentId);

  if (!incident.commanderPerId || incident.commanderPerId !== input.actor.perId) {
    throw new AppError('forbidden', 'Chỉ người đang tiếp nhận (chỉ huy) hồ sơ mới được yêu cầu huỷ tiếp nhận.');
  }
  if (incident.cancelRequestedAt) {
    throw new AppError('already_requested', 'Đã có 1 yêu cầu huỷ tiếp nhận đang chờ duyệt cho hồ sơ này.');
  }

  const reason = input.reason.trim();
  await db
    .update(incidents)
    .set({ cancelRequestedBy: input.actor.perId, cancelRequestReason: reason, cancelRequestedAt: now, version: incident.version + 1, updatedAt: now })
    .where(eq(incidents.incidentId, input.incidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId,
      action: 'incident.cancel_acknowledgment_requested',
      objectId: input.incidentId,
      after: { cancel_requested_by: input.actor.perId },
      reason,
      now
    })
  );

  if (opts?.pushBell) {
    const recipients = Array.from(new Set([...(opts.extraRecipients || [])].filter(Boolean) as string[]));
    if (recipients.length > 0) {
      await opts.pushBell(
        db,
        {
          recipients,
          title: 'Yêu cầu huỷ tiếp nhận sự vụ ' + input.incidentId,
          message: input.incidentId + ': ' + input.actor.perId + ' xin huỷ tiếp nhận — lý do: ' + reason,
          eventType: 'safety.incident.cancel_acknowledgment_requested',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { cancel_requested_by: input.actor.perId, campus_id: incident.campusId }
        },
        { now }
      );
    }
  }

  return { incidentId: input.incidentId, cancelRequestedBy: input.actor.perId, cancelRequestReason: reason };
}

export async function approveCancelAcknowledgment(
  db: Db,
  input: { actor: Actor; incidentId: string; approve: boolean; note?: string },
  opts?: SafetyOpts
): Promise<{ incidentId: string; approved: boolean }> {
  const now = opts?.now || new Date();
  const incident = await loadIncident(db, input.incidentId);

  const decision = checkAuthorization({ actor: input.actor, action: 'incident.approve_cancel_acknowledgment', resource: { campusId: incident.campusId } });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);

  if (!incident.cancelRequestedAt || !incident.cancelRequestedBy) {
    throw new AppError('not_found', 'Không có yêu cầu huỷ tiếp nhận nào đang chờ duyệt cho hồ sơ này.');
  }

  const requestedBy = incident.cancelRequestedBy;
  const requestReason = incident.cancelRequestReason;

  if (input.approve) {
    const assignedTaskPerIds = (incident.assignedTaskPerIds || []).filter((p) => p !== requestedBy);
    await db
      .update(incidents)
      .set({
        commanderPerId: null,
        assignedTaskPerIds,
        cancelRequestedBy: null,
        cancelRequestReason: null,
        cancelRequestedAt: null,
        version: incident.version + 1,
        updatedAt: now
      })
      .where(eq(incidents.incidentId, input.incidentId));

    await writeAuditLog(
      db,
      buildAuditRecord({
        actorPerId: input.actor.perId!,
        action: 'incident.acknowledgment_cancelled',
        objectId: input.incidentId,
        before: { commander_per_id: requestedBy },
        after: { commander_per_id: null },
        reason: input.note,
        now
      })
    );

    if (opts?.pushBell) {
      await opts.pushBell(
        db,
        {
          recipients: [requestedBy],
          title: 'Yêu cầu huỷ tiếp nhận đã được duyệt — ' + input.incidentId,
          message: input.incidentId + ': ' + input.actor.perId + ' đã duyệt huỷ tiếp nhận — lý do gốc: ' + requestReason,
          eventType: 'safety.incident.acknowledgment_cancelled',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { cancelled_commander_per_id: requestedBy, campus_id: incident.campusId }
        },
        { now }
      );
    }
  } else {
    await db
      .update(incidents)
      .set({ cancelRequestedBy: null, cancelRequestReason: null, cancelRequestedAt: null, version: incident.version + 1, updatedAt: now })
      .where(eq(incidents.incidentId, input.incidentId));

    await writeAuditLog(
      db,
      buildAuditRecord({
        actorPerId: input.actor.perId!,
        action: 'incident.cancel_acknowledgment_rejected',
        objectId: input.incidentId,
        before: { cancel_requested_by: requestedBy },
        after: { cancel_requested_by: null },
        reason: input.note,
        now
      })
    );

    if (opts?.pushBell) {
      await opts.pushBell(
        db,
        {
          recipients: [requestedBy],
          title: 'Yêu cầu huỷ tiếp nhận đã bị từ chối — ' + input.incidentId,
          message: input.incidentId + ': ' + input.actor.perId + ' đã từ chối yêu cầu huỷ tiếp nhận của bạn.',
          eventType: 'safety.incident.cancel_acknowledgment_rejected',
          objectId: input.incidentId,
          actorPerId: input.actor.perId,
          meta: { requested_by: requestedBy, campus_id: incident.campusId }
        },
        { now }
      );
    }
  }

  return { incidentId: input.incidentId, approved: input.approve };
}

// ---------------------------------------------------------------------------
// Gộp 2 sự vụ trùng nhau — bổ sung 2026-09-22, thay cho cơ chế cũ "gộp tin
// báo vào hồ sơ có sẵn" (submitReport giờ luôn tự tạo incident ngay từ lúc
// gửi tin, xem report-flow.ts — không còn "tin báo chưa phải hồ sơ" để gộp
// vào nữa). Từ nay 2 tin báo trùng nhau nghĩa là 2 INCIDENT trùng nhau —
// gộp bằng cách chuyển hết reportIds của bản trùng sang bản giữ lại, rồi
// đưa bản trùng vào trạng thái "Trùng" (STATE.DUPLICATE, có sẵn trong 12
// trạng thái chuẩn nhưng trước đây chưa có hàm nào thực sự gán tới).
// ---------------------------------------------------------------------------

export async function mergeDuplicateIncidents(
  db: Db,
  input: { actor: Actor; keepIncidentId: string; duplicateIncidentId: string; reason?: string },
  opts?: SafetyOpts
): Promise<{ keepIncidentId: string; duplicateIncidentId: string }> {
  const now = opts?.now || new Date();
  if (input.keepIncidentId === input.duplicateIncidentId) {
    throw new AppError('invalid_input', 'Không thể gộp một hồ sơ với chính nó.');
  }
  const keep = await loadIncident(db, input.keepIncidentId);
  const duplicate = await loadIncident(db, input.duplicateIncidentId);

  if (catalog.isTerminal(duplicate.state as catalog.IncidentState)) {
    throw new AppError('terminal_state', 'Hồ sơ trùng đã ở trạng thái kết thúc (' + duplicate.state + '), không thể gộp nữa.');
  }

  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.manage',
    resource: { campusId: duplicate.campusId }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);

  const combinedReportIds = Array.from(new Set([...(keep.reportIds || []), ...(duplicate.reportIds || [])]));

  await db.update(incidents).set({ reportIds: combinedReportIds, version: keep.version + 1, updatedAt: now }).where(eq(incidents.incidentId, input.keepIncidentId));
  await db.update(reports).set({ mergedIntoIncidentId: input.keepIncidentId }).where(eq(reports.mergedIntoIncidentId, input.duplicateIncidentId));
  await db
    .update(incidents)
    .set({ state: catalog.STATE.DUPLICATE, version: duplicate.version + 1, updatedAt: now, lastNote: 'Đã gộp vào hồ sơ ' + input.keepIncidentId })
    .where(eq(incidents.incidentId, input.duplicateIncidentId));

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: input.actor.perId!,
      action: 'incident.merged_duplicate',
      objectId: input.duplicateIncidentId,
      before: { state: duplicate.state },
      after: { state: catalog.STATE.DUPLICATE, merged_into: input.keepIncidentId },
      reason: input.reason,
      now
    })
  );

  if (opts?.pushBell) {
    const recipients = Array.from(
      new Set([duplicate.commanderPerId, ...(duplicate.assignedTaskPerIds || []), keep.commanderPerId, ...(keep.assignedTaskPerIds || [])].filter(Boolean) as string[])
    );
    if (recipients.length > 0) {
      await opts.pushBell(
        db,
        {
          recipients,
          title: 'Đã gộp 2 sự vụ trùng nhau',
          message: input.duplicateIncidentId + ' đã được gộp vào ' + input.keepIncidentId + ' — chỉ theo dõi tiếp ở ' + input.keepIncidentId + '.',
          eventType: 'safety.incident.merged_duplicate',
          objectId: input.keepIncidentId,
          actorPerId: input.actor.perId,
          meta: { duplicate_incident_id: input.duplicateIncidentId, keep_incident_id: input.keepIncidentId }
        },
        { now }
      );
    }
  }

  return { keepIncidentId: input.keepIncidentId, duplicateIncidentId: input.duplicateIncidentId };
}

// ---------------------------------------------------------------------------
// Sửa tay lớp gợi ý cho 1 hồ sơ ĐÃ TẠO.
// ---------------------------------------------------------------------------

export async function updateIncidentClassification(
  db: Db,
  input: { actor: Actor; incidentId: string; className?: string | null; reason?: string },
  opts?: SafetyOpts
): Promise<{
  incidentId: string;
  className: string | null;
  notifiedPerIds: string[];
  homeroomPerId: string | null;
  gradeSupervisorPerId: string | null;
}> {
  const now = opts?.now || new Date();
  if (!input.reason || !String(input.reason).trim()) {
    throw new AppError('reason_required', 'Bắt buộc nhập lý do khi sửa lớp của hồ sơ.');
  }
  const incident = await loadIncident(db, input.incidentId);

  // Truyền commanderPerId/assignedTaskPerIds — Sin chốt 2026-09-22: sửa lớp
  // áp cùng điều kiện với transitionIncidentStatus (chỉ huy/tham gia/cấp
  // cao), khác đổi mức ưu tiên (chỉ chỉ huy/cấp cao, không cho participant
  // thường).
  const decision = checkAuthorization({
    actor: input.actor,
    action: 'incident.correct_classification',
    resource: { campusId: incident.campusId, commanderPerId: incident.commanderPerId ?? undefined, assignedTaskPerIds: incident.assignedTaskPerIds || [] }
  });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason!);
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của cấp trên trước khi thực hiện.');
  }

  const previousClassName = incident.className || null;

  const effectiveClassName = input.className !== undefined ? input.className || null : previousClassName;

  // Sin chốt 2026-09-24 (ĐẢO LẠI quyết định 2026-09-22 ghi ở dưới): sửa
  // lớp giờ TỰ ĐỘNG thêm GVCN/GV khối MỚI vào assignedTaskPerIds (thật sự
  // thành người tham gia, không chỉ báo suông) + vẫn báo cho họ biết. Cũ:
  // "sửa lớp KHÔNG còn tự gán/rút quyền xem hồ sơ của GVCN/GV khối — chỉ
  // đổi tên lớp + BÁO, họ tự bấm Tham gia sự vụ nếu muốn xử lý."
  const newlyAddedPerIds: string[] = [];
  let homeroomPerId: string | null = null;
  let gradeSupervisorPerId: string | null = null;

  if (input.className !== undefined && effectiveClassName !== previousClassName) {
    const resolved = await resolveClassRelatedPeople(db, effectiveClassName);
    homeroomPerId = resolved.homeroomPerId;
    gradeSupervisorPerId = resolved.gradeSupervisorPerId;
    for (const perId of [homeroomPerId, gradeSupervisorPerId]) {
      if (perId) newlyAddedPerIds.push(perId);
    }
  }

  let assignedTaskPerIds = incident.assignedTaskPerIds || [];
  for (const perId of newlyAddedPerIds) {
    assignedTaskPerIds = adminArrayUnion(assignedTaskPerIds, perId);
  }

  await db
    .update(incidents)
    .set({
      className: effectiveClassName,
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
      before: { class_name: previousClassName },
      after: { class_name: effectiveClassName, notified_per_ids: newlyAddedPerIds },
      reason: input.reason,
      now
    })
  );

  // Báo cho GVCN/GV khối MỚI biết mình VỪA được tự động thêm làm người tham gia.
  if (newlyAddedPerIds.length > 0) {
    const request = notify.buildNotifyRequest({
      recipients: newlyAddedPerIds,
      priority: incident.priority || catalog.PRIORITY.P3,
      objectId: input.incidentId,
      objectCode: input.incidentId,
      levelLabel: incident.priority ? catalog.PRIORITY_LABEL[incident.priority as catalog.Priority] : 'Chưa phân loại',
      actionNeeded: 'Hồ sơ vừa được sửa lại lớp — bạn vừa được TỰ ĐỘNG thêm làm người tham gia xử lý',
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
          title: 'Bạn vừa được gán tự động vào hồ sơ ' + input.incidentId + ' (sửa lại lớp)',
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

  return { incidentId: input.incidentId, className: effectiveClassName, notifiedPerIds: newlyAddedPerIds, homeroomPerId, gradeSupervisorPerId };
}
