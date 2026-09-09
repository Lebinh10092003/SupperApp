import { test } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../core/db/client.js';
import { incidents } from './incidents.schema.js';
import { campusZones, zoneCategories, campusMapMarkers } from './campus-zones.schema.js';
import * as zoneStats from './zoneStats.js';

const skip = !process.env.DATABASE_URL;

async function resetTables() {
  await db.delete(incidents);
  await db.delete(campusZones);
  await db.delete(zoneCategories);
  await db.delete(campusMapMarkers);
}

let seq = 0;
async function seedIncident(fields: Partial<typeof incidents.$inferInsert> & { incidentId: string }) {
  seq += 1;
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

test('zoneStats: campusId bắt buộc', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => zoneStats.computeZoneStats(db, {}), (e: any) => e instanceof zoneStats.AppError && e.code === 'invalid_input');
});

test('zoneStats: zone < 5 vụ -> breakdown_hidden, severity_flag vẫn tính đúng', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.1', zoneId: 'MC_GATE', priority: 'P0', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.2', zoneId: 'MC_GATE', priority: 'P3', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.3', zoneId: 'MC_GATE', priority: 'P3', createdAt: now, updatedAt: now });

  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_GATE');
  assert.ok(zone);
  assert.equal(zone!.total_count, '<5');
  assert.equal(zone!.breakdown_hidden, true);
  assert.equal(zone!.by_priority, null);
  assert.equal(zone!.by_category, null);
  assert.equal(zone!.trend, null);
  assert.equal(zone!.severity_flag, true);
});

test('zoneStats: zone 0 vụ thật sự -> total_count = 0 (không phải "<5")', { skip }, async () => {
  await resetTables();
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(result.zones.length, 0);
  assert.equal(result.unassigned_count, 0);
});

test('zoneStats: zone >= 5 vụ -> breakdown đầy đủ, nhóm nhỏ gộp "khac_it_gap"', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) {
    await seedIncident({ incidentId: 'SC.VB.' + i, zoneId: 'MC_YARD', priority: 'P2', categoryCode: 'violence_bullying', createdAt: now, updatedAt: now });
  }
  await seedIncident({ incidentId: 'SC.MM.1', zoneId: 'MC_YARD', priority: 'P3', categoryCode: 'medical_minor', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.FS.1', zoneId: 'MC_YARD', priority: 'P1', categoryCode: 'food_safety', createdAt: now, updatedAt: now });

  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_YARD')!;
  assert.equal(zone.total_count, 7);
  assert.equal(zone.breakdown_hidden, false);
  assert.equal(zone.by_priority!.P2, 5);
  assert.equal(zone.by_priority!.P3, 1);
  assert.equal(zone.by_priority!.P1, 1);
  assert.equal(zone.by_category!.violence_bullying, 5);
  assert.equal(zone.by_category!.khac_it_gap, 2);
  assert.equal(zone.by_category!.medical_minor, undefined);
  assert.equal(zone.by_category!.food_safety, undefined);
  assert.equal(zone.severity_flag, true);
  assert.equal(typeof zone.trend!.last_7d, 'number');
  assert.equal(typeof zone.trend!.last_30d, 'number');
  assert.equal(typeof zone.trend!.last_90d, 'number');
});

test('zoneStats: severity_flag = false khi không có P0/P1 trong tập lọc', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) {
    await seedIncident({ incidentId: 'SC.NOSEV.' + i, zoneId: 'MC_CANTEEN', priority: 'P3', categoryCode: 'facility_general', createdAt: now, updatedAt: now });
  }
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_CANTEEN')!;
  assert.equal(zone.severity_flag, false);
});

test('zoneStats: unassigned_count đếm đúng hồ sơ không có zone_id', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.UA.1', zoneId: null, createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.UA.2', zoneId: null, createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.UA.3', zoneId: 'MC_GATE', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(result.unassigned_count, 2);
});

