import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { idCounters, publicCodes } from './ids.schema.js';
import { allocateSequentialId, allocatePublicCode, allocatePersonId, allocateRandomEvidenceId, yymm } from './ids.js';
import { ID_PREFIX } from './catalog.js';

const skip = !process.env.DATABASE_URL;

test('allocateSequentialId: cấp đúng định dạng, tăng dần, không trùng', { skip }, async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  const period = yymm(now);
  await db.delete(idCounters).where(eq(idCounters.prefix, ID_PREFIX.INCIDENT));

  const first = await allocateSequentialId(db, ID_PREFIX.INCIDENT, { now });
  const second = await allocateSequentialId(db, ID_PREFIX.INCIDENT, { now });

  assert.equal(first, `SC.${period}.0001`);
  assert.equal(second, `SC.${period}.0002`);

  await db.delete(idCounters).where(eq(idCounters.prefix, ID_PREFIX.INCIDENT));
});

test('allocateSequentialId: 50 lần gọi ĐỒNG THỜI vẫn ra đúng 50 mã KHÁC NHAU, không mất mã nào (thay cho việc chia mảnh)', { skip }, async () => {
  const now = new Date('2026-09-16T10:00:00Z');
  await db.delete(idCounters).where(eq(idCounters.prefix, ID_PREFIX.TASK));

  const results = await Promise.all(
    Array.from({ length: 50 }, () => allocateSequentialId(db, ID_PREFIX.TASK, { now }))
  );

  assert.equal(new Set(results).size, 50, 'không được có mã trùng nhau khi cấp đồng thời');
  const numbers = results.map((code) => Number(code.split('.')[2])).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 50 }, (_, i) => i + 1), 'phải lấp đầy đúng dải 1..50, không bỏ sót số nào');

  await db.delete(idCounters).where(eq(idCounters.prefix, ID_PREFIX.TASK));
});

test('allocatePublicCode: đúng định dạng GV-XXXX-XXXX, không trùng mã đã cấp trước đó', { skip }, async () => {
  const existingCode = 'GV-TEST-DUP1';
  await db.insert(publicCodes).values({ code: existingCode });
  try {
    const code = await allocatePublicCode(db);
    assert.match(code, /^GV-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    assert.notEqual(code, existingCode);
  } finally {
    await db.delete(publicCodes).where(eq(publicCodes.code, existingCode));
  }
});

test('allocatePersonId + allocateRandomEvidenceId: đúng định dạng, hàm thuần không cần DB', () => {
  assert.equal(allocatePersonId(42), 'PER.00000042');
  assert.match(allocateRandomEvidenceId(), /^MC\.[A-Z0-9]{16}$/);
});
