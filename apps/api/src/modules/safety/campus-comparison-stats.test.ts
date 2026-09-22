import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { incidents } from './incidents.schema.js';
import { computeCampusComparisonStats, monthKeyOf, shiftMonthKey, monthRangeArray, resolveMonthRange, CAMPUS_IDS } from './campus-comparison-stats.js';
import { checkAuthorization, type Actor } from './authz.js';
import { ROLE } from './catalog.js';
import { AppError } from './shared.js';

const skip = !process.env.DATABASE_URL;

// PHẢI dùng đúng 3 campusId thật (module hard-code CAMPUS_IDS, không cho
// tuỳ chỉnh) — cùng scope với zoneStats.test.ts/classStats.test.ts (đã
// verify an toàn cùng tồn tại qua nhiều lần chạy lặp lại, xem mistake.md).
async function resetTables() {
  await db.delete(incidents).where(inArray(incidents.campusId, CAMPUS_IDS as unknown as string[]));
}

async function seedIncident(overrides: Partial<typeof incidents.$inferInsert> & { campusId: string; createdAt: Date }) {
  await db.insert(incidents).values({
    incidentId: 'SC.CC.TEST.' + crypto.randomUUID().slice(0, 8).toUpperCase(),
    categoryCode: 'facility_general',
    priority: 'P3',
    confidentiality: 'C1',
    state: 'Mới tiếp nhận',
    version: 1,
    updatedAt: overrides.createdAt,
    ...overrides
  });
}

function principal(): Actor {
  return { perId: 'PER.HIEUTRUONG', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] };
}
function vicePrincipal(campusId: string): Actor {
  return { perId: 'PER.PHOHT', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.VICE_PRINCIPAL, campusId, ceiling: 'C3' }] };
}
function dutyOfficer(campusId: string): Actor {
  return { perId: 'PER.TRUCBAN', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.DUTY_OFFICER, campusId, ceiling: 'C2' }] };
}

const now = new Date('2026-08-20T10:00:00+07:00'); // tháng hiện tại = 2026-08

test('authz: incident.view_campus_comparison — CHỈ Hiệu trưởng, Phó HT/vai trò khác bị chặn', () => {
  assert.equal(checkAuthorization({ actor: principal(), action: 'incident.view_campus_comparison', resource: {} }).allowed, true);
  assert.equal(checkAuthorization({ actor: vicePrincipal('MAIN_CAMPUS'), action: 'incident.view_campus_comparison', resource: {} }).allowed, false);
  assert.equal(checkAuthorization({ actor: dutyOfficer('MAIN_CAMPUS'), action: 'incident.view_campus_comparison', resource: {} }).allowed, false);
});

test('campusComparisonStats: cơ sở < 5 vụ toàn range -> ẩn TOÀN BỘ breakdown', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P0', createdAt: now });
  await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P3', createdAt: now });
  await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P3', createdAt: now });

  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  const main = result.campuses.MAIN_CAMPUS!;
  assert.equal(main.total_count, '<5');
  assert.equal(main.breakdown_hidden, true);
  assert.equal(main.by_priority, null);
  assert.equal(main.p0_p1_rate, null);
  assert.equal(main.top_categories, null);
  assert.equal(main.monthly_trend, null);
  assert.equal(main.monthly_trend_by_category, null);
  assert.equal(main.compare_to_previous_month, null);

  assert.equal(result.campuses.CAMPUS_1!.total_count, 0);
  assert.equal(result.campuses.CAMPUS_1!.breakdown_hidden, true);
});