test('zoneStats: lọc đúng theo campusId', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.C1.1', campusId: 'CAMPUS_1', zoneId: 'C1_GATE', createdAt: now, updatedAt: now });
  await seedIncident({ incidentId: 'SC.MC.1', campusId: 'MAIN_CAMPUS', zoneId: 'MC_GATE', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'CAMPUS_1' }, { now });
  assert.equal(result.campus_id, 'CAMPUS_1');
  assert.ok(!result.zones.some((z) => z.zone_id === 'MC_GATE'));
  assert.ok(result.zones.some((z) => z.zone_id === 'C1_GATE'));
});

test('zoneStats: lọc đúng theo categoryCodes', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.CAT.A.' + i, zoneId: 'MC_YARD', categoryCode: 'violence_bullying', priority: 'P2', createdAt: now, updatedAt: now });
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.CAT.B.' + i, zoneId: 'MC_YARD', categoryCode: 'facility_general', priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS', categoryCodes: ['violence_bullying'] }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_YARD')!;
  assert.deepEqual(result.category_filter, ['violence_bullying']);
  assert.equal(zone.total_count, 5);
});

test('zoneStats: lọc đúng theo rangeDays', { skip }, async () => {
  await resetTables();
  const old = new Date(now.getTime() - 100 * 24 * 3600 * 1000);
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.OLD.' + i, zoneId: 'MC_YARD', createdAt: old, updatedAt: old });

  const resultDefault = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(resultDefault.range_days, 90);
  assert.ok(!resultDefault.zones.some((z) => z.zone_id === 'MC_YARD'));

  const resultInvalid = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS', rangeDays: 999 }, { now });
  assert.equal(resultInvalid.range_days, 90);

  const result7 = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS', rangeDays: 7 }, { now });
  assert.equal(result7.range_days, 7);
});

test('zoneStats: trend tính độc lập với rangeDays/categoryCodes input', { skip }, async () => {
  await resetTables();
  const within7 = now;
  const within30 = new Date(now.getTime() - 20 * 24 * 3600 * 1000);
  for (let i = 0; i < 3; i++) await seedIncident({ incidentId: 'SC.TR7.' + i, zoneId: 'MC_BLOCK_A', categoryCode: 'facility_general', createdAt: within7, updatedAt: within7 });
  for (let i = 0; i < 2; i++) await seedIncident({ incidentId: 'SC.TR30.' + i, zoneId: 'MC_BLOCK_A', categoryCode: 'violence_bullying', createdAt: within30, updatedAt: within30 });

  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS', rangeDays: 7, categoryCodes: ['facility_general'] }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_BLOCK_A')!;
  assert.equal(zone.total_count, '<5');
  assert.equal(zone.breakdown_hidden, true);
  assert.equal(zone.trend, null);
});

test('zoneStats: trend độc lập filter khi breakdown KHÔNG bị ẩn', { skip }, async () => {
  await resetTables();
  const within7 = now;
  const within30 = new Date(now.getTime() - 20 * 24 * 3600 * 1000);
  const within90 = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.T7.' + i, zoneId: 'MC_ADMIN', categoryCode: 'facility_general', createdAt: within7, updatedAt: within7 });
  for (let i = 0; i < 2; i++) await seedIncident({ incidentId: 'SC.T30.' + i, zoneId: 'MC_ADMIN', categoryCode: 'other', createdAt: within30, updatedAt: within30 });
  await seedIncident({ incidentId: 'SC.T90.0', zoneId: 'MC_ADMIN', categoryCode: 'other', createdAt: within90, updatedAt: within90 });

  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS', rangeDays: 90, categoryCodes: ['facility_general'] }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_ADMIN')!;
  assert.equal(zone.total_count, 5);
  assert.equal(zone.trend!.last_7d, 5);
  assert.equal(zone.trend!.last_30d, 7);
  assert.equal(zone.trend!.last_90d, 8);
});

