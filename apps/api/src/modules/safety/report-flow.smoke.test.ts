import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray, like } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { assignments, dutyShifts, homeroomAssignments, gradeSupervisorAssignments } from '../identity/identity.schema.js';
import { reports, reportIdentities } from './reports.schema.js';
import { incidents } from './incidents.schema.js';
import { notifyRequests } from './dispatch.schema.js';
import { auditLogs } from './audit.schema.js';
import { idempotencyKeys } from './idempotency.schema.js';
import { slaClocks } from './sla-clocks.schema.js';
import { ROLE, PRIORITY, REPORTER_ROLE, STATE } from './catalog.js';
import {
  submitReport,
  createIncidentFromReport,
  activateP0,
  notifyP1Escalation,
  notifyUrgentReport
} from './report-flow.js';
import type { SafetyOpts } from './report-flow.js';

/**
 * Port (không 1-1 tuyệt đối, chỉ phần thuộc cụm hàm Hestia phụ trách) từ
 * `functions/test/test-safety.js` (848 dòng, bản Firestore gốc). ID tiền tố
 * `RF_` riêng cho file này, tránh đụng file test khác (core/db/README.md).
 */

const skip = !process.env.DATABASE_URL;

const CAMPUS = 'CS.RF_01';
const CAMPUS_EMPTY = 'CS.RF_EMPTY';
const PER_HIEUTRUONG = 'PER.RF_HIEUTRUONG';
const PER_TRUCBAN = 'PER.RF_TRUCBAN';
const PER_GVCN_8A2 = 'PER.RF_GVCN_8A2';
const PER_GVCN_8A3 = 'PER.RF_GVCN_8A3';
const PER_KHOI8 = 'PER.RF_KHOI8';

function submitReportT(input: Parameters<typeof submitReport>[1], opts?: SafetyOpts) {
  return submitReport(db, { email: 'nguoibaotin.test@example.com', ...input }, opts);
}

async function seedEscalationFixtures(campusId: string) {
  await db.insert(assignments).values([
    { perId: PER_HIEUTRUONG, roleId: ROLE.PRINCIPAL, campusId: null },
    { perId: PER_TRUCBAN, roleId: ROLE.DUTY_OFFICER, campusId }
  ]);
  await db.insert(dutyShifts).values([
    { perId: PER_TRUCBAN, fromAt: new Date('2020-01-01T00:00:00+07:00'), toAt: new Date('2030-01-01T00:00:00+07:00') }
  ]);
}

async function cleanup() {
  await db.delete(assignments).where(inArray(assignments.perId, [PER_HIEUTRUONG, PER_TRUCBAN]));
  await db.delete(dutyShifts).where(eq(dutyShifts.perId, PER_TRUCBAN));
  await db.delete(homeroomAssignments).where(inArray(homeroomAssignments.className, ['38A2', '38A3']));
  await db.delete(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, '38'));
  const reportRows = await db.select({ reportId: reports.reportId }).from(reports).where(inArray(reports.campusId, [CAMPUS, CAMPUS_EMPTY]));
  const reportIds = reportRows.map((r) => r.reportId);
  if (reportIds.length) {
    const incidentRows = await db.select({ incidentId: incidents.incidentId }).from(incidents).where(inArray(incidents.campusId, [CAMPUS, CAMPUS_EMPTY]));
    const incidentIds = incidentRows.map((r) => r.incidentId);
    if (incidentIds.length) {
      await db.delete(notifyRequests).where(inArray(notifyRequests.objectId, incidentIds));
      await db.delete(auditLogs).where(inArray(auditLogs.objectId, incidentIds));
      await db.delete(slaClocks).where(inArray(slaClocks.objectId, incidentIds));
      await db.delete(incidents).where(inArray(incidents.incidentId, incidentIds));
    }
    await db.delete(notifyRequests).where(inArray(notifyRequests.objectId, reportIds));
    await db.delete(auditLogs).where(inArray(auditLogs.objectId, reportIds));
    // Đồng hồ SLA riêng của tin báo (bổ sung 2026-09-22) — bình thường đã bị
    // xoá ngay khi chuyển thành hồ sơ, dọn nốt phòng trường hợp test dừng
    // giữa chừng chưa kịp chuyển.
    await db.delete(slaClocks).where(inArray(slaClocks.objectId, reportIds));
    await db.delete(reportIdentities).where(inArray(reportIdentities.reportId, reportIds));
    await db.delete(reports).where(inArray(reports.reportId, reportIds));
  }
  await db.delete(idempotencyKeys).where(like(idempotencyKeys.key, 'rf-idem-%'));
}

