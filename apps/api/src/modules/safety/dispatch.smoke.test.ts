import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { peopleDirectory } from '../identity/identity.schema.js';
import { notifyRequests, pushTokens } from './dispatch.schema.js';
import { resolveContacts, dispatchRequest, type RequestData } from './dispatch.js';

/**
 * Port từ `functions/test/test-dispatch.js`. KHÁC BIỆT có chủ đích: bản
 * gốc dùng FakeFirestore, nơi `.set(..., {merge:true})` tự TẠO document
 * nếu chưa tồn tại — nên test gốc gọi `dispatchRequest` với object rời
 * rạc, không cần tạo trước `notify_requests` doc. Postgres không tự tạo
 * dòng khi UPDATE không khớp — production thật LUÔN tạo dòng qua
 * `notify.buildNotifyRequest()` + insert TRƯỚC khi gọi `dispatchRequest`
 * (dispatchRequest chỉ UPDATE dispatch_log/dispatched_at). Test dưới đây
 * insert sẵn 1 dòng stub tối thiểu trước mỗi lần gọi, đúng luồng thật.
 */

const skip = !process.env.DATABASE_URL;

async function stubNotifyRequest(id: string, overrides: Partial<RequestData> = {}) {
  await db.insert(notifyRequests).values({
    notifyRequestId: id,
    objectId: overrides.object_id ?? 'SC.STUB',
    urgency: 'normal',
    channels: overrides.channels ?? ['in_app'],
    recipients: overrides.recipients ?? [],
    message: overrides.message ?? 'stub',
    dedupeKeys: []
  });
}

async function cleanupNotifyRequests(...ids: string[]) {
  for (const id of ids) {
    await db.delete(notifyRequests).where(eq(notifyRequests.notifyRequestId, id));
  }
}

test('resolveContacts: chỉ trả về người ĐÃ khai báo trong people_directory, không trùng lặp', { skip }, async () => {
  await db.insert(peopleDirectory).values([
    { perId: 'PER.DISPATCH_TRUCBAN', email: 'trucban@thcsgiangvo.test', phone: '0900000001' },
    { perId: 'PER.DISPATCH_HIEUTRUONG', email: 'hieutruong@thcsgiangvo.test', phone: null }
  ]);
  try {
    const contacts = await resolveContacts(db, ['PER.DISPATCH_TRUCBAN', 'PER.DISPATCH_HIEUTRUONG', 'PER.DISPATCH_CHUA_KHAI_BAO', 'PER.DISPATCH_TRUCBAN']);
    assert.equal(Object.keys(contacts).length, 2);
    assert.ok(!contacts['PER.DISPATCH_CHUA_KHAI_BAO']);
  } finally {
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, 'PER.DISPATCH_TRUCBAN'));
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, 'PER.DISPATCH_HIEUTRUONG'));
  }
});

test('dispatchRequest: thiếu notify_request_id -> throw rõ ràng', { skip }, async () => {
  await assert.rejects(
    () => dispatchRequest(db, { recipients: [], channels: [] } as never, {}),
    /notify_request_id/
  );
});

test('dispatchRequest: kênh in_app không gọi adapter nào, chỉ đánh dấu đã lưu', { skip }, async () => {
  await stubNotifyRequest('NR.DISPATCH.001', { object_id: 'SC.001', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['in_app'] });
  try {
    const log = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.001', object_id: 'SC.001', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['in_app'], message: 'SC.001 — Khẩn cấp — Xác nhận'
    }, {}, { now: new Date('2026-08-21T08:00:00+07:00') });
    assert.equal(log.length, 1);
    assert.equal(log[0]?.status, 'stored_in_app');
  } finally {
    await cleanupNotifyRequests('NR.DISPATCH.001');
  }
});

