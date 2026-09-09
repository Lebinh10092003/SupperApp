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
    action: 'incident.view_c4', resource: {}
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

test('bước 6 — trần bí mật thấp hơn mức hồ sơ -> allowed=true nhưng redacted', () => {
  const redacted = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DEPT_HEAD, campusId: 'CS.01', ceiling: 'C2' }] }),
    action: 'incident.manage', resource: { campusId: 'CS.01', confidentiality: 'C3' }
  });
  assert.equal(redacted.allowed, true);
  assert.ok(redacted.conditions.includes('redacted'));
});

test('bước 7 — Trực ban đang ca được xem dù không khớp ma trận vai trò', () => {
  assert.equal(checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }], onDutyNow: true }),
    action: 'incident.view_c1_c2', resource: { campusId: 'CS.01' }
  }).allowed, true);
});

test('bước 7 — người chỉ huy vụ việc (commanderPerId) có quyền tạm thời trên đúng hồ sơ', () => {
  assert.equal(checkAuthorization({
    actor: actor({ perId: 'PER.00000099', roles: [] }),
    action: 'incident.manage', resource: { campusId: 'CS.01', commanderPerId: 'PER.00000099' }
  }).allowed, true);
});

test('bước 6+7 — được giao nhiệm vụ đúng hồ sơ bypass trần bí mật; quyền rộng (ca trực) KHÔNG bypass', () => {
  const gvcnDuocGan = checkAuthorization({
    actor: actor({ perId: 'PER.GVCN_8A2', roles: [{ roleId: ROLE.HOMEROOM, campusId: 'CS.01', ceiling: 'C2' }] }),
    action: 'incident.view_c3',
    resource: { campusId: 'CS.01', confidentiality: 'C3', assignedTaskPerIds: ['PER.GVCN_8A2'] }
  });
  assert.equal(gvcnDuocGan.allowed, true);
  assert.ok(!gvcnDuocGan.conditions.includes('redacted'));

  const gvcnKhongDuocGan = checkAuthorization({
    actor: actor({ perId: 'PER.GVCN_8A2', roles: [{ roleId: ROLE.HOMEROOM, campusId: 'CS.01', ceiling: 'C2' }] }),
    action: 'incident.view_c3',
    resource: { campusId: 'CS.01', confidentiality: 'C3', assignedTaskPerIds: ['PER.NGUOI_KHAC'] }
  });
  assert.equal(gvcnKhongDuocGan.allowed, false);

  const trucBanXemC4 = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01', ceiling: 'C2' }], onDutyNow: true }),
    action: 'incident.view_c4', resource: { campusId: 'CS.01', confidentiality: 'C4' }
  });
  assert.equal(trucBanXemC4.allowed, true);
  assert.ok(trucBanXemC4.conditions.includes('redacted'));
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