test('report-flow: submitReport — tiếp nhận, tách danh tính, gợi ý ưu tiên, TỰ tạo hồ sơ ngay', { skip }, async () => {
  await cleanup();
  await seedEscalationFixtures(CAMPUS);
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const rep = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'Ổ điện có mùi khét ở hành lang tầng 2',
      contactName: 'Cô Lan', stillDangerous: true, idempotencyKey: 'rf-idem-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    assert.equal(rep.reportId.indexOf('TB.'), 0);
    assert.equal(rep.publicCode.indexOf('GV-'), 0);
    assert.equal(rep.initialPriority, PRIORITY.P0);
    // Sin chốt 2026-09-22: KHÔNG còn trạng thái "chờ chuyển thành hồ sơ" —
    // submitReport tự tạo incident ngay, trả về incidentId luôn.
    assert.equal(rep.incidentId.indexOf('SC.'), 0);
    const [reportAfter] = await db.select().from(reports).where(eq(reports.reportId, rep.reportId));
    assert.equal(reportAfter!.mergedIntoIncidentId, rep.incidentId);

    const [reportDoc] = await db.select().from(reports).where(eq(reports.reportId, rep.reportId));
    assert.ok(reportDoc);
    assert.ok(reportDoc.content.includes('khét'));
    const [identityDoc] = await db.select().from(reportIdentities).where(eq(reportIdentities.reportId, rep.reportId));
    assert.ok(identityDoc);
    assert.equal(identityDoc.contactName, 'Cô Lan');

    // idempotency: gọi lại đúng key -> trả kết quả cũ, không tạo tin báo mới
    const repAgain = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'nội dung khác hẳn',
      idempotencyKey: 'rf-idem-1'
    }, { now: new Date('2026-08-21T08:05:00+07:00') });
    assert.equal(repAgain.reportId, rep.reportId);
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — occurredFrom/occurredTo hợp lệ hoặc throw invalid_input', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const badOrder = await submitReportT({
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'from sau to',
      occurredFrom: '2026-08-20T09:00:00+07:00', occurredTo: '2026-08-20T08:00:00+07:00',
      idempotencyKey: 'rf-idem-occurred-bad-order'
    }, { now }).then(() => null).catch((e) => e);
    assert.equal(badOrder?.code, 'invalid_input');
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — bắt buộc email hoặc phone hợp lệ (quyết định họp 07/09/2026)', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const noContact = await submitReport(db, {
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'không để lại liên hệ gì cả',
      idempotencyKey: 'rf-idem-no-contact'
    }, { now }).then(() => null).catch((e) => e);
    assert.equal(noContact?.code, 'invalid_input');

    const badPhoneOnly = await submitReport(db, {
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'sđt quá ngắn',
      phone: '123', idempotencyKey: 'rf-idem-bad-phone'
    }, { now }).then(() => null).catch((e) => e);
    assert.equal(badPhoneOnly?.code, 'invalid_input');
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — P0 tự kích hoạt cảnh báo ngay khi gửi, mức bí mật hiệu lực', { skip }, async () => {
  await cleanup();
  await seedEscalationFixtures(CAMPUS);
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const rep = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'Đang cháy ở tầng 2', stillDangerous: true,
      idempotencyKey: 'rf-idem-p0-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const created = { incidentId: rep.incidentId };
    assert.equal(created.incidentId.indexOf('SC.'), 0);

    const [incDoc] = await db.select().from(incidents).where(eq(incidents.incidentId, created.incidentId));
    assert.ok(incDoc);
    assert.equal(incDoc.state, STATE.EMERGENCY);
    assert.equal(incDoc.confidentiality, 'C1');

    const p0Audit = await db.select().from(auditLogs).where(eq(auditLogs.objectId, created.incidentId));
    const [activated] = p0Audit.filter((a) => a.action === 'safety.incident.p0_activated');
    assert.ok(activated);
    const recipients = (activated.after as { recipients: string[] }).recipients;
    assert.ok(recipients.includes(PER_HIEUTRUONG) && recipients.includes(PER_TRUCBAN));

    // notifyUrgentReport tạo lúc submitReport phải được resolve (ngừng leo thang) sau khi tạo hồ sơ.
    const urgentReqs = await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, rep.reportId));
    const [urgent] = urgentReqs.filter((r) => r.eventType === 'safety.report.urgent_notified');
    assert.ok(urgent);
    assert.equal(urgent.status, 'resolved');
  } finally {
    await cleanup();
  }
});