test('dispatchRequest: kênh email/sms gửi qua adapter giả, ghi dispatch_log MERGE vào đúng dòng', { skip }, async () => {
  await db.insert(peopleDirectory).values([
    { perId: 'PER.DISPATCH_TRUCBAN', email: 'trucban@thcsgiangvo.test', phone: '0900000001' },
    { perId: 'PER.DISPATCH_HIEUTRUONG', email: 'hieutruong@thcsgiangvo.test', phone: null }
  ]);
  await stubNotifyRequest('NR.DISPATCH.002', { object_id: 'SC.002', recipients: ['PER.DISPATCH_TRUCBAN', 'PER.DISPATCH_HIEUTRUONG'], channels: ['email', 'sms'] });
  try {
    const sentCalls: Record<string, unknown>[] = [];
    const okAdapters = {
      email: { async send(msg: Record<string, unknown>) { sentCalls.push(msg); return { status: 'sent_test_ethereal', previewUrl: 'https://ethereal.example/msg/1' }; } },
      sms: { async send(msg: Record<string, unknown>) { sentCalls.push(msg); return { status: 'sent' }; } }
    };
    const message = 'SC.002 — P1 — Xác nhận đã nhận và tới hiện trường';
    const log = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.002', object_id: 'SC.002', recipients: ['PER.DISPATCH_TRUCBAN', 'PER.DISPATCH_HIEUTRUONG'], channels: ['email', 'sms'], message
    }, okAdapters, { now: new Date('2026-08-21T08:01:00+07:00') });

    const emailLogs = log.filter((l) => l.channel === 'email');
    const smsLogs = log.filter((l) => l.channel === 'sms');
    assert.equal(emailLogs.length, 2);
    assert.ok(emailLogs.every((l) => l.status === 'sent_test_ethereal' && l.preview_url));
    assert.equal(smsLogs.find((l) => l.per_id === 'PER.DISPATCH_TRUCBAN')?.status, 'sent');
    assert.equal(smsLogs.find((l) => l.per_id === 'PER.DISPATCH_HIEUTRUONG')?.status, 'skipped_no_contact');
    assert.ok(sentCalls.every((m) => m.text === message || m.body === message));

    const [saved] = await db.select().from(notifyRequests).where(eq(notifyRequests.notifyRequestId, 'NR.DISPATCH.002')).limit(1);
    assert.ok(Array.isArray(saved?.dispatchLog) && saved.dispatchLog.length === log.length);
  } finally {
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, 'PER.DISPATCH_TRUCBAN'));
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, 'PER.DISPATCH_HIEUTRUONG'));
    await cleanupNotifyRequests('NR.DISPATCH.002');
  }
});

test('dispatchRequest: kênh chưa cấu hình adapter -> no_adapter_configured, KHÔNG throw', { skip }, async () => {
  await stubNotifyRequest('NR.DISPATCH.003', { object_id: 'SC.003', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['voice_call'] });
  try {
    const log = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.003', object_id: 'SC.003', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['voice_call'], message: 'SC.003 — P0 — Khẩn cấp'
    }, {}, { now: new Date() });
    assert.equal(log.length, 1);
    assert.equal(log[0]?.status, 'no_adapter_configured');
  } finally {
    await cleanupNotifyRequests('NR.DISPATCH.003');
  }
});

test('dispatchRequest: 1 kênh lỗi KHÔNG làm hỏng toàn bộ luồng (ghi log lỗi, không throw)', { skip }, async () => {
  await db.insert(peopleDirectory).values({ perId: 'PER.DISPATCH_TRUCBAN', email: 'trucban@thcsgiangvo.test', phone: null });
  await stubNotifyRequest('NR.DISPATCH.004', { object_id: 'SC.004', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['email'] });
  try {
    const flakyAdapters = { email: { async send() { throw new Error('SMTP tạm thời không phản hồi'); } } };
    const log = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.004', object_id: 'SC.004', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['email'], message: 'SC.004 — cao — xem và xử lý'
    }, flakyAdapters, { now: new Date() });
    assert.equal(log.length, 1);
    assert.equal(log[0]?.status, 'error');
    assert.match(log[0]?.error ?? '', /SMTP/);
  } finally {
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, 'PER.DISPATCH_TRUCBAN'));
    await cleanupNotifyRequests('NR.DISPATCH.004');
  }
});

