import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAuthorization, inOrgScope, type Actor } from './authz.js';
import { ROLE } from './catalog.js';

/**
 * Port 1-1 từ `functions/test/test-authz.js` (project An toàn, Firebase) —
 * giữ nguyên từng case để đối chiếu chính xác hành vi 9 bước.
 */
function actor(overrides: Partial<Actor> = {}): Actor {
  return { perId: 'PER.00000001', session: { valid: true, revoked: false }, roles: [], onDutyNow: false, activeDelegations: [], ...overrides };
}

test('bước 1 — phiên hết hạn từ chối dù có vai trò Hiệu trưởng', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL }], session: { valid: false, revoked: false } }),
    action: 'incident.view', resource: {}
  }).allowed, false);
});

test('bước 2 — cấm tuyệt đối, không vai trò nào vượt qua', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }),
    action: 'audit.delete', resource: {}
  }).allowed, false);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL }] }),
    action: 'ai.auto_close', resource: {}
  }).allowed, false);
});

test('bước 3 — Giáo viên không có trong ma trận đóng P0/P1', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01', ceiling: 'C1' }] }),
    action: 'incident.close_p0_p1', resource: { campusId: 'CS.01' }
  }).allowed, false);
});

test('bước 4 — phạm vi tổ chức: Phó HT khác cơ sở bị từ chối, Hiệu trưởng toàn trường được phép mọi cơ sở', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', ceiling: 'C3' }] }),
    action: 'incident.manage', resource: { campusId: 'CS.02' }
  }).allowed, false);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }),
    action: 'incident.manage', resource: { campusId: 'CS.02' }
  }).allowed, true);
});

test('bước 6 (mức bí mật) ĐÃ BỎ 2026-09-22 — vai trò có quyền base thì luôn allowed=true, không còn "redacted"', () => {
  const decision = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DEPT_HEAD, campusId: 'CS.01' }] }),
    action: 'incident.manage', resource: { campusId: 'CS.01' }
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.conditions, []);
});

test('bước 7 — Trực ban đang ca được xem dù không khớp ma trận vai trò', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' }], onDutyNow: true }),
    action: 'incident.view', resource: { campusId: 'CS.01' }
  }).allowed, true);
});

test('bước 7 — người chỉ huy vụ việc (commanderPerId) có quyền tạm thời trên đúng hồ sơ', () => {
  assert.equal(checkAuthorization({
    actor: actor({ perId: 'PER.00000099', roles: [] }),
    action: 'incident.manage', resource: { campusId: 'CS.01', commanderPerId: 'PER.00000099' }
  }).allowed, true);
});

test('bỏ C1-C4 (2026-09-22) — GVCN không có vai trò khớp ma trận vẫn xem được hồ sơ mình được giao (qua quan hệ), không được nếu không liên quan; Trực ban trong ca xem được hồ sơ trước đây coi là C4', () => {
  const gvcnDuocGan = checkAuthorization({
    actor: actor({ perId: 'PER.GVCN_8A2', roles: [{ roleId: ROLE.HOMEROOM, campusId: 'CS.01' }] }),
    action: 'incident.view',
    resource: { campusId: 'CS.01', assignedTaskPerIds: ['PER.GVCN_8A2'] }
  });
  assert.equal(gvcnDuocGan.allowed, true);

  const nguoiNgoaiCuoc = checkAuthorization({
    actor: actor({ perId: 'PER.KHONG_CO_VAI_TRO', roles: [] }),
    action: 'incident.view',
    resource: { campusId: 'CS.01', assignedTaskPerIds: ['PER.NGUOI_KHAC'] }
  });
  assert.equal(nguoiNgoaiCuoc.allowed, false);

  const trucBanXem = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' }], onDutyNow: true }),
    action: 'incident.view', resource: { campusId: 'CS.01' }
  });
  assert.equal(trucBanXem.allowed, true);
  assert.deepEqual(trucBanXem.conditions, []);
});