test('report-flow: notifyUrgentReport — submitReport stillDangerous=true báo NGAY cho trực ban/lãnh đạo', { skip }, async () => {
  await cleanup();
  await seedEscalationFixtures(CAMPUS);
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const dispatchCalls: unknown[] = [];
    const bellCalls: unknown[] = [];
    const rep = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'Đang cháy ở tầng 2', stillDangerous: true,
      idempotencyKey: 'rf-idem-urgent-1'
    }, {
      now,
      dispatch: async (_db, req) => { dispatchCalls.push(req); },
      pushBell: async (_db, payload) => { bellCalls.push(payload); }
    });

    const urgentReqs = await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, rep.reportId));
    const [urgent] = urgentReqs.filter((r) => r.eventType === 'safety.report.urgent_notified');
    assert.ok(urgent);
    assert.ok(urgent.recipients.includes(PER_TRUCBAN) && urgent.recipients.includes(PER_HIEUTRUONG));
    assert.ok(urgent.message.startsWith(rep.reportId));
    assert.ok(!urgent.message.includes(rep.publicCode));
    // 2 lượt dispatch: (1) notifyUrgentReport lúc gửi tin, (2) activateP0 do
    // submitReport TỰ tạo hồ sơ P0 ngay trong cùng lượt gửi (2026-09-22) —
    // activateP0 chỉ gọi dispatch, không gọi pushBell (hành vi có sẵn từ
    // trước, không đổi), nên bellCalls vẫn đúng 1 như cũ.
    assert.equal(dispatchCalls.length, 2);
    assert.equal(bellCalls.length, 1);

    // stillDangerous=false -> không tạo notify_request khẩn nào
    const repNotUrgent = await submitReportT({
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'Bàn ghế hỏng nhẹ', stillDangerous: false,
      idempotencyKey: 'rf-idem-not-urgent-1'
    }, { now });
    const notUrgentReqs = await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, repNotUrgent.reportId));
    assert.equal(notUrgentReqs.filter((r) => r.eventType === 'safety.report.urgent_notified').length, 0);
  } finally {
    await cleanup();
  }
});