test('listCampusZones: trả đúng zone active, sắp theo order', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await db.insert(campusZones).values({ zoneId: 'Z2', campusId: 'MAIN_CAMPUS', label: 'B', order: 2, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z1', campusId: 'MAIN_CAMPUS', label: 'A', order: 1, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z3_inactive', campusId: 'MAIN_CAMPUS', label: 'C', order: 3, active: false, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z4_other_campus', campusId: 'CAMPUS_1', label: 'D', order: 1, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  const zones = await zoneStats.listCampusZones(db, { campusId: 'MAIN_CAMPUS' });
  assert.equal(zones.length, 2);
  assert.equal(zones[0]!.zoneId, 'Z1');
  assert.equal(zones[1]!.zoneId, 'Z2');
});

test('listAllCampusZones: trả cả zone đã tắt (active=false), đúng campus, sắp theo order', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await db.insert(campusZones).values({ zoneId: 'Z2', campusId: 'MAIN_CAMPUS', label: 'B', order: 2, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z1', campusId: 'MAIN_CAMPUS', label: 'A', order: 1, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z3_inactive', campusId: 'MAIN_CAMPUS', label: 'C', order: 3, active: false, polygonPercent: polygon, createdAt: now, updatedAt: now });
  await db.insert(campusZones).values({ zoneId: 'Z4_other_campus', campusId: 'CAMPUS_1', label: 'D', order: 1, active: true, polygonPercent: polygon, createdAt: now, updatedAt: now });
  const zones = await zoneStats.listAllCampusZones(db, { campusId: 'MAIN_CAMPUS' });
  assert.equal(zones.length, 3);
  assert.equal(zones[0]!.zoneId, 'Z1');
  assert.equal(zones[1]!.zoneId, 'Z2');
  assert.equal(zones[2]!.zoneId, 'Z3_inactive');

  await assert.rejects(() => zoneStats.listAllCampusZones(db, {}), (e: any) => e instanceof zoneStats.AppError);
});

test('upsertCampusZone: validate + set đúng schema', { skip }, async () => {
  await resetTables();
  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { campusId: 'MAIN_CAMPUS', label: 'Thiếu zoneId', polygonPercent: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] } as any),
    (e: any) => e instanceof zoneStats.AppError
  );
  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.X', campusId: 'MAIN_CAMPUS', label: 'polygon lỗi', polygonPercent: [{ x: 0, y: 0 }] }),
    (e: any) => e instanceof zoneStats.AppError
  );
  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.X', campusId: 'MAIN_CAMPUS', label: 'toạ độ ngoài 0-100', polygonPercent: [{ x: -1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }] }),
    (e: any) => e instanceof zoneStats.AppError
  );

  const res = await zoneStats.upsertCampusZone(
    db,
    { zoneId: 'Z.OK', campusId: 'MAIN_CAMPUS', label: 'Khu vực hợp lệ', order: 1, mapImageKey: 'main_v1', polygonPercent: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }] },
    { now }
  );
  assert.equal(res.zoneId, 'Z.OK');
  assert.equal(res.campusId, 'MAIN_CAMPUS');
  assert.equal(res.label, 'Khu vực hợp lệ');
  assert.equal(res.active, true);
  const [row] = await db.select().from(campusZones).where((await import('drizzle-orm')).eq(campusZones.zoneId, 'Z.OK'));
  assert.ok(row!.createdAt);

  const res2 = await zoneStats.upsertCampusZone(
    db,
    { zoneId: 'Z.OK', campusId: 'MAIN_CAMPUS', label: 'Đổi tên', order: 2, polygonPercent: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], active: false },
    { now: new Date(now.getTime() + 1000) }
  );
  assert.equal(res2.label, 'Đổi tên');
  assert.equal(res2.active, false);
});

test('upsertCampusZone: shape_type/category_id (mới)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  const legacy = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.LEGACY', campusId: 'MAIN_CAMPUS', label: 'Không truyền shapeType/categoryId', polygonPercent: polygon }, { now });
  assert.equal(legacy.shapeType, 'rect');
  assert.equal(legacy.categoryId, null);

  const circle = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.CIRCLE', campusId: 'MAIN_CAMPUS', label: 'Hình tròn', polygonPercent: polygon, shapeType: 'circle', categoryId: 'CAT.A' }, { now });
  assert.equal(circle.shapeType, 'circle');
  assert.equal(circle.categoryId, 'CAT.A');

  const invalidShape = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.INVALID_SHAPE', campusId: 'MAIN_CAMPUS', label: 'shapeType rác', polygonPercent: polygon, shapeType: 'hexagon' }, { now });
  assert.equal(invalidShape.shapeType, 'rect');
});