test('bước 8 — XR cần require_reason, D cần require_approval', () => {
  const hieuTruongHaMuc = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }),
    action: 'incident.lower_priority', resource: { campusId: 'CS.01' }
  });
  assert.ok(hieuTruongHaMuc.allowed && hieuTruongHaMuc.conditions.includes('require_reason'));

  const phoHTHaMuc = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', ceiling: 'C3' }] }),
    action: 'incident.lower_priority', resource: { campusId: 'CS.01' }
  });
  assert.ok(phoHTHaMuc.allowed && phoHTHaMuc.conditions.includes('require_approval'));
});

test('incident.view_stats — chỉ Hiệu trưởng/Phó HT', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', ceiling: 'C3' }] }),
    action: 'incident.view_stats', resource: {}
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01', ceiling: 'C1' }] }),
    action: 'incident.view_stats', resource: {}
  }).allowed, false);
});

test('notify.run_escalation_check — trực ban trong ca được, giáo viên không được', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }], onDutyNow: true }),
    action: 'notify.run_escalation_check', resource: {}
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01', ceiling: 'C1' }] }),
    action: 'notify.run_escalation_check', resource: {}
  }).allowed, false);
});

test('incident.correct_classification — Hiệu trưởng/Phó HT đúng cơ sở (X), Tổ trưởng (XR), Trực ban không có quyền', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }),
    action: 'incident.correct_classification', resource: { campusId: 'CS.01' }
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', ceiling: 'C3' }] }),
    action: 'incident.correct_classification', resource: { campusId: 'CS.01' }
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', ceiling: 'C3' }] }),
    action: 'incident.correct_classification', resource: { campusId: 'CS.02' }
  }).allowed, false);
  const deptHead = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DEPT_HEAD, campusId: 'CS.01', ceiling: 'C2' }] }),
    action: 'incident.correct_classification', resource: { campusId: 'CS.01' }
  });
  assert.ok(deptHead.allowed && deptHead.conditions.includes('require_reason'));
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }], onDutyNow: true }),
    action: 'incident.correct_classification', resource: { campusId: 'CS.01' }
  }).allowed, false);
});

test('xung đột cứng conflict.override_hard — không vai trò nào được phép', () => {
  for (const r of ['PRINCIPAL', 'VICE_PRINCIPAL', 'SYS_ADMIN'] as const) {
    assert.equal(checkAuthorization({
      actor: actor({ roles: [{ roleId: ROLE[r], ceiling: 'C4' }] }),
      action: 'conflict.override_hard', resource: {}
    }).allowed, false, `vai trò ${r} không được bỏ qua xung đột cứng`);
  }
});

test('inOrgScope hoạt động đúng với resource chỉ có campusId (không throw dù thiếu field khác)', () => {
  assert.equal(inOrgScope(
    actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }] }),
    { campusId: 'CS.01' }
  ), true);
  assert.equal(inOrgScope(
    actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }] }),
    { campusId: 'CS.02' }
  ), false);
  assert.equal(inOrgScope(
    actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }),
    { campusId: 'CS.02' }
  ), true);
});

// Sin chốt 2026-09-27: "chỉ tổ trưởng, hiệu phó, hiệu trưởng xem được
// toàn bộ danh sách sự vụ; y tế/bảo vệ/CSVC/tư vấn tâm lý chỉ xem thêm
// đúng nhóm mình phụ trách; các vai trò khác không còn xem tràn nữa".

test('incident.view — Giáo viên/GVCN thường không còn quyền xem tràn qua vai trò (chỉ còn đường quan hệ)', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01' }] }),
    action: 'incident.view', resource: { campusId: 'CS.01' }
  }).allowed, false);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.HOMEROOM, campusId: 'CS.01' }] }),
    action: 'incident.view', resource: { campusId: 'CS.01' }
  }).allowed, false);
});