test('report-flow: liên thông lớp <-> GVCN + phụ trách khối', { skip }, async () => {
  await cleanup();
  await seedEscalationFixtures(CAMPUS);
  await db.insert(homeroomAssignments).values([
    { className: '38A2', perId: PER_GVCN_8A2 },
    { className: '38A3', perId: PER_GVCN_8A3 }
  ]);
  await db.insert(gradeSupervisorAssignments).values([{ grade: '38', perId: PER_KHOI8 }]);
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');

    // P0 gắn lớp -> GVCN cộng thêm vào người nhận cảnh báo P0.
    const repLop = await submitReportT({
      campusId: CAMPUS, categoryCode: 'violence_bullying', content: 'Nhóm bạn bắt nạt 1 học sinh',
      className: '38A2', stillDangerous: true, idempotencyKey: 'rf-idem-lop-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const createdLop = { incidentId: repLop.incidentId, homeroomPerId: repLop.homeroomPerId };
    assert.equal(createdLop.homeroomPerId, PER_GVCN_8A2);
    const [incLop] = await db.select().from(incidents).where(eq(incidents.incidentId, createdLop.incidentId));
    assert.ok(incLop);
    assert.equal(incLop.className, '38A2');
    assert.ok(incLop.assignedTaskPerIds?.includes(PER_GVCN_8A2));
    const [p0AuditLop] = (await db.select().from(auditLogs).where(eq(auditLogs.objectId, createdLop.incidentId)))
      .filter((a) => a.action === 'safety.incident.p0_activated');
    assert.ok(p0AuditLop);
    const recipientsLop = (p0AuditLop.after as { recipients: string[] }).recipients;
    assert.ok(recipientsLop.includes(PER_GVCN_8A2) && recipientsLop.includes(PER_TRUCBAN));

    // Không phải P0 vẫn phải báo riêng cho GVCN.
    const repLop2 = await submitReportT({
      campusId: CAMPUS, categoryCode: 'cyberbullying', content: 'Học sinh bị lập nhóm chê bai trên mạng',
      className: '38A2', priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-lop-2'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const homeroomAudit = (await db.select().from(auditLogs).where(eq(auditLogs.objectId, repLop2.incidentId)))
      .filter((a) => a.action === 'safety.incident.homeroom_notified');
    assert.equal(homeroomAudit.length, 1);

    // Lớp chưa khai báo GVCN -> vẫn tạo hồ sơ bình thường, không lỗi.
    const repLop3 = await submitReportT({
      campusId: CAMPUS, categoryCode: 'violence_bullying', content: 'Va chạm nhẹ giữa 2 học sinh',
      className: '39B1', priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-lop-3'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    assert.equal(repLop3.homeroomPerId, null);

    // Lớp 8A3 -> đẩy NGAY cho cả GVCN 8A3 và phụ trách khối 8 (suy từ tên lớp).
    const bellCallsKhoi: unknown[] = [];
    const repKhoi = await submitReportT({
      campusId: CAMPUS, categoryCode: 'violence_bullying', content: 'Phát hiện bạn học bị bắt nạt',
      className: '38A3', priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-khoi-1'
    }, {
      now, dispatch: async () => {}, pushBell: async (_db, payload) => { bellCallsKhoi.push(payload); }
    });
    assert.equal(repKhoi.homeroomPerId, PER_GVCN_8A3);
    assert.equal(repKhoi.gradeSupervisorPerId, PER_KHOI8);
    const [incKhoi] = await db.select().from(incidents).where(eq(incidents.incidentId, repKhoi.incidentId));
    assert.ok(incKhoi);
    assert.ok(incKhoi.assignedTaskPerIds?.includes(PER_GVCN_8A3) && incKhoi.assignedTaskPerIds?.includes(PER_KHOI8));
    assert.equal(bellCallsKhoi.length, 1);
  } finally {
    await cleanup();
  }
});

test('report-flow: activateP0 không có người trực/lãnh đạo -> throw no_recipients', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    // priorityOverride: P0 buộc submitReport tự gọi thẳng activateP0 ngay
    // lúc gửi (không còn bước "chuyển thành hồ sơ" riêng để gọi lại nữa).
    const err = await submitReportT(
      { campusId: CAMPUS_EMPTY, categoryCode: 'medical_minor', content: 'tai nạn nhẹ', priorityOverride: PRIORITY.P0, idempotencyKey: 'rf-idem-empty-1' },
      { now }
    ).then(() => null).catch((e) => e);
    assert.equal(err?.code, 'no_recipients');

    const errDirect = await activateP0(db, { incidentId: 'SC.NONEXISTENT', campusId: CAMPUS_EMPTY }, { now }).then(() => null).catch((e) => e);
    assert.equal(errDirect?.code, 'no_recipients');
  } finally {
    await cleanup();
  }
});

test('report-flow: notifyP1Escalation — KHÔNG có người nhận nào trong toàn hệ thống', { skip }, async () => {
  // Hiệu trưởng có campusId=null (áp dụng TOÀN TRƯỜNG, không lọc theo cơ
  // sở) — nếu seed fixture ở BẤT KỲ đâu trong cùng 1 DB thật thì mọi campus
  // khác cũng "thấy" được Hiệu trưởng đó. Test case "hoàn toàn không có ai"
  // vì vậy PHẢI chạy trên DB sạch tuyệt đối, tách khỏi test case "có người
  // nhận" bên dưới — đúng lý do bản gốc Firestore dùng FakeFirestore RIÊNG
  // cho case này (xem test-safety.js dòng 332).
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const repEmpty = await submitReportT(
      { campusId: CAMPUS_EMPTY, categoryCode: 'structural_hazard', content: 'Sự cố công trình chưa khai báo ai', priorityOverride: PRIORITY.P1, idempotencyKey: 'rf-idem-p1-empty' },
      { now }
    );
    assert.ok(!!repEmpty.incidentId);
    const noRecipientsAudit = (await db.select().from(auditLogs).where(eq(auditLogs.objectId, repEmpty.incidentId)))
      .filter((a) => a.action === 'safety.incident.p1_no_recipients');
    assert.equal(noRecipientsAudit.length, 1);
  } finally {
    await cleanup();
  }
});

test('report-flow: notifyP1Escalation — có leadership + trực ban -> notify_request đúng urgency/recipients', { skip }, async () => {
  await cleanup();
  await seedEscalationFixtures(CAMPUS);
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const rep = await submitReportT(
      { campusId: CAMPUS, categoryCode: 'structural_hazard', content: 'Trần nhà bong tróc', priorityOverride: PRIORITY.P1, idempotencyKey: 'rf-idem-p1-1' },
      { now }
    );
    const [p1Req] = (await db.select().from(notifyRequests).where(eq(notifyRequests.objectId, rep.incidentId)))
      .filter((r) => r.eventType === 'safety.incident.p1_escalation_notified');
    assert.ok(p1Req);
    assert.equal(p1Req.urgency, 'p1');
    assert.ok(p1Req.recipients.includes(PER_HIEUTRUONG) && p1Req.recipients.includes(PER_TRUCBAN));

    const directResult = await notifyP1Escalation(db, { incidentId: rep.incidentId, campusId: CAMPUS }, { now });
    assert.equal(directResult.notified, true);
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — suggested_class_names từ content, KHÔNG tự gán class_name', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T10:00:00+07:00');
    const repClassMentioned = await submitReportT({
      campusId: CAMPUS, categoryCode: 'violence_bullying', content: 'Một bạn học lớp 8A2 kể lại bị bạn cùng lớp trêu chọc',
      idempotencyKey: 'rf-idem-class-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const [doc1] = await db.select().from(reports).where(eq(reports.reportId, repClassMentioned.reportId));
    assert.ok(doc1);
    assert.equal(doc1.className, null);
    assert.deepEqual(doc1.suggestedClassNames, ['8A2']);
    // Chỉ là GỢI Ý — hồ sơ tự tạo KHÔNG tự gán className theo suggested_class_names.
    const [incMentioned] = await db.select().from(incidents).where(eq(incidents.incidentId, repClassMentioned.incidentId));
    assert.equal(incMentioned!.className, null);

    const repExplicit = await submitReportT({
      campusId: CAMPUS, categoryCode: 'violence_bullying', className: '6C3', content: 'Nội dung không nhắc lớp nào',
      idempotencyKey: 'rf-idem-class-2'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const [doc2] = await db.select().from(reports).where(eq(reports.reportId, repExplicit.reportId));
    assert.ok(doc2);
    assert.equal(doc2.className, '6C3');
    // className khai báo tường minh ở tin báo được mang nguyên sang hồ sơ tự tạo.
    const [incExplicit] = await db.select().from(incidents).where(eq(incidents.incidentId, repExplicit.incidentId));
    assert.equal(incExplicit!.className, '6C3');
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — email/phone chuẩn hoá, bỏ ẩn danh hoàn toàn', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T11:00:00+07:00');
    const repWithEmail = await submitReportT({
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'bàn ghế hỏng',
      contactName: 'Chị Hoa', email: 'Chi.Hoa@Example.COM', phone: '0912345678',
      idempotencyKey: 'rf-idem-email-1'
    }, { now });
    const [idDoc] = await db.select().from(reportIdentities).where(eq(reportIdentities.reportId, repWithEmail.reportId));
    assert.ok(idDoc);
    assert.equal(idDoc.email, 'chi.hoa@example.com');
    assert.equal(idDoc.phone, '0912345678');

    const repBadEmail = await submitReport(db, {
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'nội dung khác',
      email: 'khong-phai-email', phone: '0900000001', idempotencyKey: 'rf-idem-email-2'
    }, { now });
    const [idBadDoc] = await db.select().from(reportIdentities).where(eq(reportIdentities.reportId, repBadEmail.reportId));
    assert.ok(idBadDoc);
    assert.equal(idBadDoc.email, null);

    const repAnon = await submitReport(db, {
      campusId: CAMPUS, categoryCode: 'facility_general', content: 'cờ anonymous=true không còn tác dụng',
      email: 'khong-con-an-danh@example.com', idempotencyKey: 'rf-idem-email-3'
    }, { now });
    const [repAnonDoc] = await db.select().from(reports).where(eq(reports.reportId, repAnon.reportId));
    assert.ok(repAnonDoc);
    assert.equal(repAnonDoc.anonymous, false);
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport — gọi opts.notifyReporter khi hồ sơ tự tạo xong', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T12:00:00+07:00');
    const notifyCalls: Array<{ reportId?: string; eventType: string }> = [];
    const fakeNotifyReporter: SafetyOpts['notifyReporter'] = async (_db, params) => { notifyCalls.push(params); return { sent: true }; };

    const repN = await submitReportT(
      { campusId: CAMPUS, categoryCode: 'facility_general', content: 'test notifyReporter', idempotencyKey: 'rf-idem-notify-1' },
      { now, notifyReporter: fakeNotifyReporter }
    );
    assert.ok(notifyCalls.some((c) => c.reportId === repN.reportId && c.eventType === 'reporter.notified.received'));

    const [auditReporterNotified] = (await db.select().from(auditLogs).where(eq(auditLogs.objectId, repN.reportId)))
      .filter((a) => a.action === 'safety.report.reporter_notified');
    assert.ok(auditReporterNotified);
    assert.equal((auditReporterNotified.after as { sent: boolean }).sent, true);
    assert.ok(!JSON.stringify(auditReporterNotified).includes('nguoibaotin.test@example.com'));
  } finally {
    await cleanup();
  }
});

test('report-flow: reporter_role copy nguyên trạng từ tin báo gốc sang hồ sơ', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const rep = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'test reporter_role',
      reporterRole: REPORTER_ROLE.WITNESS, priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-role-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const [repDoc] = await db.select().from(reports).where(eq(reports.reportId, rep.reportId));
    assert.ok(repDoc);
    assert.equal(repDoc.reporterRole, REPORTER_ROLE.WITNESS);

    const [incDoc] = await db.select().from(incidents).where(eq(incidents.incidentId, rep.incidentId));
    assert.ok(incDoc);
    assert.equal(incDoc.reporterRole, REPORTER_ROLE.WITNESS);

    const repInvalid = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'reporter_role không hợp lệ',
      reporterRole: 'gia_mao_khong_ton_tai', priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-role-2'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });
    const [repInvalidDoc] = await db.select().from(reports).where(eq(reports.reportId, repInvalid.reportId));
    assert.ok(repInvalidDoc);
    assert.equal(repInvalidDoc.reporterRole, null);
  } finally {
    await cleanup();
  }
});

