/**
 * incident-lifecycle.test.ts — port từ phần liên quan trong `test-safety.js`
 * gốc (dòng 363-537 changeIncidentPriority/transitionIncidentStatus/
 * confirmIncidentCloseByReporter/reopenIncident/assignCommander; dòng
 * 751-844 updateIncidentClassification).
 *
 * KHÁC bản gốc: bản gốc dựng fixture qua `safety.submitReport` +
 * `safety.createIncidentFromReport` (thuộc phần Hestia code, CHƯA có ở
 * nhánh này) — ở đây seed thẳng bảng `incidents`/`reports` để tạo đúng
 * trạng thái tương đương, thay vì gọi qua chuỗi hàm chưa tồn tại. Assertion
 * giữ nguyên tinh thần bản gốc.
 *
 * CHƯA PORT (chờ Hestia push activateP0/notifyP1Escalation/
 * notifyReporterAndAudit/resolveClassRelatedPeople — xem TODO trong
 * incident-lifecycle.ts): các assertion kiểm tra notify_request/audit log
 * sinh ra TỪ những lệnh gọi chéo đó (VD "nâng lên P1 -> có notify_request
 * p1_escalation_notified", "chuyển Đề nghị đóng -> báo người gửi tin").
 * Phần state machine/authz/DB chính vẫn port đủ và verify thật.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { incidents } from './incidents.schema.js';
import { reports } from './reports.schema.js';
import { auditLogs } from './audit.schema.js';
import { slaClocks } from './sla-clocks.schema.js';
import { ROLE, PRIORITY, STATE, REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS } from './catalog.js';
import type { Actor } from './authz.js';
import { changeIncidentPriority, transitionIncidentStatus, confirmIncidentCloseByReporter, reopenIncident, assignCommander, updateIncidentClassification } from './incident-lifecycle.js';

const skip = !process.env.DATABASE_URL;

async function resetTables() {
  await db.delete(incidents);
  await db.delete(reports);
  await db.delete(slaClocks);
}

function principal(): Actor {
  return { perId: 'PER.HIEUTRUONG', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] };
}
function dutyOfficer(campusId: string): Actor {
  return { perId: 'PER.TRUCBAN', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.DUTY_OFFICER, campusId, ceiling: 'C2' }], onDutyNow: true };
}
function teacherOtherCampus(): Actor {
  return { perId: 'PER.GV_KHAC_CS', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.99', ceiling: 'C1' }] };
}
function vicePrincipal(campusId: string): Actor {
  return { perId: 'PER.PHOHT', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId, ceiling: 'C3' }] };
}

// ID sinh ngẫu nhiên (KHÔNG dùng bộ đếm tất định) — audit_logs là bảng
// bất biến, không dọn giữa các lần chạy test trên cùng DB (đúng nguyên
// tắc S9); ID tất định sẽ trùng nhau giữa các lần chạy `node --test` khác
// nhau trên CÙNG 1 Postgres scratch, làm audit log cộng dồn sai (đã tự
// bắt lỗi này 1 lần ở evidence.test.ts, xem mistake.md — lần đó là thiếu
// filter theo objectId; lần này objectId chính nó không duy nhất giữa
// các lần chạy, cần sửa gốc khác nhau).
function testId(prefix: string): string {
  return prefix + '.TEST.' + crypto.randomUUID().slice(0, 8).toUpperCase();
}

async function seedIncident(overrides: Partial<typeof incidents.$inferInsert> = {}) {
  const now = overrides.createdAt || new Date('2026-08-21T08:01:00+07:00');
  const incidentId = overrides.incidentId || testId('SC');
  await db.insert(incidents).values({
    incidentId,
    campusId: 'CS.01',
    categoryCode: 'facility_general',
    priority: PRIORITY.P2,
    confidentiality: 'C1',
    state: STATE.EMERGENCY,
    version: 1,
    assignedTaskPerIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides
  });
  return incidentId;
}

async function seedReport(overrides: Partial<typeof reports.$inferInsert> = {}) {
  const reportId = overrides.reportId || testId('TB');
  await db.insert(reports).values({
    reportId,
    publicCode: testId('GV'),
    campusId: 'CS.01',
    categoryCode: 'facility_general',
    occurredAt: new Date('2026-08-21T08:00:00+07:00'),
    confidentiality: 'C1',
    createdAt: new Date('2026-08-21T08:00:00+07:00'),
    ...overrides
  });
  return reportId;
}

async function throwsWithCode(fn: () => Promise<unknown>): Promise<{ threw: boolean; code?: string }> {
  try {
    await fn();
    return { threw: false };
  } catch (e) {
    return { threw: true, code: (e as { code?: string }).code };
  }
}

// ---------------------------------------------------------------------
// transitionIncidentStatus
// ---------------------------------------------------------------------

test('transitionIncidentStatus: trực ban đúng cơ sở chuyển hợp lệ; giáo viên khác cơ sở bị từ chối; nhảy trạng thái sai bị từ chối', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ state: STATE.EMERGENCY });

  const t1 = await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.ASSIGNED, note: 'Giao bảo vệ kiểm tra' }, { now: new Date('2026-08-21T08:10:00+07:00') });
  assert.equal(t1.state, STATE.ASSIGNED);

  const wrongCampus = await throwsWithCode(() => transitionIncidentStatus(db, { actor: teacherOtherCampus(), incidentId, toState: STATE.IN_PROGRESS }, {}));
  assert.equal(wrongCampus.threw, true);
  assert.equal(wrongCampus.code, 'forbidden');

  const invalidJump = await throwsWithCode(() => transitionIncidentStatus(db, { actor: principal(), incidentId, toState: STATE.CLOSED }, {}));
  assert.equal(invalidJump.threw, true);
  assert.equal(invalidJump.code, 'invalid_transition');
});

test('transitionIncidentStatus + confirmIncidentCloseByReporter: đóng hồ sơ do người gửi tin báo xác nhận, không qua phê duyệt nội bộ', { skip }, async () => {
  await resetTables();
  const reportId = await seedReport();
  const incidentId = await seedIncident({ state: STATE.ASSIGNED, reportIds: [reportId] });
  await db.update(reports).set({ mergedIntoIncidentId: incidentId }).where(eq(reports.reportId, reportId));

  await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.IN_PROGRESS }, {});
  const closeRequestedAt = new Date('2026-08-21T09:00:00+07:00');
  await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.CLOSE_REQUESTED }, { now: closeRequestedAt });
  const [incAfterCloseRequested] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId));
  assert.ok(incAfterCloseRequested!.closeRequestedAt);

  const principalTooEarly = await throwsWithCode(() => transitionIncidentStatus(db, { actor: principal(), incidentId, toState: STATE.CLOSED }, { now: new Date('2026-08-21T10:00:00+07:00') }));
  assert.equal(principalTooEarly.threw, true);
  assert.equal(principalTooEarly.code, 'reporter_confirmation_pending');

  const viceTooEarly = await throwsWithCode(() => transitionIncidentStatus(db, { actor: vicePrincipal('CS.01'), incidentId, toState: STATE.CLOSED }, { now: new Date('2026-08-21T10:00:00+07:00') }));
  assert.equal(viceTooEarly.threw, true);
  assert.equal(viceTooEarly.code, 'reporter_confirmation_pending');

  const confirmed = await confirmIncidentCloseByReporter(db, { reportId }, { now: new Date('2026-08-21T10:05:00+07:00') });
  assert.equal(confirmed.state, STATE.CLOSED);
  const [incAfterReporterClose] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId));
  assert.equal(incAfterReporterClose!.closedBy, 'REPORTER');
  assert.ok(incAfterReporterClose!.reporterCloseConfirmedAt);

  const doubleConfirm = await throwsWithCode(() => confirmIncidentCloseByReporter(db, { reportId }, { now: new Date('2026-08-21T10:10:00+07:00') }));
  assert.equal(doubleConfirm.threw, true);
  assert.equal(doubleConfirm.code, 'invalid_transition');
});

test('confirmIncidentCloseByReporter: report không tồn tại / chưa gộp vào hồ sơ nào -> not_found', { skip }, async () => {
  await resetTables();
  const missingReport = await throwsWithCode(() => confirmIncidentCloseByReporter(db, { reportId: 'TB.KHONG_TON_TAI' }, {}));
  assert.equal(missingReport.threw, true);
  assert.equal(missingReport.code, 'not_found');

  const reportId = await seedReport();
  const notMerged = await throwsWithCode(() => confirmIncidentCloseByReporter(db, { reportId }, {}));
  assert.equal(notMerged.threw, true);
  assert.equal(notMerged.code, 'not_found');
});

test('transitionIncidentStatus: dự phòng nhân viên tự đóng sau N ngày người báo tin không phản hồi', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ state: STATE.CLASSIFYING });
  await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.ASSIGNED }, {});
  await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.IN_PROGRESS }, {});
  const fallbackRequestedAt = new Date('2026-08-21T08:00:00+07:00');
  await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.CLOSE_REQUESTED }, { now: fallbackRequestedAt });

  const tooEarlyDays = new Date(fallbackRequestedAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  const staffTooEarly = await throwsWithCode(() => transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.CLOSED }, { now: tooEarlyDays }));
  assert.equal(staffTooEarly.threw, true);
  assert.equal(staffTooEarly.code, 'reporter_confirmation_pending');

  const afterFallbackDays = new Date(fallbackRequestedAt.getTime() + REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS * 24 * 60 * 60 * 1000 + 60 * 1000);
  const staffFallbackClose = await transitionIncidentStatus(db, { actor: dutyOfficer('CS.01'), incidentId, toState: STATE.CLOSED }, { now: afterFallbackDays });
  assert.equal(staffFallbackClose.state, STATE.CLOSED);
});

// ---------------------------------------------------------------------
// reopenIncident
// ---------------------------------------------------------------------

test('reopenIncident: bắt buộc lý do; Hiệu trưởng mở lại thành công; ghi đúng reopenedBy/reopenReason', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ state: STATE.CLOSED });

  const noReason = await throwsWithCode(() => reopenIncident(db, { actor: principal(), incidentId, reason: '   ' }, {}));
  assert.equal(noReason.threw, true);
  assert.equal(noReason.code, 'reason_required');

  const reopened = await reopenIncident(db, { actor: principal(), incidentId, reason: 'Cần bổ sung minh chứng trước khi đóng hẳn' }, {});
  assert.equal(reopened.state, STATE.REOPENED);

  const [incAfterReopen] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId));
  assert.equal(incAfterReopen!.reopenedBy, 'PER.HIEUTRUONG');
  assert.match(incAfterReopen!.reopenReason!, /minh chứng/);
});

test('reopenIncident: chỉ mở lại được hồ sơ đang CLOSED', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ state: STATE.IN_PROGRESS });
  const wrongState = await throwsWithCode(() => reopenIncident(db, { actor: principal(), incidentId, reason: 'thử' }, {}));
  assert.equal(wrongState.threw, true);
  assert.equal(wrongState.code, 'invalid_transition');
});

// ---------------------------------------------------------------------
// changeIncidentPriority (phần không phụ thuộc activateP0/notifyP1Escalation)
// ---------------------------------------------------------------------

test('changeIncidentPriority: hạ mức cần lý do (Hiệu trưởng); có lý do thì thành công', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ priority: PRIORITY.P2 });
  const lowerNoReason = await throwsWithCode(() => changeIncidentPriority(db, { actor: principal(), incidentId, toPriority: PRIORITY.P3 }, {}));
  assert.equal(lowerNoReason.threw, true);
  assert.equal(lowerNoReason.code, 'reason_required');

  const lowered = await changeIncidentPriority(db, { actor: principal(), incidentId, toPriority: PRIORITY.P3, reason: 'Đã kiểm tra, không còn nguy cơ' }, {});
  assert.equal(lowered.priority, PRIORITY.P3);
});

test('changeIncidentPriority: nâng mức + ghi đúng audit log priority_changed', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ priority: PRIORITY.P2 });
  const raised = await changeIncidentPriority(db, { actor: dutyOfficer('CS.01'), incidentId, toPriority: PRIORITY.P1 }, {});
  assert.equal(raised.priority, PRIORITY.P1);
  const auditRows = await db.select().from(auditLogs).where(eq(auditLogs.action, 'incident.priority_changed'));
  const match = auditRows.find((r) => r.objectId === incidentId);
  assert.ok(match);
});

// ---------------------------------------------------------------------
// assignCommander
// ---------------------------------------------------------------------

test('assignCommander: giáo viên bị từ chối; Hiệu trưởng thiếu lý do bị từ chối; có lý do thì thành công', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ priority: PRIORITY.P0 });

  const teacherAssign = await throwsWithCode(() => assignCommander(db, { actor: teacherOtherCampus(), incidentId, commanderPerId: 'PER.TRUCBAN' }, {}));
  assert.equal(teacherAssign.threw, true);
  assert.equal(teacherAssign.code, 'forbidden');

  const principalNoReason = await throwsWithCode(() => assignCommander(db, { actor: principal(), incidentId, commanderPerId: 'PER.TRUCBAN' }, {}));
  assert.equal(principalNoReason.threw, true);
  assert.equal(principalNoReason.code, 'reason_required');

  const dispatchCalls: Record<string, unknown>[] = [];
  const fakeDispatch = async (_db: unknown, request: Record<string, unknown>) => {
    dispatchCalls.push(request);
  };
  const assigned = await assignCommander(db, { actor: principal(), incidentId, commanderPerId: 'PER.TRUCBAN', reason: 'Trực ban gần hiện trường nhất' }, { dispatch: fakeDispatch as never });
  assert.equal(assigned.commanderPerId, 'PER.TRUCBAN');
  assert.equal(assigned.previousCommanderPerId, null);

  const [incAfterAssign] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId));
  assert.equal(incAfterAssign!.commanderPerId, 'PER.TRUCBAN');
  assert.ok(incAfterAssign!.assignedTaskPerIds!.includes('PER.TRUCBAN'));

  const reassignAudit = await db.select().from(auditLogs).where(eq(auditLogs.action, 'incident.reassign_commander'));
  assert.equal(reassignAudit.filter((r) => r.objectId === incidentId).length, 1);

  assert.ok(dispatchCalls.some((r) => r.event_type === 'safety.incident.commander_assigned' && (r.recipients as string[]).includes('PER.TRUCBAN')));
});

test('assignCommander: Phó HT cùng cơ sở chỉ định lại KHÔNG cần lý do; chuông thông báo đúng người', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ priority: PRIORITY.P0 });
  await assignCommander(db, { actor: principal(), incidentId, commanderPerId: 'PER.TRUCBAN', reason: 'ban đầu' }, {});

  const bellCalls: Record<string, unknown>[] = [];
  const fakePushBell = async (_db: unknown, payload: Record<string, unknown>) => {
    bellCalls.push(payload);
  };
  const reassigned = await assignCommander(
    db,
    { actor: vicePrincipal('CS.01'), incidentId, commanderPerId: 'PER.HIEUTRUONG' },
    { pushBell: fakePushBell as never, extraRecipients: ['PER.PHOHT_CS01_KHAC'] }
  );
  assert.equal(reassigned.commanderPerId, 'PER.HIEUTRUONG');
  assert.equal(reassigned.previousCommanderPerId, 'PER.TRUCBAN');

  const bellRequest = bellCalls.find((b) => b.objectId === incidentId && b.eventType === 'safety.incident.commander_reassigned');
  assert.ok(bellRequest);
  const recipients = bellRequest!.recipients as string[];
  assert.ok(recipients.includes('PER.PHOHT'));
  assert.ok(recipients.includes('PER.TRUCBAN'));
  assert.ok(recipients.includes('PER.HIEUTRUONG'));
  assert.ok(recipients.includes('PER.PHOHT_CS01_KHAC'));
  assert.equal(bellRequest!.actorPerId, 'PER.PHOHT');
  const meta = bellRequest!.meta as Record<string, unknown>;
  assert.equal(meta.previous_commander_per_id, 'PER.TRUCBAN');
  assert.equal(meta.commander_per_id, 'PER.HIEUTRUONG');
});

test('assignCommander: hồ sơ không tồn tại -> not_found', { skip }, async () => {
  await resetTables();
  const missingIncident = await throwsWithCode(() => assignCommander(db, { actor: principal(), incidentId: 'SC.KHONG_TON_TAI', commanderPerId: 'PER.TRUCBAN', reason: 'thử' }, {}));
  assert.equal(missingIncident.threw, true);
  assert.equal(missingIncident.code, 'not_found');
});

// ---------------------------------------------------------------------
// updateIncidentClassification (phần không phụ thuộc resolveClassRelatedPeople)
// ---------------------------------------------------------------------

test('updateIncidentClassification: bắt buộc lý do; sửa lớp/khu vực thành công, ghi audit', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ className: '8A1', zoneIds: ['MC_GATE'] });

  const noReason = await throwsWithCode(() => updateIncidentClassification(db, { actor: principal(), incidentId, className: '8A2' }, {}));
  assert.equal(noReason.threw, true);
  assert.equal(noReason.code, 'reason_required');

  const updated = await updateIncidentClassification(db, { actor: principal(), incidentId, className: '8A2', zoneIds: ['MC_YARD'], reason: 'Người báo tin ghi nhầm lớp' }, {});
  assert.equal(updated.className, '8A2');
  assert.deepEqual(updated.zoneIds, ['MC_YARD']);

  const [row] = await db.select().from(incidents).where(eq(incidents.incidentId, incidentId));
  assert.equal(row!.className, '8A2');
  assert.deepEqual(row!.zoneIds, ['MC_YARD']);
  assert.equal(row!.zoneId, 'MC_YARD');

  const auditRows = await db.select().from(auditLogs).where(eq(auditLogs.action, 'incident.classification_corrected'));
  assert.equal(auditRows.filter((r) => r.objectId === incidentId).length, 1);
});

test('updateIncidentClassification: không truyền className -> giữ nguyên lớp cũ', { skip }, async () => {
  await resetTables();
  const incidentId = await seedIncident({ className: '8A1', zoneIds: ['MC_GATE'] });
  const updated = await updateIncidentClassification(db, { actor: principal(), incidentId, zoneIds: ['MC_YARD'], reason: 'chỉ sửa khu vực' }, {});
  assert.equal(updated.className, '8A1');
  assert.deepEqual(updated.zoneIds, ['MC_YARD']);
});