test('upsertCampusZone: color (mới — màu riêng khu vực, ưu tiên hơn màu nhóm)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  const omitted = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.COLOR_OMIT', campusId: 'MAIN_CAMPUS', label: 'Không truyền color', polygonPercent: polygon }, { now });
  assert.equal(omitted.color, null);

  const valid = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.COLOR_OK', campusId: 'MAIN_CAMPUS', label: 'Màu vàng riêng', polygonPercent: polygon, color: '#facc15' }, { now });
  assert.equal(valid.color, '#facc15');

  const invalid = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.COLOR_BAD', campusId: 'MAIN_CAMPUS', label: 'Màu rác', polygonPercent: polygon, color: 'not-a-color' }, { now });
  assert.equal(invalid.color, null);

  const cleared = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.COLOR_OK', campusId: 'MAIN_CAMPUS', label: 'Bỏ màu riêng', polygonPercent: polygon, color: null }, { now: new Date(now.getTime() + 1000) });
  assert.equal(cleared.color, null);
});

test('upsertCampusZone: rotation_deg (mới)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  const omitted = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.ROT_OMIT', campusId: 'MAIN_CAMPUS', label: 'Không truyền rotationDeg', polygonPercent: polygon }, { now });
  assert.equal(omitted.rotationDeg, 0);

  const normal = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.ROT_45', campusId: 'MAIN_CAMPUS', label: 'Xoay 45', polygonPercent: polygon, rotationDeg: 45 }, { now });
  assert.equal(normal.rotationDeg, 45);

  const negative = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.ROT_NEG', campusId: 'MAIN_CAMPUS', label: 'Xoay âm', polygonPercent: polygon, rotationDeg: -30 }, { now });
  assert.equal(negative.rotationDeg, 330);

  const over = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.ROT_OVER', campusId: 'MAIN_CAMPUS', label: 'Xoay vượt 360', polygonPercent: polygon, rotationDeg: 400 }, { now });
  assert.equal(over.rotationDeg, 40);
});

test('upsertCampusZone: 3 shape_type mới (l_shape/t_shape/triangle)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  for (const shapeType of ['l_shape', 't_shape', 'triangle']) {
    const res = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.' + shapeType.toUpperCase(), campusId: 'MAIN_CAMPUS', label: shapeType, polygonPercent: polygon, shapeType }, { now });
    assert.equal(res.shapeType, shapeType);
  }
});

test('campus_map_markers: upsertCampusMapMarker validate + set đúng schema', { skip }, async () => {
  await resetTables();
  await assert.rejects(
    () => zoneStats.upsertCampusMapMarker(db, { campusId: 'MAIN_CAMPUS', iconKey: 'restroom', xPercent: 50, yPercent: 50 } as any),
    (e: any) => e instanceof zoneStats.AppError && e.code === 'invalid_input'
  );
  await assert.rejects(() => zoneStats.upsertCampusMapMarker(db, { markerId: 'M.1', iconKey: 'restroom', xPercent: 50, yPercent: 50 } as any), (e: any) => e instanceof zoneStats.AppError);
  await assert.rejects(
    () => zoneStats.upsertCampusMapMarker(db, { markerId: 'M.1', campusId: 'MAIN_CAMPUS', iconKey: 'khong_hop_le', xPercent: 50, yPercent: 50 }),
    (e: any) => e instanceof zoneStats.AppError
  );
  await assert.rejects(
    () => zoneStats.upsertCampusMapMarker(db, { markerId: 'M.1', campusId: 'MAIN_CAMPUS', iconKey: 'restroom', xPercent: 150, yPercent: 50 }),
    (e: any) => e instanceof zoneStats.AppError
  );

  const res = await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.OK', campusId: 'MAIN_CAMPUS', iconKey: 'restroom', xPercent: 30, yPercent: 40, color: '#FF00AA' }, { now });
  assert.equal(res.markerId, 'M.OK');
  assert.equal(res.campusId, 'MAIN_CAMPUS');
  assert.equal(res.iconKey, 'restroom');
  assert.equal(res.xPercent, 30);
  assert.equal(res.yPercent, 40);
  assert.equal(res.color, '#FF00AA');
  assert.equal(res.active, true);

  const withoutColor = await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.NOCOLOR', campusId: 'MAIN_CAMPUS', iconKey: 'plant', xPercent: 10, yPercent: 10, color: 'khong-phai-hex' }, { now });
  assert.equal(withoutColor.color, null);
});