test('incident.view — Tổ trưởng/Phó HT/Hiệu trưởng vẫn xem toàn bộ đúng phạm vi cơ sở (không bị chặn bởi domain)', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DEPT_HEAD, campusId: 'CS.01' }] }),
    action: 'incident.view', resource: { campusId: 'CS.01', domain: 'health' }
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DEPT_HEAD, campusId: 'CS.01' }] }),
    action: 'incident.view', resource: { campusId: 'CS.02', domain: 'health' }
  }).allowed, false, 'Tổ trưởng khác cơ sở vẫn bị chặn theo bước 4 như cũ');
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01' }] }),
    action: 'incident.view', resource: { campusId: 'CS.01', domain: 'security_traffic' }
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL }] }),
    action: 'incident.view', resource: { campusId: 'CS.02', domain: 'facility' }
  }).allowed, true, 'Hiệu trưởng toàn trường, không bị chặn bởi cơ sở lẫn lĩnh vực');
});

test('incident.view — Y tế chỉ xem đúng nhóm health, không xem được nhóm khác dù đúng cơ sở', () => {
  const yTe = actor({ roles: [{ roleId: ROLE.HEALTH, campusId: 'CS.01' }] });
  assert.equal(checkAuthorization({
    actor: yTe, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'health' }
  }).allowed, true);
  assert.equal(checkAuthorization({
    actor: yTe, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'student_safety' }
  }).allowed, false, 'Y tế không được xem sự vụ nhóm student_safety (VD đánh nhau) nếu không liên quan');
  assert.equal(checkAuthorization({
    actor: yTe, action: 'incident.view', resource: { campusId: 'CS.02', domain: 'health' }
  }).allowed, false, 'đúng nhóm nhưng khác cơ sở vẫn bị chặn ở bước 4');
});

test('incident.view — Bảo vệ xem cả 2 nhóm student_safety và security_traffic, CSVC xem cả facility và security_traffic', () => {
  const baoVe = actor({ roles: [{ roleId: ROLE.SECURITY, campusId: 'CS.01' }] });
  assert.equal(checkAuthorization({ actor: baoVe, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'student_safety' } }).allowed, true);
  assert.equal(checkAuthorization({ actor: baoVe, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'security_traffic' } }).allowed, true);
  assert.equal(checkAuthorization({ actor: baoVe, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'health' } }).allowed, false);

  const csvc = actor({ roles: [{ roleId: ROLE.FACILITY, campusId: 'CS.01' }] });
  assert.equal(checkAuthorization({ actor: csvc, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'facility' } }).allowed, true);
  assert.equal(checkAuthorization({ actor: csvc, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'security_traffic' } }).allowed, true);
  assert.equal(checkAuthorization({ actor: csvc, action: 'incident.view', resource: { campusId: 'CS.01', domain: 'student_safety' } }).allowed, false);
});

test('incident.view — Trực ban KHÔNG trong ca không còn xem tràn qua vai trò; trong ca vẫn xem hết như cũ (không đổi)', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' }], onDutyNow: false }),
    action: 'incident.view', resource: { campusId: 'CS.01' }
  }).allowed, false);
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' }], onDutyNow: true }),
    action: 'incident.view', resource: { campusId: 'CS.01', domain: 'health' }
  }).allowed, true, 'quyền trực ban đến từ relationalGrant (onDutyNow), độc lập ma trận vai trò — không đổi');
});

test('incident.view — GVCN vẫn xem đúng hồ sơ lớp mình chủ nhiệm qua đường quan hệ (assignedTaskPerIds tự gán lúc tạo hồ sơ), không xem lớp khác', () => {
  const gvcn = actor({ perId: 'PER.GVCN_8A2', roles: [{ roleId: ROLE.HOMEROOM, campusId: 'CS.01' }] });
  assert.equal(checkAuthorization({
    actor: gvcn, action: 'incident.view',
    resource: { campusId: 'CS.01', domain: 'student_safety', assignedTaskPerIds: ['PER.GVCN_8A2'] }
  }).allowed, true, 'lớp mình chủ nhiệm, được gán tự động — vẫn xem được dù không còn quyền theo vai trò');
  assert.equal(checkAuthorization({
    actor: gvcn, action: 'incident.view',
    resource: { campusId: 'CS.01', domain: 'student_safety', assignedTaskPerIds: ['PER.GVCN_LOP_KHAC'] }
  }).allowed, false, 'lớp không phải mình chủ nhiệm, không được gán — không còn xem được');
});
