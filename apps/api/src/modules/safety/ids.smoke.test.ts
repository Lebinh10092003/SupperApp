import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { idCounters, publicCodes } from './ids.schema.js';
import { allocateSequentialId, allocatePublicCode, allocatePersonId, allocateRandomEvidenceId } from './ids.js';
import { ID_PREFIX } from './catalog.js';

const skip = !process.env.DATABASE_URL;

/**
 * Kỳ (period) test RIÊNG, KHÔNG bao giờ trùng giá trị thật (`yymm()` gốc
 * luôn là 4 chữ số, VD "2609") — cô lập dòng đếm test khỏi dòng đếm THẬT
 * mà report-flow.ts/incident-lifecycle.ts đang dùng cùng prefix SC/NV khi
 * chạy song song file khác (node:test chạy nhiều FILE cùng lúc theo mặc
 * định). Trước đây dọn theo `eq(prefix)` (xoá HẾT dòng đếm của prefix đó,
 * kể cả dòng THẬT đang được request khác dùng) — Hestia phát hiện gây
 * trùng mã (tiền tố SC, tiền tố NV) khi chạy toàn bộ suite, đã xác nhận
 * không phải lỗi ở report-flow.ts. Sửa bằng cách dọn đúng (prefix, period)
 * test, không đụng dòng nào khác.
 */
const TEST_PERIOD_SEQUENTIAL = '99T1';
const TEST_PERIOD_CONCURRENT = '99T2';

test('allocateSequentialId: cấp đúng định dạng, tăng dần, không trùng', { skip }, async () => {
  const now = new Date('2026-09-15T10:00:00Z');
  await db.delete(idCounters).where(and(eq(idCounters.prefix, ID_PREFIX.INCIDENT), eq(idCounters.period, TEST_PERIOD_SEQUENTIAL)));

  const first = await allocateSequentialId(db, ID_PREFIX.INCIDENT, { now, period: TEST_PERIOD_SEQUENTIAL });
  const second = await allocateSequentialId(db, ID_PREFIX.INCIDENT, { now, period: TEST_PERIOD_SEQUENTIAL });

  assert.equal(first, `SC.${TEST_PERIOD_SEQUENTIAL}.0001`);
  assert.equal(second, `SC.${TEST_PERIOD_SEQUENTIAL}.0002`);

  await db.delete(idCounters).where(and(eq(idCounters.prefix, ID_PREFIX.INCIDENT), eq(idCounters.period, TEST_PERIOD_SEQUENTIAL)));
});

test('allocateSequentialId: 50 lần gọi ĐỒNG THỜI vẫn ra đúng 50 mã KHÁC NHAU, không mất mã nào (thay cho việc chia mảnh)', { skip }, async () => {
  const now = new Date('2026-09-16T10:00:00Z');
  await db.delete(idCounters).where(and(eq(idCounters.prefix, ID_PREFIX.TASK), eq(idCounters.period, TEST_PERIOD_CONCURRENT)));

  const results = await Promise.all(
    Array.from({ length: 50 }, () => allocateSequentialId(db, ID_PREFIX.TASK, { now, period: TEST_PERIOD_CONCURRENT }))
  );

  assert.equal(new Set(results).size, 50, 'không được có mã trùng nhau khi cấp đồng thời');
  const numbers = results.map((code) => Number(code.split('.')[2])).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 50 }, (_, i) => i + 1), 'phải lấp đầy đúng dải 1..50, không bỏ sót số nào');

  await db.delete(idCounters).where(and(eq(idCounters.prefix, ID_PREFIX.TASK), eq(idCounters.period, TEST_PERIOD_CONCURRENT)));
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