test('campus_map_markers: listCampusMapMarkers chỉ trả active đúng cơ sở', { skip }, async () => {
  await resetTables();
  await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.A1', campusId: 'MAIN_CAMPUS', iconKey: 'restroom', xPercent: 10, yPercent: 10 }, { now });
  await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.A2', campusId: 'MAIN_CAMPUS', iconKey: 'plant', xPercent: 20, yPercent: 20, active: false }, { now });
  await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.B1', campusId: 'CAMPUS_1', iconKey: 'trash', xPercent: 30, yPercent: 30 }, { now });
  const list = await zoneStats.listCampusMapMarkers(db, { campusId: 'MAIN_CAMPUS' });
  assert.equal(list.length, 1);
  assert.equal(list[0]!.markerId, 'M.A1');
});

test('campus_map_markers: deleteCampusMapMarker hard-delete', { skip }, async () => {
  await resetTables();
  await zoneStats.upsertCampusMapMarker(db, { markerId: 'M.DEL', campusId: 'MAIN_CAMPUS', iconKey: 'restroom', xPercent: 10, yPercent: 10 }, { now });
  await zoneStats.deleteCampusMapMarker(db, 'M.DEL');
  const list = await zoneStats.listCampusMapMarkers(db, { campusId: 'MAIN_CAMPUS' });
  assert.equal(list.length, 0);

  await assert.rejects(() => zoneStats.deleteCampusMapMarker(db, null as any), (e: any) => e instanceof zoneStats.AppError);
});

test('zone_categories: isValidHexColor', () => {
  assert.equal(zoneStats.isValidHexColor('#93C5FD'), true);
  assert.equal(zoneStats.isValidHexColor('#fff'), false);
  assert.equal(zoneStats.isValidHexColor('93C5FD'), false);
  assert.equal(zoneStats.isValidHexColor(''), false);
  assert.equal(zoneStats.isValidHexColor(null), false);
});

test('zone_categories: upsertZoneCategory validate + set đúng schema', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => zoneStats.upsertZoneCategory(db, { label: 'Thiếu categoryId', color: '#93C5FD' } as any), (e: any) => e instanceof zoneStats.AppError);
  await assert.rejects(() => zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.X', color: '#93C5FD' } as any), (e: any) => e instanceof zoneStats.AppError);
  await assert.rejects(() => zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.X', label: 'Khối lớp học', color: 'blue' }), (e: any) => e instanceof zoneStats.AppError);

  const res = await zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.CLASS', label: 'Khối lớp học', color: '#93C5FD', order: 1 }, { now });
  assert.equal(res.categoryId, 'CAT.CLASS');
  assert.equal(res.label, 'Khối lớp học');
  assert.equal(res.color, '#93C5FD');
  assert.equal(res.active, true);
  const { eq } = await import('drizzle-orm');
  const [row] = await db.select().from(zoneCategories).where(eq(zoneCategories.categoryId, 'CAT.CLASS'));
  assert.ok(row!.createdAt);
});

test('zone_categories: listZoneCategories chỉ trả active, sắp theo order', { skip }, async () => {
  await resetTables();
  await zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.B', label: 'Nhóm B', color: '#FBBF24', order: 2 }, { now });
  await zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.A', label: 'Nhóm A', color: '#93C5FD', order: 1 }, { now });
  await zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.OFF', label: 'Nhóm đã tắt', color: '#000000', order: 0, active: false }, { now });
  const list = await zoneStats.listZoneCategories(db);
  assert.equal(list.length, 2);
  assert.equal(list[0]!.categoryId, 'CAT.A');
  assert.equal(list[1]!.categoryId, 'CAT.B');
});

