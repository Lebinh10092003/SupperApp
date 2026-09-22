import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { pushTokens } from './dispatch.schema.js';
import { registerPushToken, unregisterPushToken, resolvePushTokens, removeInvalidToken } from './push-notify.js';
import { HttpError } from '../../core/http.js';

const skip = !process.env.DATABASE_URL;

test('registerPushToken: lưu token mới, ghi đè khi đăng ký lại CÙNG token', { skip }, async () => {
  const now1 = new Date('2026-08-25T08:00:00+07:00');
  await registerPushToken(db, { perId: 'PER.TRUCBAN', token: 'tok-1', userAgent: 'Chrome/1' }, { now: now1 });
  try {
    const [doc1] = await db.select().from(pushTokens).where(eq(pushTokens.token, 'tok-1')).limit(1);
    assert.equal(doc1?.perId, 'PER.TRUCBAN');
    assert.equal(doc1?.userAgent, 'Chrome/1');

    const now2 = new Date('2026-08-25T09:00:00+07:00');
    await registerPushToken(db, { perId: 'PER.TRUCBAN', token: 'tok-1', userAgent: 'Chrome/2' }, { now: now2 });
    const [doc2] = await db.select().from(pushTokens).where(eq(pushTokens.token, 'tok-1')).limit(1);
    assert.equal(doc2?.userAgent, 'Chrome/2', 'đăng ký lại CÙNG token phải ghi đè, không tạo bản ghi mới');

    await assert.rejects(() => registerPushToken(db, { token: 'tok-2' } as never), (e: unknown) => e instanceof HttpError && /perId/.test(e.message));
    await assert.rejects(() => registerPushToken(db, { perId: 'PER.TRUCBAN' } as never), (e: unknown) => e instanceof HttpError && /token/.test(e.message));
  } finally {
    await db.delete(pushTokens).where(eq(pushTokens.token, 'tok-1'));
  }
});

test('resolvePushTokens: 1 người nhiều token, người khác chưa đăng ký -> mảng rỗng', { skip }, async () => {
  await db.insert(pushTokens).values([
    { token: 'tok-A', perId: 'PER.HIEUTRUONG' },
    { token: 'tok-B', perId: 'PER.HIEUTRUONG' },
    { token: 'tok-C', perId: 'PER.TRUCBAN' }
  ]);
  try {
    const map = await resolvePushTokens(db, ['PER.HIEUTRUONG', 'PER.TRUCBAN', 'PER.CHUA_DANG_KY']);
    assert.equal(map['PER.HIEUTRUONG']?.length, 2);
    assert.ok(map['PER.HIEUTRUONG']?.includes('tok-A') && map['PER.HIEUTRUONG']?.includes('tok-B'));
    assert.deepEqual(map['PER.TRUCBAN'], ['tok-C']);
    assert.deepEqual(map['PER.CHUA_DANG_KY'], []);

    const emptyMap = await resolvePushTokens(db, []);
    assert.equal(Object.keys(emptyMap).length, 0);
  } finally {
    await db.delete(pushTokens).where(eq(pushTokens.perId, 'PER.HIEUTRUONG'));
    await db.delete(pushTokens).where(eq(pushTokens.perId, 'PER.TRUCBAN'));
  }
});

test('unregisterPushToken / removeInvalidToken: xoá đúng token, không ảnh hưởng token khác', { skip }, async () => {
  await db.insert(pushTokens).values([
    { token: 'tok-X', perId: 'PER.TRUCBAN' },
    { token: 'tok-Y', perId: 'PER.TRUCBAN' }
  ]);
  await unregisterPushToken(db, { token: 'tok-X' });
  const afterUnregister = await resolvePushTokens(db, ['PER.TRUCBAN']);
  assert.deepEqual(afterUnregister['PER.TRUCBAN'], ['tok-Y']);

  await removeInvalidToken(db, 'tok-Y');
  const afterInvalid = await resolvePushTokens(db, ['PER.TRUCBAN']);
  assert.equal(afterInvalid['PER.TRUCBAN']?.length, 0);

  await assert.rejects(() => unregisterPushToken(db, {} as never));
  await assert.doesNotReject(() => removeInvalidToken(db, null));
});
