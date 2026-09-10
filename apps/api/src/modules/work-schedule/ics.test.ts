import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIcsCalendar } from './ics.js';

test('buildIcsCalendar: rỗng vẫn ra khung VCALENDAR hợp lệ', () => {
  const out = buildIcsCalendar([]);
  assert.match(out, /^BEGIN:VCALENDAR\r\n/);
  assert.match(out, /END:VCALENDAR\r\n$/);
  assert.doesNotMatch(out, /BEGIN:VEVENT/);
});

test('buildIcsCalendar: 1 sự kiện — đúng UID/DTSTART/DTEND/SUMMARY, giờ UTC dạng Z', () => {
  const out = buildIcsCalendar([
    {
      id: 'evt-1',
      title: 'Họp giao ban',
      description: 'Nội dung họp',
      location: 'Phòng A',
      startAt: new Date('2026-09-10T02:00:00.000Z'),
      endAt: new Date('2026-09-10T04:00:00.000Z'),
      updatedAt: new Date('2026-09-09T00:00:00.000Z')
    }
  ]);
  assert.match(out, /UID:evt-1@lich-cong-tac\.supperapp/);
  assert.match(out, /DTSTART:20260910T020000Z/);
  assert.match(out, /DTEND:20260910T040000Z/);
  assert.match(out, /SUMMARY:Họp giao ban/);
  assert.match(out, /DESCRIPTION:Nội dung họp/);
  assert.match(out, /LOCATION:Phòng A/);
});

test('buildIcsCalendar: escape đúng dấu phẩy/chấm phẩy/xuống dòng trong text field', () => {
  const out = buildIcsCalendar([
    {
      id: 'evt-2',
      title: 'Họp, bàn về; kế hoạch\nQuý 4',
      description: '',
      location: '',
      startAt: new Date('2026-09-10T00:00:00.000Z'),
      endAt: new Date('2026-09-10T01:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z')
    }
  ]);
  assert.match(out, /SUMMARY:Họp\\, bàn về\\; kế hoạch\\nQuý 4/);
});

test('buildIcsCalendar: bỏ qua DESCRIPTION/LOCATION khi rỗng', () => {
  const out = buildIcsCalendar([
    {
      id: 'evt-3',
      title: 'X',
      description: '',
      location: '',
      startAt: new Date('2026-09-10T00:00:00.000Z'),
      endAt: new Date('2026-09-10T01:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z')
    }
  ]);
  assert.doesNotMatch(out, /DESCRIPTION:/);
  assert.doesNotMatch(out, /LOCATION:/);
});

test('buildIcsCalendar: gấp dòng khi SUMMARY dài quá 75 ký tự (RFC 5545)', () => {
  const longTitle = 'A'.repeat(100);
  const out = buildIcsCalendar([
    {
      id: 'evt-4',
      title: longTitle,
      description: '',
      location: '',
      startAt: new Date('2026-09-10T00:00:00.000Z'),
      endAt: new Date('2026-09-10T01:00:00.000Z'),
      updatedAt: new Date('2026-09-10T00:00:00.000Z')
    }
  ]);
  const summaryLine = out.split('\r\n').find((l) => l.startsWith('SUMMARY:'));
  assert.ok(summaryLine);
  assert.ok(summaryLine!.length <= 75);
  // Dòng gấp tiếp theo phải bắt đầu bằng khoảng trắng.
  const allLines = out.split('\r\n');
  const idx = allLines.indexOf(summaryLine!);
  const nextLine = allLines[idx + 1];
  assert.ok(nextLine);
  assert.equal(nextLine![0], ' ');
});