test('zone_categories: deleteZoneCategory chặn khi còn zone tham chiếu', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertZoneCategory(db, { categoryId: 'CAT.INUSE', label: 'Đang dùng', color: '#93C5FD' }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'Z.USES_CAT', campusId: 'MAIN_CAMPUS', label: 'Zone dùng nhóm', categoryId: 'CAT.INUSE', polygonPercent: polygon }, { now });

  await assert.rejects(() => zoneStats.deleteZoneCategory(db, 'CAT.INUSE'), (e: any) => e instanceof zoneStats.AppError && e.code === 'category_in_use');

  await zoneStats.upsertCampusZone(db, { zoneId: 'Z.USES_CAT', campusId: 'MAIN_CAMPUS', label: 'Zone dùng nhóm', active: false, polygonPercent: polygon }, { now });
  const res = await zoneStats.deleteZoneCategory(db, 'CAT.INUSE');
  assert.equal(res.ok, true);
  const afterList = await zoneStats.listZoneCategories(db);
  assert.ok(afterList.every((c) => c.categoryId !== 'CAT.INUSE'));

  await assert.rejects(() => zoneStats.deleteZoneCategory(db, null as any), (e: any) => e instanceof zoneStats.AppError);
});

test('normalizeForMatch: xử lý đúng có dấu/không dấu/hoa thường', () => {
  assert.equal(zoneStats.normalizeForMatch('Sân Khấu'), 'san khau');
  assert.equal(zoneStats.normalizeForMatch('Đoàn Đội'), 'doan doi');
  assert.equal(zoneStats.normalizeForMatch('  sân   khấu  '), 'san khau');
  assert.equal(zoneStats.normalizeForMatch('CANG TIN'), 'cang tin');
});

test('suggestZoneIdsFromContent: nhiều zone khi content nhắc nhiều địa điểm, rỗng khi không khớp', () => {
  const zones = [
    { zoneId: 'MC_STAGE', keywords: ['sân khấu', 'san khau'] },
    { zoneId: 'MC_YARD', keywords: ['sân trường', 'san truong'] },
    { zoneId: 'MC_GATE_1', keywords: ['cổng trường', 'cong truong'] }
  ];
  const matched = zoneStats.suggestZoneIdsFromContent('Học sinh ngã gần sân khấu, gần cổng trường luôn', zones);
  assert.ok(matched.includes('MC_STAGE'));
  assert.ok(matched.includes('MC_GATE_1'));
  assert.ok(!matched.includes('MC_YARD'));

  const noMatch = zoneStats.suggestZoneIdsFromContent('Nội dung không liên quan gì tới địa điểm', zones);
  assert.equal(noMatch.length, 0);
  assert.equal(zoneStats.suggestZoneIdsFromContent('', zones).length, 0);
  assert.equal(zoneStats.suggestZoneIdsFromContent(undefined, zones).length, 0);
});

