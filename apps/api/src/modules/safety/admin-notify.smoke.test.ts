import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { adminNotifications } from './admin-notify.schema.js';
import { pushAdminNotifications, markNotificationRead } from './admin-notify.js';

/** Port 1-1 từ `functions/test/test-adminNotify.js`. ID tiền tố `AN_` riêng, tránh đụng file test khác (core/db/README.md). */

const skip = !process.env.DATABASE_URL;

async function cleanup() {
  await db.delete(adminNotifications).where(inArray(adminNotifications.objectId, ['SC.AN_00000042', 'SC.AN_TEST']));
}

test('adminNotify: pushAdminNotifications — 1 bản ghi RIÊNG cho mỗi người nhận, khử trùng lặp, throw khi thiếu title/message', { skip }, async () => {
  await cleanup();
  try {
    const now = new Date('2026-08-21T09:00:00+07:00');
    const created = await pushAdminNotifications(db, {
      recipients: ['PER.AN_HIEUTRUONG', 'PER.AN_PHOHT_CS01', 'PER.AN_TRUCBAN'],
      title: 'Đã đổi người chỉ huy sự vụ',
      message: 'SC.AN_00000042: (chưa có) → PER.AN_TRUCBAN — PER.AN_HIEUTRUONG vừa cập nhật.',
      eventType: 'incident.reassign_commander',
      objectId: 'SC.AN_00000042',
      actorPerId: 'PER.AN_HIEUTRUONG',
      meta: { previousCommanderPerId: null, commanderPerId: 'PER.AN_TRUCBAN' }
    }, { now });
    assert.equal(created.length, 3);
    assert.equal(new Set(created.map((c) => c!.recipientPerId)).size, 3);
    assert.ok(created.every((c) => c!.read === false));
    assert.ok(created.every((c) => c!.actorPerId === 'PER.AN_HIEUTRUONG'));

    const savedForTrucBan = await db.select().from(adminNotifications).where(eq(adminNotifications.recipientPerId, 'PER.AN_TRUCBAN'));
    const match = savedForTrucBan.find((d) => d.eventType === 'incident.reassign_commander');
    assert.ok(match);
    assert.ok(match.message.includes('PER.AN_TRUCBAN'));

    const createdDedup = await pushAdminNotifications(db, {
      recipients: ['PER.AN_A', 'PER.AN_A', null, undefined, 'PER.AN_B'],
      title: 'Test khử trùng', message: 'nội dung test', objectId: 'SC.AN_TEST'
    }, { now });
    assert.equal(createdDedup.length, 2);

    await assert.rejects(() => pushAdminNotifications(db, { recipients: ['PER.AN_A'], title: '', message: 'x' } as never, {}), /title/);

    const target = created[0]!;
    await markNotificationRead(db, { notificationId: target.notificationId }, { now: new Date('2026-08-21T09:05:00+07:00') });
    const [afterRead] = await db.select().from(adminNotifications).where(eq(adminNotifications.notificationId, target.notificationId));
    assert.ok(afterRead);
    assert.equal(afterRead.read, true);
    assert.equal(afterRead.title, 'Đã đổi người chỉ huy sự vụ');

    await db.delete(adminNotifications).where(inArray(adminNotifications.recipientPerId, ['PER.AN_A', 'PER.AN_B']));
  } finally {
    await cleanup();
  }
});
