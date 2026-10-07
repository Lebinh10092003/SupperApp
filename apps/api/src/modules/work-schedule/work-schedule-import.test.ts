import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveImportReferences, validImportRows, validateEventImportRows, validateImportedEventConflicts, validateTaskImportRows } from './work-schedule-import.js';

test('V3 calendar import validates and normalizes preview rows without persistence', () => {
  const result = validateEventImportRows([{ title: 'Họp tuần', date: '07/10/2026', startTime: '08:00', endTime: '09:00', participantPerIds: 'PER.1; PER.2' }], 'PER.ME', new Date('2026-10-06T00:00:00+07:00'));
  assert.equal(result.errors.length, 0);
  assert.equal(result.normalized[0]?.chairPerId, 'PER.ME');
  assert.deepEqual(result.normalized[0]?.participantPerIds, ['PER.1', 'PER.2']);
  assert.equal(result.normalized[0]!.startAt!.toISOString(), '2026-10-07T01:00:00.000Z');
});

test('V3 import rejects ambiguous or invalid rows before apply', () => {
  const now = new Date('2026-10-06T00:00:00+07:00');
  const events = validateEventImportRows([{ title: '', date: 'tomorrow', startTime: 'morning' }], 'PER.ME', now);
  assert.ok(events.errors.some((error) => error.column === 'Tiêu đề'));
  assert.ok(events.errors.some((error) => error.column === 'Ngày/Giờ bắt đầu'));
  const tasks = validateTaskImportRows([{ title: 'Việc', startAt: '2026-10-08T10:00:00+07:00', dueAt: '2026-10-08T09:00:00+07:00' }], 'PER.ME', now);
  assert.ok(tasks.errors.some((error) => error.column === 'Hạn hoàn thành'));
  assert.ok(validateEventImportRows([], 'PER.ME', now).errors.some((error) => error.column === 'Tệp'));
  assert.ok(validateEventImportRows([{ title: 'Sai ngày', date: '31/02/2027', startTime: '08:00', scope: 'không rõ' }], 'PER.ME', now).errors.some((error) => error.column === 'Ngày/Giờ bắt đầu'));
  assert.ok(validateEventImportRows([{ title: 'Sai phạm vi', date: '07/10/2026', startTime: '08:00', scope: 'không rõ' }], 'PER.ME', now).errors.some((error) => error.column === 'Phạm vi'));
  assert.ok(validateTaskImportRows([{ title: 'Trễ', dueAt: '2026-10-05T09:00:00+07:00' }], 'PER.ME', now).errors.some((error) => error.message.includes('quá khứ')));
  assert.ok(validateTaskImportRows([{ title: 'Thiếu múi giờ', dueAt: '2026-10-08T09:00:00' }], 'PER.ME', now).errors.some((error) => error.column === 'Hạn hoàn thành'));
});

test('V4 import resolves Vietnamese campus/person names and rejects ambiguous names', () => {
  const people = [
    { perId: 'PER.A', name: 'Nguyễn Văn An' },
    { perId: 'PER.B', name: 'Trần Thị Bình' },
    { perId: 'PER.C', name: 'Trần Thị Bình' }
  ];
  const result = resolveImportReferences('events', [{ rowNumber: 2, campusId: 'Điểm trường chính', chairPerId: 'Nguyễn Văn An', participantPerIds: 'Trần Thị Bình' }], people);
  assert.equal(result.rows[0]?.campusId, 'MAIN_CAMPUS');
  assert.equal(result.rows[0]?.chairPerId, 'PER.A');
  assert.equal(result.errors[0]?.column, 'Thành phần');
  assert.match(result.errors[0]?.message || '', /trùng với 2 người/);
});

test('V4 import flags participant time conflicts and partitions valid rows', () => {
  const normalized = validateEventImportRows([
    { rowNumber: 2, title: 'Họp mới', date: '07/10/2026', startTime: '08:30', endTime: '09:30', chairPerId: 'PER.ME', participantPerIds: ['PER.A'] },
    { rowNumber: 3, title: 'Lịch hợp lệ', date: '08/10/2026', startTime: '08:30', endTime: '09:30', chairPerId: 'PER.ME', participantPerIds: ['PER.B'] }
  ], 'PER.ME', new Date('2026-10-06T00:00:00+07:00')).normalized;
  const errors = validateImportedEventConflicts(normalized, [{ id: 'existing', title: 'Họp cũ', startAt: new Date('2026-10-07T08:00:00+07:00'), endAt: new Date('2026-10-07T09:00:00+07:00'), chairPerId: 'PER.X', participantPerIds: ['PER.A'] }]);
  assert.equal(errors[0]?.row, 2);
  assert.deepEqual(validImportRows(normalized, errors).map((row) => row.rowNumber), [3]);
});