test('computeZoneStats: 1 incident nhiều zone_ids -> vào total_count của CẢ 2 zone, không đếm đúp total_incidents_campus', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.MULTI.1', zoneIds: ['MC_BLOCK_A', 'MC_YARD'], priority: 'P2', createdAt: now, updatedAt: now });
  for (let i = 0; i < 4; i++) await seedIncident({ incidentId: 'SC.MULTI.FILL_A.' + i, zoneIds: ['MC_BLOCK_A'], priority: 'P3', createdAt: now, updatedAt: now });
  for (let i = 0; i < 4; i++) await seedIncident({ incidentId: 'SC.MULTI.FILL_Y.' + i, zoneIds: ['MC_YARD'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const zoneA = result.zones.find((z) => z.zone_id === 'MC_BLOCK_A')!;
  const zoneY = result.zones.find((z) => z.zone_id === 'MC_YARD')!;
  assert.equal(zoneA.total_count, 5);
  assert.equal(zoneY.total_count, 5);
  assert.equal(result.total_incidents_campus, 9);
});

test('computeZoneStats: document cũ chỉ có zone_id (không có zone_ids) vẫn group đúng qua fallback', { skip }, async () => {
  await resetTables();
  await seedIncident({ incidentId: 'SC.LEGACY.1', priority: 'P1', zoneId: 'MC_GATE_1', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const zone = result.zones.find((z) => z.zone_id === 'MC_GATE_1');
  assert.ok(zone);
  assert.equal(zone!.total_count, '<5');
  assert.equal(result.total_incidents_campus, 1);
});

test('computeZoneStats: cộng dồn cha-con (parent_zone_id) — cha 0 vụ trực tiếp + con 5 vụ', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertCampusZone(db, { zoneId: 'NHA_A', campusId: 'MAIN_CAMPUS', label: 'Nhà A', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'PHONG_8A1', campusId: 'MAIN_CAMPUS', label: '8A1', polygonPercent: polygon, parentZoneId: 'NHA_A' }, { now });
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.ROLLUP.' + i, zoneIds: ['PHONG_8A1'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const nhaA = result.zones.find((z) => z.zone_id === 'NHA_A');
  const phong = result.zones.find((z) => z.zone_id === 'PHONG_8A1');
  assert.ok(nhaA);
  assert.equal(nhaA!.total_count, 5);
  assert.equal(nhaA!.breakdown_hidden, false);
  assert.equal(nhaA!.descendant_count, 1);
  assert.ok(phong);
  assert.equal(phong!.total_count, 5);
  assert.equal(phong!.descendant_count, 0);
});

test('computeZoneStats: cộng dồn 3 tầng (ông-cha-con)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertCampusZone(db, { zoneId: 'CS2', campusId: 'MAIN_CAMPUS', label: 'Toàn cơ sở 2', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'NHA_B', campusId: 'MAIN_CAMPUS', label: 'Nhà B', polygonPercent: polygon, parentZoneId: 'CS2' }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'PHONG_9B1', campusId: 'MAIN_CAMPUS', label: '9B1', polygonPercent: polygon, parentZoneId: 'NHA_B' }, { now });
  for (let i = 0; i < 5; i++) await seedIncident({ incidentId: 'SC.DEEP.' + i, zoneIds: ['PHONG_9B1'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const cs2 = result.zones.find((z) => z.zone_id === 'CS2');
  const nhaB = result.zones.find((z) => z.zone_id === 'NHA_B');
  assert.ok(cs2);
  assert.equal(cs2!.total_count, 5);
  assert.equal(cs2!.descendant_count, 2);
  assert.ok(nhaB);
  assert.equal(nhaB!.total_count, 5);
  assert.equal(nhaB!.descendant_count, 1);
});

test('computeZoneStats: 1 incident gắn tay CẢ zone cha lẫn zone con -> không đếm đúp', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertCampusZone(db, { zoneId: 'NHA_C', campusId: 'MAIN_CAMPUS', label: 'Nhà C', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'PHONG_7C1', campusId: 'MAIN_CAMPUS', label: '7C1', polygonPercent: polygon, parentZoneId: 'NHA_C' }, { now });
  await seedIncident({ incidentId: 'SC.BOTH.0', zoneIds: ['NHA_C', 'PHONG_7C1'], priority: 'P3', createdAt: now, updatedAt: now });
  for (let i = 1; i < 5; i++) await seedIncident({ incidentId: 'SC.BOTH.' + i, zoneIds: ['PHONG_7C1'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const nhaC = result.zones.find((z) => z.zone_id === 'NHA_C');
  assert.ok(nhaC);
  assert.equal(nhaC!.total_count, 5);
});

test('computeZoneStats: k-anonymity áp theo số ĐÃ RỘI LÊN, không phải số riêng từng khu vực', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertCampusZone(db, { zoneId: 'NHA_D', campusId: 'MAIN_CAMPUS', label: 'Nhà D', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'PHONG_6D1', campusId: 'MAIN_CAMPUS', label: '6D1', polygonPercent: polygon, parentZoneId: 'NHA_D' }, { now });
  for (let i = 0; i < 2; i++) await seedIncident({ incidentId: 'SC.KANON.P.' + i, zoneIds: ['NHA_D'], priority: 'P3', createdAt: now, updatedAt: now });
  for (let i = 0; i < 3; i++) await seedIncident({ incidentId: 'SC.KANON.C.' + i, zoneIds: ['PHONG_6D1'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  const nhaD = result.zones.find((z) => z.zone_id === 'NHA_D');
  const phongD = result.zones.find((z) => z.zone_id === 'PHONG_6D1');
  assert.ok(nhaD);
  assert.equal(nhaD!.total_count, 5);
  assert.equal(nhaD!.breakdown_hidden, false);
  assert.ok(phongD);
  assert.equal(phongD!.total_count, '<5');
  assert.equal(phongD!.breakdown_hidden, true);
});

test('computeZoneStats: total_incidents_campus KHÔNG đổi bất kể cấu trúc cha-con', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
  await zoneStats.upsertCampusZone(db, { zoneId: 'NHA_E', campusId: 'MAIN_CAMPUS', label: 'Nhà E', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'PHONG_5E1', campusId: 'MAIN_CAMPUS', label: '5E1', polygonPercent: polygon, parentZoneId: 'NHA_E' }, { now });
  for (let i = 0; i < 6; i++) await seedIncident({ incidentId: 'SC.CAMPUSTOTAL.' + i, zoneIds: ['PHONG_5E1'], priority: 'P3', createdAt: now, updatedAt: now });
  const result = await zoneStats.computeZoneStats(db, { campusId: 'MAIN_CAMPUS' }, { now });
  assert.equal(result.total_incidents_campus, 6);
});

test('upsertCampusZone: validate parentZoneId (tự làm cha, khác cơ sở, vòng lặp)', { skip }, async () => {
  await resetTables();
  const polygon = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];

  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.SELF', campusId: 'MAIN_CAMPUS', label: 'Tự làm cha', polygonPercent: polygon, parentZoneId: 'Z.SELF' }, { now }),
    (e: any) => e instanceof zoneStats.AppError && e.code === 'invalid_input'
  );

  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.ORPHAN', campusId: 'MAIN_CAMPUS', label: 'Cha không tồn tại', polygonPercent: polygon, parentZoneId: 'KHONG_TON_TAI' }, { now }),
    (e: any) => e instanceof zoneStats.AppError
  );

  await zoneStats.upsertCampusZone(db, { zoneId: 'Z.OTHER_CAMPUS', campusId: 'CAMPUS_1', label: 'Zone cơ sở khác', polygonPercent: polygon }, { now });
  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.CROSS', campusId: 'MAIN_CAMPUS', label: 'Cha khác cơ sở', polygonPercent: polygon, parentZoneId: 'Z.OTHER_CAMPUS' }, { now }),
    (e: any) => e instanceof zoneStats.AppError
  );

  await zoneStats.upsertCampusZone(db, { zoneId: 'Z.A', campusId: 'MAIN_CAMPUS', label: 'A', polygonPercent: polygon }, { now });
  await zoneStats.upsertCampusZone(db, { zoneId: 'Z.B', campusId: 'MAIN_CAMPUS', label: 'B', polygonPercent: polygon, parentZoneId: 'Z.A' }, { now });
  await assert.rejects(
    () => zoneStats.upsertCampusZone(db, { zoneId: 'Z.A', campusId: 'MAIN_CAMPUS', label: 'A', polygonPercent: polygon, parentZoneId: 'Z.B' }, { now }),
    (e: any) => e instanceof zoneStats.AppError
  );

  const res = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.VALID_CHILD', campusId: 'MAIN_CAMPUS', label: 'Con hợp lệ', polygonPercent: polygon, parentZoneId: 'Z.A' }, { now });
  assert.equal(res.parentZoneId, 'Z.A');

  const resNoParent = await zoneStats.upsertCampusZone(db, { zoneId: 'Z.ROOT', campusId: 'MAIN_CAMPUS', label: 'Không cha', polygonPercent: polygon }, { now });
  assert.equal(resNoParent.parentZoneId, null);
});
