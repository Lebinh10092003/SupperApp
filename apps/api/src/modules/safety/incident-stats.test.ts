import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeIncidentStats, type IncidentStatsRow } from './incident-stats.js';

function row(partial: Partial<IncidentStatsRow> & { incidentId: string; createdAt: Date }): IncidentStatsRow {
  return {
    campusId: 'MAIN_CAMPUS',
    categoryCode: 'facility_general',
    priority: 'P3',
    state: 'Mới tiếp nhận',
    closedAt: null,
    ...partial
  };
}

const now = new Date('2026-10-09T10:00:00+07:00');

test('incidentStats: rangeDays=null (toàn bộ) tính đúng tổng + byPriority/byState/byCampus', () => {
  const rows = [
    row({ incidentId: 'SC.1', createdAt: new Date('2026-01-01T00:00:00+07:00'), priority: 'P0', state: 'Đang xử lý', campusId: 'MAIN_CAMPUS' }),
    row({ incidentId: 'SC.2', createdAt: new Date('2026-05-01T00:00:00+07:00'), priority: 'P1', state: 'Đã đóng', campusId: 'CAMPUS_1', closedAt: new Date('2026-10-08T00:00:00+07:00') }),
    row({ incidentId: 'SC.3', createdAt: new Date('2026-10-01T00:00:00+07:00'), priority: 'P3', state: 'Mới tiếp nhận', campusId: 'MAIN_CAMPUS' })
  ];
  const result = computeIncidentStats(rows, { rangeDays: null }, { now });
  assert.equal(result.totalIncidents, 3);
  assert.equal(result.byPriority.P0, 1);
  assert.equal(result.byPriority.P1, 1);
  assert.equal(result.byCampus.MAIN_CAMPUS, 2);
  assert.equal(result.byCampus.CAMPUS_1, 1);
  // SC.1, SC.3 chưa đóng -> openCount = 2 (SC.2 đã đóng, không tính).
  assert.equal(result.openCount, 2);
});

test('incidentStats: rangeDays lọc đúng — vụ TRƯỚC khoảng xem không được tính vào total/byState', () => {
  const rows = [
    row({ incidentId: 'SC.OLD', createdAt: new Date('2026-01-01T00:00:00+07:00'), state: 'Đang xử lý' }),
    row({ incidentId: 'SC.NEW', createdAt: new Date('2026-10-05T00:00:00+07:00'), state: 'Mới tiếp nhận' })
  ];
  const result = computeIncidentStats(rows, { rangeDays: 7 }, { now });
  assert.equal(result.totalIncidents, 1);
  assert.equal(result.byState['Mới tiếp nhận'], 1);
  assert.equal(result.byState['Đang xử lý'], undefined);
});

test('incidentStats: closedInRange tính theo closedAt, KHÔNG theo createdAt — vụ phát sinh trước khoảng nhưng đóng trong khoảng vẫn được tính', () => {
  const rows = [
    row({
      incidentId: 'SC.1',
      createdAt: new Date('2026-01-01T00:00:00+07:00'),
      state: 'Đã đóng',
      closedAt: new Date('2026-10-08T00:00:00+07:00')
    })
  ];
  const result = computeIncidentStats(rows, { rangeDays: 7 }, { now });
  // Không nằm trong `totalIncidents` (tạo trước khoảng 7 ngày)...
  assert.equal(result.totalIncidents, 0);
  // ...nhưng đóng trong 7 ngày gần đây -> vẫn tính closedInRange.
  assert.equal(result.closedInRange, 1);
});

test('incidentStats: trend bucket theo NGÀY khi rangeDays<=90, phủ đủ mọi ngày kể cả ngày 0 vụ', () => {
  const rows = [row({ incidentId: 'SC.1', createdAt: new Date('2026-10-05T00:00:00+07:00') })];
  const result = computeIncidentStats(rows, { rangeDays: 7 }, { now });
  assert.equal(result.trendBucket, 'day');
  assert.equal(result.trend.length, 8); // 7 ngày trước .. hôm nay = 8 điểm
  const day5 = result.trend.find((t) => t.period === '2026-10-05');
  assert.ok(day5);
  assert.equal(day5!.count, 1);
  const day6 = result.trend.find((t) => t.period === '2026-10-06');
  assert.ok(day6);
  assert.equal(day6!.count, 0);
});

