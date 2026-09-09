import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db/client.js';
import { incidents } from './incidents.schema.js';
import { computeTrendAlerts } from './trend-alerts.js';

const skip = !process.env.DATABASE_URL;

// campusId RIÊNG của file này — `incidents` dùng chung với nhiều file
// test khác (xem mistake.md, quy ước chung cả dự án) — chỉ xoá đúng phạm
// vi campusId dùng ở đây.
const OWN_CAMPUS_IDS = ['TA_MAIN', 'TA_C1'];

async function resetTables() {
  const { inArray } = await import('drizzle-orm');
  await db.delete(incidents).where(inArray(incidents.campusId, OWN_CAMPUS_IDS));
}

function daysAgo(now: Date, n: number): Date {
  return new Date(now.getTime() - n * 24 * 3600 * 1000);
}

async function seedIncident(overrides: Partial<typeof incidents.$inferInsert> & { campusId: string; createdAt: Date }) {
  await db.insert(incidents).values({
    incidentId: 'SC.TA.TEST.' + crypto.randomUUID().slice(0, 8).toUpperCase(),
    categoryCode: 'facility_general',
    priority: 'P3',
    confidentiality: 'C1',
    state: 'Mới tiếp nhận',
    version: 1,
    updatedAt: overrides.createdAt,
    ...overrides
  });
}

const now = new Date('2026-08-25T09:00:00+07:00');

test('trendAlerts: nhóm P0/P1 (nặng) — ngưỡng 2 vụ / 5 ngày', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 3) });
  // Vụ thứ 3 cùng nhóm nhưng NGOÀI cửa sổ 5 ngày -> không được tính vào.
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 6) });

  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN'] }, { now });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.campus_id, 'TA_MAIN');
  assert.equal(alerts[0]!.category_code, 'violence_bullying');
  assert.equal(alerts[0]!.count, 2);
  assert.equal(alerts[0]!.severity, 'critical');
  assert.equal(alerts[0]!.window_days, 5);
});

test('trendAlerts: chưa đủ ngưỡng -> không sinh cảnh báo', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 1) });
  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN'] }, { now });
  assert.equal(alerts.length, 0);
});

test('trendAlerts: nhóm P2/P3 (nhẹ) — ngưỡng 4 vụ / 7 ngày', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 3; i++) await seedIncident({ campusId: 'TA_C1', categoryCode: 'facility_hygiene', createdAt: daysAgo(now, i) });
  let alerts = await computeTrendAlerts(db, { campusIds: ['TA_C1'] }, { now });
  assert.equal(alerts.length, 0);

  await seedIncident({ campusId: 'TA_C1', categoryCode: 'facility_hygiene', createdAt: daysAgo(now, 6) });
  alerts = await computeTrendAlerts(db, { campusIds: ['TA_C1'] }, { now });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.severity, 'warning');
  assert.equal(alerts[0]!.window_days, 7);
});

test('trendAlerts: campusIds giới hạn đúng phạm vi actor', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 2) });
  // Đủ ngưỡng ở TA_C1 nhưng actor KHÔNG được xem cơ sở này (không truyền vào campusIds).
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'weapon_drugs', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'weapon_drugs', createdAt: daysAgo(now, 2) });

  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN'] }, { now });
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0]!.campus_id, 'TA_MAIN');
});

test('trendAlerts: campusIds rỗng/không truyền -> quét TẤT CẢ cơ sở', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 2) });
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'weapon_drugs', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'weapon_drugs', createdAt: daysAgo(now, 2) });

  const alerts = await computeTrendAlerts(db, {}, { now });
  assert.equal(alerts.filter((a) => OWN_CAMPUS_IDS.includes(a.campus_id)).length, 2);
});

test('trendAlerts: category_code lạ/không nhận diện được -> bỏ qua, không throw', { skip }, async () => {
  await resetTables();
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'khong_ton_tai', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'khong_ton_tai', createdAt: daysAgo(now, 2) });
  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN'] }, { now });
  assert.equal(alerts.length, 0);
});

test('trendAlerts: không có incident nào -> mảng rỗng', { skip }, async () => {
  await resetTables();
  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN'] }, { now });
  assert.deepEqual(alerts, []);
});

test('trendAlerts: sắp xếp critical trước warning, nhiều vụ hơn trước', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 4; i++) await seedIncident({ campusId: 'TA_MAIN', categoryCode: 'facility_hygiene', createdAt: daysAgo(now, i) });
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 1) });
  await seedIncident({ campusId: 'TA_C1', categoryCode: 'violence_bullying', createdAt: daysAgo(now, 2) });

  const alerts = await computeTrendAlerts(db, { campusIds: ['TA_MAIN', 'TA_C1'] }, { now });
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0]!.severity, 'critical');
  assert.equal(alerts[1]!.severity, 'warning');
});
