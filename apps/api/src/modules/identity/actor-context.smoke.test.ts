import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { accounts, assignments, dutyShifts, delegations } from './identity.schema.js';
import { loadActorContext } from './actor-context.js';
import { ROLE } from './roles.js';
import { HttpError } from '../../core/http.js';

const skip = !process.env.DATABASE_URL;

test('loadActorContext trả đúng roles còn hiệu lực, bỏ role hết hạn, tính đúng onDutyNow + activeDelegations', { skip }, async () => {
  const uid = `smoke-uid-${Date.now()}`;
  const perId = `PER_SMOKE_${Date.now()}`;
  const now = new Date('2026-06-15T08:00:00Z');

  await db.insert(accounts).values({ uid, perId, displayName: 'Smoke Test', email: 'smoke@example.edu.vn' });

  // Role còn hiệu lực (không giới hạn ngày).
  await db.insert(assignments).values({ perId, roleId: ROLE.TEACHER, campusId: 'MAIN_CAMPUS' });
  // Role đã HẾT HẠN — phải bị loại khỏi kết quả.
  await db.insert(assignments).values({
    perId, roleId: ROLE.DEPT_HEAD, campusId: 'MAIN_CAMPUS',
    toDate: new Date('2026-01-01T00:00:00Z')
  });
  // Role CHƯA tới ngày bắt đầu — cũng phải bị loại.
  await db.insert(assignments).values({
    perId, roleId: ROLE.PRINCIPAL,
    fromDate: new Date('2027-01-01T00:00:00Z')
  });

  // Đang trong ca trực.
  await db.insert(dutyShifts).values({
    perId, fromAt: new Date('2026-06-15T07:00:00Z'), toAt: new Date('2026-06-15T09:00:00Z')
  });

  // Uỷ quyền còn hiệu lực.
  await db.insert(delegations).values({
    toPerId: perId, campusId: 'CAMPUS_1',
    fromAt: new Date('2026-06-14T00:00:00Z'), toAt: new Date('2026-06-16T00:00:00Z')
  });

  try {
    const ctx = await loadActorContext(db, uid, now);
    assert.equal(ctx.perId, perId);
    assert.equal(ctx.roles.length, 1, 'chỉ role TEACHER còn hiệu lực được giữ lại');
    assert.equal(ctx.roles[0]?.roleId, ROLE.TEACHER);
    assert.equal(ctx.onDutyNow, true);
    assert.deepEqual(ctx.activeDelegations, [{ campusId: 'CAMPUS_1' }]);
  } finally {
    await db.delete(assignments).where(eq(assignments.perId, perId));
    await db.delete(dutyShifts).where(eq(dutyShifts.perId, perId));
    await db.delete(delegations).where(eq(delegations.toPerId, perId));
    await db.delete(accounts).where(eq(accounts.uid, uid));
  }
});

test('loadActorContext báo lỗi rõ ràng khi uid chưa có account (đúng thông điệp gốc)', { skip }, async () => {
  await assert.rejects(
    () => loadActorContext(db, 'uid-khong-ton-tai'),
    (error: unknown) => {
      assert.ok(error instanceof HttpError);
      assert.equal(error.status, 412);
      assert.equal(error.code, 'ACCOUNT_NOT_REGISTERED');
      return true;
    }
  );
});