test('campusComparisonStats: cơ sở >= 5 vụ -> breakdown đầy đủ, đúng 3 nhóm không khac_it_gap', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 6; i++) await seedIncident({ campusId: 'CAMPUS_1', categoryCode: 'violence_bullying', priority: 'P1', createdAt: now });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_1', categoryCode: 'facility_general', priority: 'P3', createdAt: now });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_1', categoryCode: 'fire_explosion', priority: 'P0', createdAt: now });

  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  const c1 = result.campuses.CAMPUS_1!;
  assert.equal(c1.total_count, 16);
  assert.equal(c1.breakdown_hidden, false);
  assert.equal(c1.by_priority!.P0, 5);
  assert.equal(c1.by_priority!.P1, 6);
  assert.equal(c1.by_priority!.P2, 0);
  assert.equal(c1.by_priority!.P3, 5);
  assert.ok(Math.abs(c1.p0_p1_rate! - 11 / 16) < 0.0001);

  const codes = c1.top_categories!.map((x) => x.category_code);
  assert.equal(codes.length, 3);
  assert.ok(codes.includes('violence_bullying') && codes.includes('facility_general') && codes.includes('fire_explosion'));
  assert.ok(!codes.includes('khac_it_gap'));
  assert.deepEqual(Object.keys(c1.monthly_trend_by_category!).sort(), ['facility_general', 'fire_explosion', 'violence_bullying']);
});

test('campusComparisonStats: nhóm qua ngưỡng nhưng ngoài top3 -> gộp khac_it_gap, vẫn có trend riêng', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 9; i++) await seedIncident({ campusId: 'CAMPUS_2', categoryCode: 'violence_bullying', priority: 'P1', createdAt: now });
  for (let i = 0; i < 8; i++) await seedIncident({ campusId: 'CAMPUS_2', categoryCode: 'facility_general', priority: 'P3', createdAt: now });
  for (let i = 0; i < 7; i++) await seedIncident({ campusId: 'CAMPUS_2', categoryCode: 'fire_explosion', priority: 'P0', createdAt: now });
  for (let i = 0; i < 6; i++) await seedIncident({ campusId: 'CAMPUS_2', categoryCode: 'food_safety', priority: 'P2', createdAt: now });

  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  const c2 = result.campuses.CAMPUS_2!;
  const khac = c2.top_categories!.find((x) => x.category_code === 'khac_it_gap');
  assert.ok(khac);
  assert.equal(khac!.count, 6);
  assert.equal(c2.top_categories!.length, 4);
  assert.ok(Array.isArray(c2.monthly_trend_by_category!.food_safety));
});

test('campusComparisonStats: compare_to_previous_month tính đúng delta + direction', { skip }, async () => {
  await resetTables();
  const julyDate = new Date('2026-07-15T10:00:00+07:00');
  for (let i = 0; i < 10; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P3', createdAt: julyDate });
  for (let i = 0; i < 6; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P3', createdAt: now });

  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  const main = result.campuses.MAIN_CAMPUS!;
  assert.equal(main.compare_to_previous_month!.previous_month, '2026-07');
  assert.equal(main.compare_to_previous_month!.previous_total, 10);
  assert.equal(main.compare_to_previous_month!.latest_total, 6);
  assert.equal(main.compare_to_previous_month!.delta, -4);
  assert.equal(main.compare_to_previous_month!.direction, 'improved');
  assert.equal(main.total_count, 6);
});

test('campusComparisonStats: direction worsened khi tăng, flat khi không đổi', { skip }, async () => {
  await resetTables();
  const julyDate = new Date('2026-07-15T10:00:00+07:00');
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_1', priority: 'P3', createdAt: julyDate });
  for (let i = 0; i < 9; i++) await seedIncident({ campusId: 'CAMPUS_1', priority: 'P3', createdAt: now });
  const resultWorse = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  assert.equal(resultWorse.campuses.CAMPUS_1!.compare_to_previous_month!.direction, 'worsened');

  await resetTables();
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_2', priority: 'P3', createdAt: julyDate });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_2', priority: 'P3', createdAt: now });
  const resultFlat = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  assert.equal(resultFlat.campuses.CAMPUS_2!.compare_to_previous_month!.direction, 'flat');
  assert.equal(resultFlat.campuses.CAMPUS_2!.compare_to_previous_month!.delta, 0);
});

