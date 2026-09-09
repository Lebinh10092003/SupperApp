import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterReportItems, filterIncidentItems, sortReportItemsDefault } from './report-filters.js';

test('filterReportItems: lọc theo campusId/categoryCodes/searchText', () => {
  const items = [
    { reportId: 'TB.1', publicCode: 'GV-AAA111', campusId: 'MAIN_CAMPUS', categoryCode: 'fire_explosion', content: 'Ổ điện có mùi khét ở hành lang' },
    { reportId: 'TB.2', publicCode: 'GV-BBB222', campusId: 'CAMPUS_1', categoryCode: 'violence_bullying', content: 'Bắt nạt ở sân trường' },
    { reportId: 'TB.3', publicCode: 'GV-CCC333', campusId: 'MAIN_CAMPUS', categoryCode: 'facility_general', content: 'Bàn ghế hỏng' }
  ];

  const byCampus = filterReportItems(items, { campusId: 'MAIN_CAMPUS' });
  assert.equal(byCampus.length, 2);
  assert.ok(byCampus.every((it) => it.campusId === 'MAIN_CAMPUS'));

  const byCategory = filterReportItems(items, { categoryCodes: ['violence_bullying', 'facility_general'] });
  assert.equal(byCategory.length, 2);

  const bySearchContent = filterReportItems(items, { searchText: 'bắt nạt' });
  assert.equal(bySearchContent.length, 1);
  assert.equal(bySearchContent[0]!.reportId, 'TB.2');

  const bySearchReportId = filterReportItems(items, { searchText: 'TB.3' });
  assert.equal(bySearchReportId.length, 1);
  assert.equal(bySearchReportId[0]!.reportId, 'TB.3');

  const bySearchPublicCode = filterReportItems(items, { searchText: 'gv-aaa111' });
  assert.equal(bySearchPublicCode.length, 1);
  assert.equal(bySearchPublicCode[0]!.reportId, 'TB.1');

  const combined = filterReportItems(items, { campusId: 'MAIN_CAMPUS', categoryCodes: ['facility_general'] });
  assert.equal(combined.length, 1);
  assert.equal(combined[0]!.reportId, 'TB.3');

  assert.equal(filterReportItems(items, {}).length, 3);
  assert.equal(filterReportItems(undefined, {}).length, 0);
});

test('filterIncidentItems: lọc theo campusId/categoryCodes/priorities/states/searchText', () => {
  const items = [
    { incident_id: 'SC.1', campus_id: 'MAIN_CAMPUS', category_code: 'fire_explosion', priority: 'P0', state: 'Khẩn cấp đang xử lý', class_name: null, assigned_task_per_ids: ['PER.1'] },
    { incident_id: 'SC.2', campus_id: 'CAMPUS_1', category_code: 'violence_bullying', priority: 'P1', state: 'Đang xử lý', class_name: '8A2', assigned_task_per_ids: ['PER.2'] },
    { incident_id: 'SC.3', campus_id: 'MAIN_CAMPUS', category_code: 'facility_general', priority: 'P3', state: 'Đã đóng', class_name: null, assigned_task_per_ids: ['PER.1', 'PER.2'] }
  ];

  assert.equal(filterIncidentItems(items, { campusId: 'MAIN_CAMPUS' }).length, 2);
  assert.equal(filterIncidentItems(items, { priorities: ['P0', 'P1'] }).length, 2);

  const byState = filterIncidentItems(items, { states: ['Đã đóng'] });
  assert.equal(byState.length, 1);
  assert.equal(byState[0]!.incident_id, 'SC.3');

  const byCategory = filterIncidentItems(items, { categoryCodes: ['violence_bullying'] });
  assert.equal(byCategory.length, 1);
  assert.equal(byCategory[0]!.incident_id, 'SC.2');

  const bySearchId = filterIncidentItems(items, { searchText: 'sc.1' });
  assert.equal(bySearchId.length, 1);
  assert.equal(bySearchId[0]!.incident_id, 'SC.1');

  const bySearchClass = filterIncidentItems(items, { searchText: '8a2' });
  assert.equal(bySearchClass.length, 1);
  assert.equal(bySearchClass[0]!.incident_id, 'SC.2');

  const combined = filterIncidentItems(items, { campusId: 'MAIN_CAMPUS', priorities: ['P3'] });
  assert.equal(combined.length, 1);
  assert.equal(combined[0]!.incident_id, 'SC.3');

  assert.equal(filterIncidentItems(items, {}).length, 3);
  assert.equal(filterIncidentItems(undefined, {}).length, 0);

  const onlyMine1 = filterIncidentItems(items, { onlyMinePerId: 'PER.1' });
  assert.equal(onlyMine1.length, 2);
  assert.ok(onlyMine1.every((it) => ['SC.1', 'SC.3'].includes(it.incident_id)));

  assert.equal(filterIncidentItems(items, { onlyMinePerId: 'PER.999' }).length, 0);

  const onlyMineCombined = filterIncidentItems(items, { onlyMinePerId: 'PER.1', priorities: ['P3'] });
  assert.equal(onlyMineCombined.length, 1);
  assert.equal(onlyMineCombined[0]!.incident_id, 'SC.3');

  assert.equal(filterIncidentItems(items, { onlyMinePerId: null }).length, 3);

  const itemsNoAssigned = [{ incident_id: 'SC.9', campus_id: 'MAIN_CAMPUS' }];
  assert.equal(filterIncidentItems(itemsNoAssigned, { onlyMinePerId: 'PER.1' }).length, 0);
});

