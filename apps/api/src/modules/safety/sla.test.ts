import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDeadline, DEFAULT_CALENDAR, addBusinessMinutes, slaMinutesFor,
  registerSlaClock, recomputeOnPriorityChange, pauseClock, resumeClock
} from './sla.js';

/** Port 1-1 từ `functions/test/test-sla.js` (bỏ 4 case riêng cho Firestore Timestamp giả — không còn ý nghĩa với Postgres, xem comment `toJsDate` trong sla.ts). */

test('P0/P1 tính theo giờ đồng hồ, không quan tâm giờ làm việc', () => {
  const fri2350 = new Date('2026-08-21T23:50:00+07:00');
  const p1Deadline = computeDeadline(fri2350, 'P1', 'ack');
  assert.equal(p1Deadline.getTime(), fri2350.getTime() + 5 * 60000);
});

test('P2/P3 tính theo giờ làm việc, vắt qua hết giờ làm thì cộng tiếp sang đầu ca hôm sau', () => {
  const fri1650 = new Date('2026-08-21T16:50:00+07:00'); // còn 10 phút hết giờ làm (17:00)
  const p2Deadline = computeDeadline(fri1650, 'P2', 'ack'); // P2 ack = 30 phút giờ làm việc
  const expected = new Date('2026-08-22T07:20:00+07:00'); // 10 phút hết hôm nay + 20 phút đầu ca hôm sau
  assert.equal(p2Deadline.getTime(), expected.getTime());
});

test('đồng hồ assign: đúng số phút SLA + đăng ký đúng hạn giờ đồng hồ', () => {
  assert.equal(slaMinutesFor('P0', 'assign'), 1);
  assert.equal(slaMinutesFor('P1', 'assign'), 15);
  assert.equal(slaMinutesFor('P2', 'assign'), 120);
  assert.equal(slaMinutesFor('P3', 'assign'), 480);

  const fri2350 = new Date('2026-08-21T23:50:00+07:00');
  const assignClockP1 = registerSlaClock({ objectId: 'SC.TEST', clockLabel: 'assign', priority: 'P1', startAt: fri2350 });
  assert.equal(assignClockP1.deadline_at.getTime(), fri2350.getTime() + 15 * 60000);
});

test('Chủ nhật không phải ngày làm việc — cộng giờ làm việc nhảy qua Chủ nhật sang thứ Hai', () => {
  const sat1655 = new Date('2026-08-22T16:55:00+07:00'); // thứ Bảy, còn 5 phút
  const deadline = addBusinessMinutes(sat1655, 10, DEFAULT_CALENDAR);
  const expectedMonday = new Date('2026-08-24T07:05:00+07:00');
  assert.equal(deadline.getTime(), expectedMonday.getTime());
});

test('quy tắc "không mất thời hạn": nâng mức siết lại hạn (giữ nguyên mốc bắt đầu), hạ mức không được kéo dài', () => {
  const start = new Date('2026-08-21T09:00:00+07:00');

  const clockP3 = registerSlaClock({ objectId: 'SC.2608.0001', clockLabel: 'ack', priority: 'P3', startAt: start });
  assert.equal(clockP3.deadline_at.getTime(), new Date('2026-08-21T13:00:00+07:00').getTime());

  const upgraded = recomputeOnPriorityChange(clockP3, { toPriority: 'P0' });
  assert.ok(upgraded.deadline_at.getTime() < clockP3.deadline_at.getTime(), 'nâng mức P3->P0 phải siết lại hạn (ngắn hơn)');
  assert.equal(upgraded.start_at.getTime(), start.getTime(), 'mốc bắt đầu giữ nguyên khi nâng mức');

  const clockP1 = registerSlaClock({ objectId: 'SC.2608.0002', clockLabel: 'ack', priority: 'P1', startAt: start });
  const downgraded = recomputeOnPriorityChange(clockP1, { toPriority: 'P3' });
  assert.equal(downgraded.deadline_at.getTime(), clockP1.deadline_at.getTime(), 'hạ mức P1->P3 KHÔNG được kéo dài hạn đã phát sinh');
});

test('tạm dừng bắt buộc lý do + người phê duyệt; tiếp tục cộng bù đúng thời gian tạm dừng', () => {
  const start = new Date('2026-08-21T09:00:00+07:00');
  const clockP3 = registerSlaClock({ objectId: 'SC.2608.0003', clockLabel: 'ack', priority: 'P3', startAt: start });

  assert.throws(() => pauseClock(clockP3, { approvedBy: 'PER.1' } as never), /lý do/);
  assert.throws(() => pauseClock(clockP3, { reason: 'Chờ công an' } as never), /phê duyệt/);

  const pausedAt = new Date('2026-08-21T10:00:00+07:00');
  const paused = pauseClock(clockP3, { reason: 'Chờ công an xác minh', approvedBy: 'PER.HIEUTRUONG', now: pausedAt });
  assert.equal(paused.paused, true);
  assert.equal(paused.status, 'paused');

  const resumedAt = new Date('2026-08-21T11:30:00+07:00'); // tạm dừng 90 phút
  const resumed = resumeClock(paused, { now: resumedAt });
  assert.equal(resumed.deadline_at.getTime(), clockP3.deadline_at.getTime() + 90 * 60000, 'cộng bù đúng thời gian đã tạm dừng, không bị trừ SLA');
  assert.equal(resumed.paused, false);
});
