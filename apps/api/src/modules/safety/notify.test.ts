import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  channelsFor, CHANNEL_LADDER, urgencyForPriority, renderMessage,
  buildNotifyRequest, dedupeKey, escalate, acknowledge
} from './notify.js';

/** Port 1-1 từ `functions/test/test-notify.js`. */

test('bậc thang kênh theo mức khẩn', () => {
  assert.deepEqual(channelsFor('p0'), ['in_app', 'push']);
  assert.equal(CHANNEL_LADDER.p0.simultaneous, true);
  assert.deepEqual(channelsFor('p1'), ['in_app', 'email', 'push']);
  assert.equal(CHANNEL_LADDER.normal.batch, true);
  assert.equal(urgencyForPriority('P0'), 'p0');
  assert.equal(urgencyForPriority('P1'), 'p1');
  assert.equal(urgencyForPriority('P2'), 'normal');
});

test('nội dung CHỈ gồm mã, mức độ, hành động, liên kết', () => {
  const msg = renderMessage({ objectCode: 'SC.2608.0042', levelLabel: 'P0 - Đỏ', actionNeeded: 'Xác nhận và tới hiện trường', deepLink: '/app/incidents/SC.2608.0042' });
  assert.equal(msg, 'SC.2608.0042 — P0 - Đỏ — Xác nhận và tới hiện trường — /app/incidents/SC.2608.0042');
  assert.throws(() => renderMessage({ actionNeeded: 'x' } as never));
});

test('chặn tham số nhạy cảm lọt vào yêu cầu thông báo', () => {
  assert.throws(() => buildNotifyRequest({
    recipients: ['PER.1'], priority: 'P0', objectId: 'SC.1', objectCode: 'SC.1',
    actionNeeded: 'Xử lý', extraParams: { victimName: 'Nguyễn Văn A' }
  }), /victimName/);
});

test('dedupe key ổn định và phân biệt theo người/sự kiện', () => {
  const k1 = dedupeKey('PER.1', 'SC.1', 'p0_activated');
  const k2 = dedupeKey('PER.1', 'SC.1', 'p0_activated');
  const k3 = dedupeKey('PER.2', 'SC.1', 'p0_activated');
  assert.equal(k1, k2);
  assert.notEqual(k1, k3);
});

test('buildNotifyRequest cho P0: require_ack, simultaneous, đủ dedupe key', () => {
  const req = buildNotifyRequest({
    recipients: ['PER.TRUCBAN', 'PER.HIEUTRUONG'], priority: 'P0', objectId: 'SC.2608.0042', objectCode: 'SC.2608.0042',
    levelLabel: 'P0 - Đỏ', actionNeeded: 'Xác nhận và tới hiện trường', deepLink: '/app/incidents/SC.2608.0042',
    eventType: 'safety.incident.p0_activated'
  });
  assert.equal(req.require_ack, true);
  assert.equal(req.simultaneous, true);
  assert.equal(req.dedupe_keys.length, 2);
});

test('chuyển cấp khi không có xác nhận (bậc thang 3 cấp)', () => {
  const ladder = ['PER.TRUCBAN', 'PER.HIEUTRUONG', 'PER.PHOHT_TRUC'];
  const reqBefore = buildNotifyRequest({ recipients: ['PER.TRUCBAN'], priority: 'P0', objectId: 'SC.1', objectCode: 'SC.1', actionNeeded: 'Xử lý' });

  const esc1 = escalate(reqBefore, { ladder });
  assert.equal(esc1.escalated, true);
  assert.equal(esc1.escalatedTo, 'PER.HIEUTRUONG');

  const esc2 = escalate(esc1.request, { ladder });
  assert.equal(esc2.escalatedTo, 'PER.PHOHT_TRUC');

  const esc3 = escalate(esc2.request, { ladder });
  assert.equal(esc3.escalated, false);
  assert.match(esc3.reason ?? '', /thủ công/);

  const acked = acknowledge(reqBefore, { perId: 'PER.TRUCBAN' });
  assert.ok(acked.ack_by.includes('PER.TRUCBAN'));
  assert.equal(acked.status, 'acknowledged');
});

test('mức normal không đòi hỏi chuyển cấp', () => {
  const ladder = ['PER.TRUCBAN', 'PER.HIEUTRUONG'];
  const normalReq = buildNotifyRequest({ recipients: ['PER.1'], priority: 'P3', objectId: 'SC.2', objectCode: 'SC.2', actionNeeded: 'Xem xét' });
  assert.equal(normalReq.require_ack, false);
  assert.equal(escalate(normalReq, { ladder }).escalated, false);
});