test('campusComparisonStats: ranking đúng theo p0_p1_rate cao nhất + cải thiện/xấu đi nhiều nhất', { skip }, async () => {
  await resetTables();
  const julyDate = new Date('2026-07-15T10:00:00+07:00');
  for (let i = 0; i < 6; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P0', createdAt: now });
  for (let i = 0; i < 6; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', priority: 'P0', createdAt: julyDate });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_1', priority: 'P3', createdAt: julyDate });
  for (let i = 0; i < 20; i++) await seedIncident({ campusId: 'CAMPUS_1', priority: 'P3', createdAt: now });
  for (let i = 0; i < 20; i++) await seedIncident({ campusId: 'CAMPUS_2', priority: 'P3', createdAt: julyDate });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'CAMPUS_2', priority: 'P3', createdAt: now });

  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  assert.equal(result.ranking.highest_p0_p1_rate_campus, 'MAIN_CAMPUS');
  assert.equal(result.ranking.most_worsened_campus, 'CAMPUS_1');
  assert.equal(result.ranking.most_improved_campus, 'CAMPUS_2');
});

test('campusComparisonStats: tất cả cơ sở đều bị ẩn -> ranking toàn null, không throw', { skip }, async () => {
  await resetTables();
  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08' }, { now });
  assert.ok((['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const).every((id) => result.campuses[id]!.breakdown_hidden === true));
  assert.equal(result.ranking.highest_p0_p1_rate_campus, null);
  assert.equal(result.ranking.most_improved_campus, null);
  assert.equal(result.ranking.most_worsened_campus, null);
  assert.ok(typeof result.disclaimer === 'string' && result.disclaimer.length > 0);
});

test('campusComparisonStats: mặc định 6 tháng gần nhất khi không truyền fromMonth/toMonth', { skip }, async () => {
  await resetTables();
  const result = await computeCampusComparisonStats(db, {}, { now });
  assert.equal(result.to_month, '2026-08');
  assert.equal(result.from_month, '2026-03');
  assert.equal(result.months.length, 6);
  assert.equal(result.months[0], '2026-03');
  assert.equal(result.months[5], '2026-08');
});

test('campusComparisonStats: categoryCodes lọc đúng, category_filter trả về đúng input', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', categoryCode: 'violence_bullying', priority: 'P2', createdAt: now });
  for (let i = 0; i < 5; i++) await seedIncident({ campusId: 'MAIN_CAMPUS', categoryCode: 'facility_general', priority: 'P3', createdAt: now });
  const result = await computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-08', categoryCodes: ['violence_bullying'] }, { now });
  assert.deepEqual(result.category_filter, ['violence_bullying']);
  assert.equal(result.campuses.MAIN_CAMPUS!.total_count, 5);
});

test('campusComparisonStats: fromMonth > toMonth -> throw invalid_input', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => computeCampusComparisonStats(db, { fromMonth: '2026-08', toMonth: '2026-03' }, { now }), (e: unknown) => e instanceof AppError && e.code === 'invalid_input');
});

test('campusComparisonStats: định dạng tháng sai -> throw invalid_input', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => computeCampusComparisonStats(db, { fromMonth: '2026/08', toMonth: '2026-08' }, { now }), (e: unknown) => e instanceof AppError && e.code === 'invalid_input');
});

test('monthKeyOf/shiftMonthKey/monthRangeArray/resolveMonthRange — hàm thuần', () => {
  assert.equal(monthKeyOf(new Date('2026-01-01T00:00:00+07:00')), '2026-01');
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12');
  assert.deepEqual(monthRangeArray('2026-01', '2026-03'), ['2026-01', '2026-02', '2026-03']);
  assert.deepEqual(resolveMonthRange({}, new Date('2026-08-20T10:00:00+07:00')), { fromMonth: '2026-03', toMonth: '2026-08' });
});