test('report-flow: submitReport tự tạo hồ sơ ngay -> đồng hồ SLA ack/assign gắn thẳng vào incidentId, không còn đồng hồ riêng theo reportId', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T08:00:00+07:00');
    const rep = await submitReportT({
      campusId: CAMPUS, categoryCode: 'fire_explosion', content: 'test đồng hồ SLA',
      priorityOverride: PRIORITY.P2, idempotencyKey: 'rf-idem-slaclock-1'
    }, { now, dispatch: async () => {}, pushBell: async () => {} });

    // Sin chốt 2026-09-22: không còn "tin báo chờ chuyển thành hồ sơ" nên
    // không còn đồng hồ SLA riêng theo reportId nữa — chỉ có đồng hồ của
    // chính hồ sơ (incidentId), đăng ký ngay trong cùng lượt gửi tin.
    const reportClocks = await db.select().from(slaClocks).where(eq(slaClocks.objectId, rep.reportId));
    assert.equal(reportClocks.length, 0, 'không còn đồng hồ SLA riêng theo reportId');

    const incidentClocks = await db.select().from(slaClocks).where(eq(slaClocks.objectId, rep.incidentId));
    const labels = incidentClocks.map((c) => c.clockLabel).sort();
    assert.deepEqual(labels, ['ack', 'assign']);
    assert.equal(incidentClocks.find((c) => c.clockLabel === 'ack')!.priority, rep.initialPriority);
  } finally {
    await cleanup();
  }
});
