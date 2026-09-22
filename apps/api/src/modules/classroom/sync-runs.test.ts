import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { can } from '../../auth/roles.js';
import { deleteSyncRun, rebuildClassesFromCourses } from './classroom.service.js';
import { courses, syncRuns } from './classroom.schema.js';
import { classes } from '../classes/classes.schema.js';
import { schedules } from '../schedules/schedules.schema.js';

test('Phân quyền: RUN_SYNC cho phép rollback và đồng bộ', () => {
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'RUN_SYNC'), true);
  assert.equal(can('SYSTEM_ADMIN', 'RUN_SYNC'), true);
  assert.equal(can('SCHOOL_ADMIN', 'RUN_SYNC'), true);
  assert.equal(can('PRINCIPAL', 'RUN_SYNC'), true);
  assert.equal(can('TEACHER', 'RUN_SYNC'), false);
  assert.equal(can('DATA_VIEWER', 'RUN_SYNC'), false);
});

test('Phân quyền: MANAGE_SCHEDULES cho phép quản lý CRUD lớp học', () => {
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_SCHEDULES'), true);
  assert.equal(can('SCHOOL_ADMIN', 'MANAGE_SCHEDULES'), true);
  assert.equal(can('PRINCIPAL', 'MANAGE_SCHEDULES'), true);
  assert.equal(can('VICE_PRINCIPAL', 'MANAGE_SCHEDULES'), true);
  assert.equal(can('TEACHER', 'MANAGE_SCHEDULES'), false);
  assert.equal(can('DATA_VIEWER', 'MANAGE_SCHEDULES'), false);
});

const skip = !process.env.DATABASE_URL;

const RUN_ID = 'TEST_SYNC_RUN_UNIT_01';
const COURSE_ID = 'TEST_SYNC_COURSE_01';
const CLASS_SYNC_ID = 'TEST_CLS_SYNC_01';
const CLASS_MANUAL_ID = 'TEST_CLS_MANUAL_01';

async function cleanup() {
  await db.delete(courses).where(eq(courses.id, COURSE_ID));
  await db.delete(syncRuns).where(eq(syncRuns.id, RUN_ID));
  await db.delete(classes).where(eq(classes.classId, CLASS_SYNC_ID));
  await db.delete(classes).where(eq(classes.classId, CLASS_MANUAL_ID));
}

test('deleteSyncRun & rebuildClassesFromCourses: rollback xoá khoá học và bảo vệ lớp thủ công', { skip }, async () => {
  await cleanup();

  // 1. Tạo phiên đồng bộ và khoá học thuộc phiên
  await db.insert(syncRuns).values({
    id: RUN_ID,
    type: 'CLASSROOM_SYNC',
    status: 'COMPLETED',
    performedBy: 'test@badinhedu.vn',
    coursesTotal: 1,
    coursesSuccess: 1,
    coursesError: 0
  });

  await db.insert(courses).values({
    id: COURSE_ID,
    name: 'Toán 12A1 Test Sync',
    classId: CLASS_SYNC_ID,
    className: 'Lớp 12A1 Test',
    grade: 12,
    syncRunId: RUN_ID,
    rosterStudents: 38,
    contentCoursework: 5,
    submissionsTotal: 20,
    submissionsTurnedIn: 18
  });

  // 2. Tạo lớp thủ công
  await db.insert(classes).values({
    classId: CLASS_MANUAL_ID,
    className: 'Lớp 12 Tin Thủ Công',
    grade: 12,
    source: 'MANUAL',
    homeroomTeacher: 'Thầy Thủ Công',
    expectedStudents: 42
  });

  // 3. Rebuild classes -> lớp sync được tạo, lớp thủ công giữ nguyên
  await rebuildClassesFromCourses();

  const syncClassBefore = await db.select().from(classes).where(eq(classes.classId, CLASS_SYNC_ID)).then((r) => r[0]);
  assert.ok(syncClassBefore, 'Lớp sync phải được tạo');
  assert.equal(syncClassBefore.source, 'CLASSROOM_SYNC');
  assert.equal(syncClassBefore.courseCount, 1);

  const manualClassBefore = await db.select().from(classes).where(eq(classes.classId, CLASS_MANUAL_ID)).then((r) => r[0]);
  assert.ok(manualClassBefore, 'Lớp thủ công phải tồn tại');
  assert.equal(manualClassBefore.source, 'MANUAL');
  assert.equal(manualClassBefore.homeroomTeacher, 'Thầy Thủ Công');

  // 4. Rollback phiên đồng bộ
  const result = await deleteSyncRun(RUN_ID);
  assert.equal(result.coursesDeleted, 1, 'Phải xoá đúng 1 khoá học của phiên');

  // Kiểm tra course và sync_run đã bị xoá
  const courseAfter = await db.select().from(courses).where(eq(courses.id, COURSE_ID)).then((r) => r[0]);
  assert.equal(courseAfter, undefined, 'Khoá học phải bị xoá');

  const runAfter = await db.select().from(syncRuns).where(eq(syncRuns.id, RUN_ID)).then((r) => r[0]);
  assert.equal(runAfter, undefined, 'Phiên đồng bộ phải bị xoá');

  // Lớp sync không có schedules -> phải bị xoá sau rollback
  const syncClassAfter = await db.select().from(classes).where(eq(classes.classId, CLASS_SYNC_ID)).then((r) => r[0]);
  assert.equal(syncClassAfter, undefined, 'Lớp sync không có TKB phải bị dọn sạch');

  // Lớp thủ công -> BẢO TOÀN NGUYÊN VẸN
  const manualClassAfter = await db.select().from(classes).where(eq(classes.classId, CLASS_MANUAL_ID)).then((r) => r[0]);
  assert.ok(manualClassAfter, 'Lớp thủ công không bao giờ bị xoá nhầm khi rollback');
  assert.equal(manualClassAfter.homeroomTeacher, 'Thầy Thủ Công');

  await cleanup();
});