test('incidentStats: trend bucket theo THÁNG khi rangeDays=365', () => {
  const rows = [
    row({ incidentId: 'SC.1', createdAt: new Date('2026-03-15T00:00:00+07:00') }),
    row({ incidentId: 'SC.2', createdAt: new Date('2026-03-20T00:00:00+07:00') }),
    row({ incidentId: 'SC.3', createdAt: new Date('2026-10-01T00:00:00+07:00') })
  ];
  const result = computeIncidentStats(rows, { rangeDays: 365 }, { now });
  assert.equal(result.trendBucket, 'month');
  const march = result.trend.find((t) => t.period === '2026-03');
  assert.ok(march);
  assert.equal(march!.count, 2);
  const october = result.trend.find((t) => t.period === '2026-10');
  assert.ok(october);
  assert.equal(october!.count, 1);
});

test('incidentStats: không có hồ sơ nào -> trend vẫn phủ đủ khoảng, toàn 0, không throw', () => {
  const result = computeIncidentStats([], { rangeDays: 30 }, { now });
  assert.equal(result.totalIncidents, 0);
  assert.equal(result.trend.length, 31);
  assert.ok(result.trend.every((t) => t.count === 0));
});

test('incidentStats: rangeDays=null (toàn bộ) KHÔNG có hồ sơ nào -> trend rỗng (không có mốc để phủ)', () => {
  const result = computeIncidentStats([], { rangeDays: null }, { now });
  assert.equal(result.totalIncidents, 0);
  assert.deepEqual(result.trend, []);
});

test('incidentStats: fromDate/toDate tự chọn — lọc đúng khoảng, bỏ qua rangeDays khi cả 2 cùng truyền', () => {
  const rows = [
    row({ incidentId: 'SC.BEFORE', createdAt: new Date('2026-08-01T00:00:00+07:00') }),
    row({ incidentId: 'SC.IN', createdAt: new Date('2026-08-15T12:00:00+07:00') }),
    row({ incidentId: 'SC.AFTER', createdAt: new Date('2026-09-10T00:00:00+07:00') })
  ];
  const result = computeIncidentStats(rows, { fromDate: '2026-08-10', toDate: '2026-08-20', rangeDays: 7 }, { now });
  assert.equal(result.rangeDays, null);
  assert.equal(result.fromDate, '2026-08-10');
  assert.equal(result.toDate, '2026-08-20');
  assert.equal(result.totalIncidents, 1);
  assert.equal(result.rangeFrom, '2026-08-10');
  assert.equal(result.rangeTo, '2026-08-20');
});

test('incidentStats: fromDate/toDate bao gồm TRỌN ngày kết thúc (23:59:59), không cắt mất vụ xảy ra cuối ngày đó', () => {
  const rows = [row({ incidentId: 'SC.LATE', createdAt: new Date('2026-08-20T23:30:00+07:00') })];
  const result = computeIncidentStats(rows, { fromDate: '2026-08-10', toDate: '2026-08-20' }, { now });
  assert.equal(result.totalIncidents, 1);
});

test('incidentStats: chỉ truyền toDate (không có fromDate) -> không giới hạn mốc đầu, lấy từ hồ sơ sớm nhất', () => {
  const rows = [
    row({ incidentId: 'SC.1', createdAt: new Date('2025-01-01T00:00:00+07:00') }),
    row({ incidentId: 'SC.2', createdAt: new Date('2026-09-01T00:00:00+07:00') })
  ];
  const result = computeIncidentStats(rows, { toDate: '2026-09-15' }, { now });
  assert.equal(result.totalIncidents, 2);
  assert.equal(result.fromDate, null);
  assert.equal(result.toDate, '2026-09-15');
});

test('incidentStats: toDate ở TƯƠNG LAI bị chặn về hôm nay (now), không cho xem "tương lai"', () => {
  const rows = [row({ incidentId: 'SC.1', createdAt: now })];
  const result = computeIncidentStats(rows, { fromDate: '2026-10-01', toDate: '2099-01-01' }, { now });
  assert.equal(result.rangeTo, '2026-10-09');
});