test('filterReportItems: lọc theo stillDangerous + khoảng thời gian (occurredAt)', () => {
  const items = [
    { reportId: 'TB.1', stillDangerous: true, occurredAt: new Date('2026-08-20T08:00:00+07:00') },
    { reportId: 'TB.2', stillDangerous: false, occurredAt: new Date('2026-08-22T08:00:00+07:00') },
    { reportId: 'TB.3', stillDangerous: true, occurredAt: new Date('2026-08-24T08:00:00+07:00') }
  ];

  const onlyDangerous = filterReportItems(items, { stillDangerous: true });
  assert.equal(onlyDangerous.length, 2);
  assert.ok(onlyDangerous.every((it) => it.stillDangerous));

  const onlyNotDangerous = filterReportItems(items, { stillDangerous: false });
  assert.equal(onlyNotDangerous.length, 1);
  assert.equal(onlyNotDangerous[0]!.reportId, 'TB.2');

  assert.equal(filterReportItems(items, {}).length, 3);

  const byFrom = filterReportItems(items, { fromDate: '2026-08-22' });
  assert.equal(byFrom.length, 2);
  assert.ok(byFrom.every((it) => ['TB.2', 'TB.3'].includes(it.reportId)));

  const byTo = filterReportItems(items, { toDate: '2026-08-22' });
  assert.equal(byTo.length, 2);
  assert.ok(byTo.every((it) => ['TB.1', 'TB.2'].includes(it.reportId)));

  const byRange = filterReportItems(items, { fromDate: '2026-08-21', toDate: '2026-08-23' });
  assert.equal(byRange.length, 1);
  assert.equal(byRange[0]!.reportId, 'TB.2');

  const combinedDangerRange = filterReportItems(items, { stillDangerous: true, fromDate: '2026-08-21' });
  assert.equal(combinedDangerRange.length, 1);
  assert.equal(combinedDangerRange[0]!.reportId, 'TB.3');

  const itemsMissingDate = [{ reportId: 'TB.9', occurredAt: null }];
  assert.equal(filterReportItems(itemsMissingDate, { fromDate: '2026-08-01' }).length, 0);
});

test('sortReportItemsDefault: còn nguy hiểm lên đầu, cùng nhóm thì mới nhất trước', () => {
  const items = [
    { reportId: 'TB.1', stillDangerous: false, occurredAt: new Date('2026-08-24T08:00:00+07:00') },
    { reportId: 'TB.2', stillDangerous: true, occurredAt: new Date('2026-08-20T08:00:00+07:00') },
    { reportId: 'TB.3', stillDangerous: true, occurredAt: new Date('2026-08-23T08:00:00+07:00') },
    { reportId: 'TB.4', stillDangerous: false, occurredAt: new Date('2026-08-25T08:00:00+07:00') }
  ];
  const sorted = sortReportItemsDefault(items);
  assert.ok(sorted[0]!.stillDangerous && sorted[1]!.stillDangerous);
  assert.equal(sorted[0]!.reportId, 'TB.3');
  assert.equal(sorted[1]!.reportId, 'TB.2');
  assert.equal(sorted[2]!.reportId, 'TB.4');
  assert.equal(sorted[3]!.reportId, 'TB.1');
  assert.equal(items[0]!.reportId, 'TB.1'); // không sửa mảng gốc
  assert.equal(sortReportItemsDefault(undefined).length, 0);
});

test('filterIncidentItems: lọc theo khoảng thời gian (created_at)', () => {
  const items = [
    { incident_id: 'SC.1', created_at: new Date('2026-08-20T08:00:00+07:00') },
    { incident_id: 'SC.2', created_at: new Date('2026-08-22T08:00:00+07:00') },
    { incident_id: 'SC.3', created_at: new Date('2026-08-24T08:00:00+07:00') }
  ];
  const byRange = filterIncidentItems(items, { fromDate: '2026-08-21', toDate: '2026-08-23' });
  assert.equal(byRange.length, 1);
  assert.equal(byRange[0]!.incident_id, 'SC.2');
});
