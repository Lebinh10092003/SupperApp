/**
 * directory-assignments.test.ts — test cho `upsertHomeroomAssignment`/
 * `upsertGradeSupervisorAssignment`/`deleteHomeroomAssignment`/
 * `deleteGradeSupervisorAssignment`/`listHomeroomAssignments`/
 * `listGradeSupervisorAssignments` — thêm 2026-09-21 cùng lúc nối 4 route
 * `/api/admin/homeroom-assignments*`/`/api/admin/grade-supervisor-assignments*`
 * (`admin.routes.ts`) lần đầu vào giao diện Quản trị (`SafetyUsersSection.tsx`).
 *
 * Tiền tố ID RIÊNG `DA_` cho file này — tránh đụng `homeroom_assignments`
 * dùng chung với `incident-lifecycle.test.ts` (tiền tố `IL_`) và
 * `report-flow.smoke.test.ts` (tiền tố khác) khi node:test chạy song song
 * nhiều file (xem `core/db/README.md`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { homeroomAssignments, gradeSupervisorAssignments } from '../identity/identity.schema.js';
import { ROLE } from './catalog.js';
import type { Actor } from './authz.js';
import {
  upsertHomeroomAssignment,
  upsertGradeSupervisorAssignment,
  deleteHomeroomAssignment,
  deleteGradeSupervisorAssignment,
  listHomeroomAssignments,
  listGradeSupervisorAssignments
} from './directory-assignments.js';

const skip = !process.env.DATABASE_URL;

const DA_CLASS_A = 'DA_8A1';
const DA_CLASS_B = 'DA_8A2';
const DA_GRADE_A = 'DA_8';
const DA_GRADE_B = 'DA_9';
const DA_CLASS_C = 'DA_8A3';
const DA_TEACHER = 'PER.DA_GVCN';
const DA_OTHER_TEACHER = 'PER.DA_GVCN_KHAC';

async function resetTables() {
  await db.delete(homeroomAssignments).where(eq(homeroomAssignments.className, DA_CLASS_A));
  await db.delete(homeroomAssignments).where(eq(homeroomAssignments.className, DA_CLASS_B));
  await db.delete(homeroomAssignments).where(eq(homeroomAssignments.className, DA_CLASS_C));
  await db.delete(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, DA_GRADE_A));
  await db.delete(gradeSupervisorAssignments).where(eq(gradeSupervisorAssignments.grade, DA_GRADE_B));
}

function principal(): Actor {
  return { perId: 'PER.DA_HIEUTRUONG', session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.PRINCIPAL, ceiling: 'C4' }] };
}

function teacherActor(): Actor {
  return { perId: DA_TEACHER, session: { valid: true, revoked: false }, roles: [{ roleId: ROLE.TEACHER, campusId: 'CS.01', ceiling: 'C1' }] };
}

test('upsertHomeroomAssignment: gán lớp -> list/đọc lại đúng; xoá -> hết', { skip }, async () => {
  await resetTables();
  await upsertHomeroomAssignment(db, { actor: principal(), className: DA_CLASS_A, perId: DA_TEACHER, name: 'Cô A' }, {});
  const list1 = await listHomeroomAssignments(db);
  assert.ok(list1.some((r) => r.className === DA_CLASS_A && r.perId === DA_TEACHER));

  await deleteHomeroomAssignment(db, { actor: principal(), className: DA_CLASS_A }, {});
  const list2 = await listHomeroomAssignments(db);
  assert.ok(!list2.some((r) => r.className === DA_CLASS_A));
});

test('upsertGradeSupervisorAssignment: gán khối -> list đúng; xoá -> hết', { skip }, async () => {
  await resetTables();
  await upsertGradeSupervisorAssignment(db, { actor: principal(), grade: DA_GRADE_A, perId: DA_TEACHER, name: 'Thầy B' }, {});
  const list1 = await listGradeSupervisorAssignments(db);
  assert.ok(list1.some((r) => r.grade === DA_GRADE_A && r.perId === DA_TEACHER));

  await deleteGradeSupervisorAssignment(db, { actor: principal(), grade: DA_GRADE_A }, {});
  const list2 = await listGradeSupervisorAssignments(db);
  assert.ok(!list2.some((r) => r.grade === DA_GRADE_A));
});

test('route PUT /homeroom-assignments/:perId (mô phỏng logic): gán lại lớp khác cho ĐÚNG 1 người tự xoá lớp cũ, không đụng người khác', { skip }, async () => {
  await resetTables();
  // Mô phỏng đúng logic route: xoá mọi dòng trỏ tới perId này trước, rồi upsert lớp mới.
  await upsertHomeroomAssignment(db, { actor: principal(), className: DA_CLASS_A, perId: DA_TEACHER, name: 'Cô A' }, {});
  await upsertHomeroomAssignment(db, { actor: principal(), className: DA_CLASS_B, perId: DA_OTHER_TEACHER, name: 'Cô khác' }, {});

  const existing = await listHomeroomAssignments(db);
  for (const row of existing) {
    if (row.perId === DA_TEACHER) await deleteHomeroomAssignment(db, { actor: principal(), className: row.className }, {});
  }
  await upsertHomeroomAssignment(db, { actor: principal(), className: DA_CLASS_C, perId: DA_TEACHER, name: 'Cô A' }, {});

  const after = await listHomeroomAssignments(db);
  assert.ok(!after.some((r) => r.className === DA_CLASS_A), 'lớp cũ của người này phải bị xoá');
  assert.ok(after.some((r) => r.className === DA_CLASS_C && r.perId === DA_TEACHER), 'lớp mới phải được gán đúng');
  assert.ok(after.some((r) => r.perId === DA_OTHER_TEACHER && r.className === DA_CLASS_B), 'không được đụng tới lớp của người khác');
});

test('upsertHomeroomAssignment: chặn quyền nếu actor không phải vai trò có catalog.edit', { skip }, async () => {
  await resetTables();
  await assert.rejects(() => upsertHomeroomAssignment(db, { actor: teacherActor(), className: DA_CLASS_A, perId: DA_TEACHER }, {}), /forbidden|Không có quyền/i);
});