test('dispatchRequest: kênh push gửi tới TỪNG token, dọn token hết hạn (invalidToken)', { skip }, async () => {
  await db.insert(pushTokens).values([
    { token: 'token-dispatch-A', perId: 'PER.DISPATCH_TRUCBAN' },
    { token: 'token-dispatch-B', perId: 'PER.DISPATCH_TRUCBAN' },
    { token: 'token-dispatch-dead', perId: 'PER.DISPATCH_HIEUTRUONG' }
  ]);
  await stubNotifyRequest('NR.DISPATCH.005', { object_id: 'SC.005', recipients: ['PER.DISPATCH_TRUCBAN', 'PER.DISPATCH_CHUA_BAT_PUSH'], channels: ['push'] });
  await stubNotifyRequest('NR.DISPATCH.006', { object_id: 'SC.006', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['push'] });
  await stubNotifyRequest('NR.DISPATCH.007', { object_id: 'SC.007', recipients: ['PER.DISPATCH_HIEUTRUONG'], channels: ['push'] });
  try {
    const pushCalls: Record<string, unknown>[] = [];
    const pushAdapters = { push: { async send(msg: Record<string, unknown>) { pushCalls.push(msg); return { status: 'sent' }; } } };
    const message = 'SC.005 — P0 — Khẩn cấp';
    const log = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.005', object_id: 'SC.005', recipients: ['PER.DISPATCH_TRUCBAN', 'PER.DISPATCH_CHUA_BAT_PUSH'], channels: ['push'], message,
      event_type: 'safety.incident.p0_activated', urgency: 'p0'
    }, pushAdapters, { now: new Date() });
    assert.equal(log.filter((l) => l.per_id === 'PER.DISPATCH_TRUCBAN' && l.status === 'sent').length, 2);
    assert.ok(pushCalls.every((c) => ['token-dispatch-A', 'token-dispatch-B'].includes(c.to as string) && c.body === message && c.objectId === 'SC.005'));
    assert.equal(log.find((l) => l.per_id === 'PER.DISPATCH_CHUA_BAT_PUSH')?.status, 'skipped_no_contact');

    const logNoAdapter = await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.006', object_id: 'SC.006', recipients: ['PER.DISPATCH_TRUCBAN'], channels: ['push'], message: 'SC.006'
    }, {}, { now: new Date() });
    assert.equal(logNoAdapter.length, 1);
    assert.equal(logNoAdapter[0]?.status, 'no_adapter_configured');

    const invalidAdapter = { push: { async send() { return { status: 'error_invalid_token', invalidToken: true }; } } };
    await dispatchRequest(db, {
      notify_request_id: 'NR.DISPATCH.007', object_id: 'SC.007', recipients: ['PER.DISPATCH_HIEUTRUONG'], channels: ['push'], message: 'SC.007'
    }, invalidAdapter, { now: new Date() });
    const [tokenDoc] = await db.select().from(pushTokens).where(eq(pushTokens.token, 'token-dispatch-dead')).limit(1);
    assert.equal(tokenDoc, undefined, 'token hết hạn phải bị XOÁ khỏi push_tokens ngay sau khi gửi báo lỗi');
  } finally {
    await db.delete(pushTokens).where(eq(pushTokens.perId, 'PER.DISPATCH_TRUCBAN'));
    await db.delete(pushTokens).where(eq(pushTokens.perId, 'PER.DISPATCH_HIEUTRUONG'));
    await cleanupNotifyRequests('NR.DISPATCH.005', 'NR.DISPATCH.006', 'NR.DISPATCH.007');
  }
});
