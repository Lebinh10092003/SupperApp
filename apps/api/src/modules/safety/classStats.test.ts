import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { incidents } from './incidents.schema.js';
import { checkAuthorization, type Actor } from './authz.js';
import { ROLE } from './catalog.js';
import * as classStats from './classStats.js';

const skip = !process.env.DATABASE_URL;

// `incidents` dùng CHUNG với file test khác — xem chú thích tương tự ở
// zoneStats.test.ts (mistake.md) — chỉ xoá đúng phạm vi campusId dùng ở
// file này, không blanket-delete cả bảng.
const OWN_CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'];

async function resetTables() {
  await db.delete(incidents).where(inArray(incidents.campusId, OWN_CAMPUS_IDS));
}

async function seedIncident(fields: Partial<typeof incidents.$inferInsert> & { incidentId: string }) {
  await db.insert(incidents).values({
    campusId: 'MAIN_CAMPUS',
    priority: 'P3',
    categoryCode: 'facility_general',
    confidentiality: 'C1',
    state: 'Mới tiếp nhận',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...fields
  });
}

const now = new Date('2026-08-20T10:00:00+07:00');

test('classStats: campusId bắt buộc', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => classStats.computeClassStats(db, {}), (e: any) => e instanceof classStats.AppError && e.code === 'invalid_input');
});

test('classStats: group đúng theo class_name', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.1', className: '8A3', priority: 'P2', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.2', className: '8A3', priority: 'P3', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.3', className: '7B1', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const c8a3 = result.classes.find((c) => c.class_name === '8A3');
  const c7b1 = result.classes.find((c) => c.class_name === '7B1');
  assert.ok(c8a3);
  assert.equal(c8a3!.total_count, '<5');
  assert.ok(c7b1);
  assert.equal(c7b1!.total_count, '<5');
});

test('classStats: ngưỡng ẩn k=5 hoạt động đúng (breakdown_hidden, severity_flag vẫn tính đúng)', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.1', className: '8A3', priority: 'P0', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.2', className: '8A3', priority: 'P3', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.3', className: '8A3', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const cls = result.classes.find((c) => c.class_name === '8A3')!;
  assert.equal(cls.total_count, '<5');
  assert.equal(cls.breakdown_hidden, true);
  assert.equal(cls.by_priority, null);
  assert.equal(cls.by_category, null);
  assert.equal(cls.trend, null);
  assert.equal(cls.severity_flag, true);
});

test('classStats: lớp >= 5 vụ -> breakdown đầy đủ, nhóm nhỏ gộp "khac_it_gap"', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.VB.' + i, className: '9A1', priority: 'P2', categoryCode: 'violence_bullying', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.MM.1', className: '9A1', priority: 'P3', categoryCode: 'medical_minor', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.FS.1', className: '9A1', priority: 'P1', categoryCode: 'food_safety', createdAt: now, updatedAt: now });

  const result = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const cls = result.classes.find((c) => c.class_name === '9A1')!;
  assert.equal(cls.total_count, 7);
  assert.equal(cls.breakdown_hidden, false);
  assert.equal(cls.by_category!.violence_bullying, 5);
  assert.equal(cls.by_category!.khac_it_gap, 2);
  assert.equal(cls.severity_flag, true);
  assert.equal(typeof cls.trend!.last_7d, 'number');
  assert.equal(typeof cls.trend!.last_30d, 'number');
  assert.equal(typeof cls.trend!.last_90d, 'number');
});

test('classStats: unassigned_count đếm đúng incident không có class_name', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.UA.1', className: null, createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.UA.2', className: null, createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.UA.3', className: '8A3', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(result.unassigned_count, 2);
});

test('classStats: lọc đúng theo campusId', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.C1.1', campusId: 'CAMPUS_1', className: '6A1', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.MC.1', campusId: 'MAIN_CAMPUS', className: '8A3', createdAt: now, updatedAt: now });
  const result = await classStats.computeClassStats(db, { campusId: 'CAMPUS_1' }, { now });
  assert.equal(result.campus_id, 'CAMPUS_1');
  assert.ok(!result.classes.some((c) => c.class_name === '8A3'));
  assert.ok(result.classes.some((c) => c.class_name === '6A1'));
});

test('classStats: lọc đúng theo categoryCodes', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.CAT.A.' + i, className: '9A1', categoryCode: 'violence_bullying', priority: 'P2', createdAt: now, updatedAt: now });
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.CAT.B.' + i, className: '9A1', categoryCode: 'facility_general', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS', categoryCodes: ['violence_bullying'] }, { now });
  const cls = result.classes.find((c) => c.class_name === '9A1')!;
  assert.deepEqual(result.category_filter, ['violence_bullying']);
  assert.equal(cls.total_count, 5);
});

test('classStats: lọc đúng theo rangeDays', { skip }, async () => {
  await resetTables();
  const old = new Date(now.getTime() - 100 * 24 * 3600 * 1000);
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.OLD.' + i, className: '9A1', createdAt: old, updatedAt: old });

  const resultDefault = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(resultDefault.range_days, 90);
  assert.ok(!resultDefault.classes.some((c) => c.class_name === '9A1'));

  const result7 = await classStats.computeClassStats(db, { campusId: 'MAIN_CAMPUS', rangeDays: 7 }, { now });
  assert.equal(result7.range_days, 7);
});

test('classStats: detectClassNamesFromContent — nhận diện tên lớp từ nội dung tự do', () => {
  assert.deepEqual(classStats.detectClassNamesFromContent('bạn học lớp 8A2 kể lại...'), ['8A2']);
  assert.deepEqual(classStats.detectClassNamesFromContent('lớp 7B1 và lớp 9A10, lại nhắc lại lớp 7B1 lần nữa'), ['7B1', '9A10']);
  assert.equal(classStats.detectClassNamesFromContent('không có tên lớp nào ở đây cả').length, 0);
  assert.deepEqual(classStats.detectClassNamesFromContent('xảy ra với 1 bạn lớp 6c3'), ['6C3']);
  assert.equal(classStats.detectClassNamesFromContent('').length, 0);
  assert.equal(classStats.detectClassNamesFromContent(null).length, 0);
});

test('authz: incident.view_class_stats dùng đúng mức cấp quyền như incident.view_zone_map', () => {
  function actor(overrides: Partial<Actor>): Actor {
    return { perId: 'PER.00000001', session: { valid: true, revoked: false }, roles: [], onDutyNow: false, activeDelegations: [], ...overrides };
  }
  assert.equal(
    checkAuthorization({ actor: actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] }), action: 'incident.view_class_stats', resource: {} }).allowed,
    true
  );
  assert.equal(
    checkAuthorization({ actor: actor({ roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId: 'MAIN_CAMPUS', ceiling: 'C3' }] }), action: 'incident.view_class_stats', resource: {} }).allowed,
    true
  );
  assert.equal(
    checkAuthorization({ actor: actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'MAIN_CAMPUS', ceiling: 'C1' }] }), action: 'incident.view_class_stats', resource: {} }).allowed,
    false
  );
  const d = checkAuthorization({
    actor: actor({ roles: [{ roleId: ROLE.DUTY_OFFICER, campusId: 'MAIN_CAMPUS', ceiling: 'C2' }], onDutyNow: true }),
    action: 'incident.view_class_stats',
    resource: {}
  });
  assert.equal(d.allowed, true);
  assert.ok(d.conditions.includes('require_reason'));
});
