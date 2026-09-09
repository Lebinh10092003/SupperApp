import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import type { Actor } from './authz.js';
import { ROLE } from './catalog.js';
import { AppError } from './shared.js';
import { homeroomAssignments, gradeSupervisorAssignments, peopleDirectory } from '../identity/identity.schema.js';
import {
  upsertHomeroomAssignment,
  upsertGradeSupervisorAssignment,
  upsertPersonDirectoryEntry,
  getPersonDirectoryEntry
} from './directory-assignments.js';

function actor(overrides: Partial<Actor> = {}): Actor {
  return { perId: 'PER.DA_TEST', session: { valid: true, revoked: false }, roles: [], onDutyNow: false, activeDelegations: [], ...overrides };
}

const principal = () => actor({ roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] });
const teacher = () => actor({ roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01', ceiling: 'C1' }] });

test('upsertHomeroomAssignment: từ chối actor không có quyền catalog.edit', async () => {
  await assert.rejects(
    () => upsertHomeroomAssignment(db, { actor: teacher(), className: 'DA_TEST_8A1', perId: 'PER.GVCN1' }),
    (e: unknown) => e instanceof AppError && e.code === 'forbidden'
  );
});

test('upsertHomeroomAssignment: thiếu perId -> invalid_input', async () => {
  await assert.rejects(
    () => upsertHomeroomAssignment(db, { actor: principal(), className: 'DA_TEST_8A2', perId: '' }),
    (e: unknown) => e instanceof AppError && e.code === 'invalid_input'
  );
});

const skip = !process.env.DATABASE_URL;

test('upsertHomeroomAssignment: Hiệu trưởng ghi thật, upsert lần 2 ghi đè', { skip }, async () => {
  const className = `DA_TEST_${Date.now()}`;
  try {
    await upsertHomeroomAssignment(db, { actor: principal(), className, perId: 'PER.GVCN1', name: 'Cô A' });
    let [row] = await db.select().from(homeroomAssignments).where(eq(homeroomAssignments.className, className)).limit(1);
    assert.equal(row?.perId, 'PER.GVCN1');
    assert.equal(row?.name, 'Cô A');

    await upsertHomeroomAssignment(db, { actor: principal(), className, perId: 'PER.GVCN2', name: 'Thầy B' });
    [row] = await db.select().from(homeroomAssignments).where(eq(homeroomAssignments.className, className)).limit(1);
    assert.equal(row?.perId, 'PER.GVCN2');
    assert.equal(row?.name, 'Thầy B');
  } finally {
    await db.delete(homeroomAssignments).where(eq(homeroomAssignments.className, className));
  }
});

test('upsertGradeSupervisorAssignment: Hiệu trưởng ghi thật, upsert lần 2 ghi đè', { skip }, async () => {
  const grade = `DA_TEST_GRADE_${Date.now()}`;
  try {
    await upsertGradeSupervisorAssignment(db, { actor: principal(), grade, perId: 'PER.KHOI1' });
    let [row] = await db.select().from(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, grade)).limit(1);
    assert.equal(row?.perId, 'PER.KHOI1');

    await upsertGradeSupervisorAssignment(db, { actor: principal(), grade, perId: 'PER.KHOI2' });
    [row] = await db.select().from(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, grade)).limit(1);
    assert.equal(row?.perId, 'PER.KHOI2');
  } finally {
    await db.delete(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, grade));
  }
});

test('upsertPersonDirectoryEntry/getPersonDirectoryEntry: chỉ Hiệu trưởng/Phó HT được đọc/sửa', async () => {
  await assert.rejects(
    () => upsertPersonDirectoryEntry(db, { actor: teacher(), perId: 'PER.DA_TEST_X', email: 'a@b.com' }),
    (e: unknown) => e instanceof AppError && e.code === 'forbidden'
  );
  await assert.rejects(
    () => getPersonDirectoryEntry(db, { actor: teacher(), perId: 'PER.DA_TEST_X' }),
    (e: unknown) => e instanceof AppError && e.code === 'forbidden'
  );
});

test('upsertPersonDirectoryEntry + getPersonDirectoryEntry: ghi thật, đọc lại đúng email, merge giữ nguyên phone', { skip }, async () => {
  const perId = `PER.DA_TEST_${Date.now()}`;
  try {
    await db.insert(peopleDirectory).values({ perId, phone: '0900000000' });
    await upsertPersonDirectoryEntry(db, { actor: principal(), perId, email: 'giaovien@truong.edu.vn' });
    const result = await getPersonDirectoryEntry(db, { actor: principal(), perId });
    assert.equal(result.email, 'giaovien@truong.edu.vn');
    const [row] = await db.select().from(peopleDirectory).where(eq(peopleDirectory.perId, perId)).limit(1);
    assert.equal(row?.phone, '0900000000');
  } finally {
    await db.delete(peopleDirectory).where(eq(peopleDirectory.perId, perId));
  }
});

test('getPersonDirectoryEntry: perId không tồn tại -> email null', { skip }, async () => {
  const result = await getPersonDirectoryEntry(db, { actor: principal(), perId: `PER.DA_TEST_NOPE_${Date.now()}` });
  assert.equal(result.email, null);
});
