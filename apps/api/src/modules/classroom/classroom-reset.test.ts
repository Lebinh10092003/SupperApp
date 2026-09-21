import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { can } from '../../auth/roles.js';
import { resetClassroomData } from './classroom.service.js';
import {
  courses,
  courseMembers,
  courseCoursework,
  courseMaterials,
  courseAnnouncements,
  courseTopics,
  courseSubmissions,
  classMappings,
  subjectMappings
} from './classroom.schema.js';
import { people } from '../people/people.schema.js';
import { classes } from '../classes/classes.schema.js';
import { schedules } from '../schedules/schedules.schema.js';
import { googleConnections } from '../connections/connections.schema.js';

/**
 * Test cho resetClassroomData() (dùng bởi route POST
 * /api/connections/reset-classroom-data). Chạy trên Postgres THẬT (không
 * FakeFirestore) vì hàm này xoá/update theo bảng toàn cục — cần xác nhận
 * đúng phạm vi trên chính engine SQL thật (jsonb_array_length, transaction).
 */
const skip = !process.env.DATABASE_URL;

const COURSE_ID = 'RESET_TEST_COURSE_1';
const CLASS_WITHOUT_SCHEDULE = 'RESET_TEST_C1'; // chỉ có từ Classroom -> phải bị xoá hẳn
const CLASS_WITH_SCHEDULE = 'RESET_TEST_C2'; // có dòng TKB trỏ tới -> phải giữ lại bản ghi
const TEACHER_ID = 'reset-test-teacher-1';
const STUDENT_ID = 'reset-test-student-1';
const DIRECTORY_ONLY_ID = 'reset-test-directory-only-1'; // không có courses -> không được đụng tới
const CONN_ID = 'reset-test-conn-current';

async function cleanupAll() {
  await db.delete(courseSubmissions).where(eq(courseSubmissions.courseId, COURSE_ID));
  await db.delete(courseCoursework).where(eq(courseCoursework.courseId, COURSE_ID));
  await db.delete(courseMaterials).where(eq(courseMaterials.courseId, COURSE_ID));
  await db.delete(courseAnnouncements).where(eq(courseAnnouncements.courseId, COURSE_ID));
  await db.delete(courseTopics).where(eq(courseTopics.courseId, COURSE_ID));
  await db.delete(courseMembers).where(eq(courseMembers.courseId, COURSE_ID));
  await db.delete(classMappings).where(eq(classMappings.courseId, COURSE_ID));
  await db.delete(subjectMappings).where(eq(subjectMappings.courseId, COURSE_ID));
  await db.delete(courses).where(eq(courses.id, COURSE_ID));
  await db.delete(classes).where(eq(classes.classId, CLASS_WITHOUT_SCHEDULE));
  await db.delete(classes).where(eq(classes.classId, CLASS_WITH_SCHEDULE));
  await db.delete(schedules).where(eq(schedules.classId, CLASS_WITH_SCHEDULE));
  await db.delete(people).where(eq(people.personId, TEACHER_ID));
  await db.delete(people).where(eq(people.personId, STUDENT_ID));
  await db.delete(people).where(eq(people.personId, DIRECTORY_ONLY_ID));
  await db.delete(googleConnections).where(eq(googleConnections.id, CONN_ID));
}

async function seed() {
  await db.insert(courses).values({
    id: COURSE_ID,
    name: 'Toán RESET TEST',
    courseState: 'ACTIVE',
    classId: CLASS_WITHOUT_SCHEDULE,
    className: 'Lớp RESET_TEST_C1'
  });
  await db.insert(courseMembers).values({
    id: `${COURSE_ID}_${TEACHER_ID}`,
    courseId: COURSE_ID,
    userId: TEACHER_ID,
    role: 'TEACHER'
  });
  await db.insert(courseCoursework).values({
    id: `${COURSE_ID}_cw1`,
    courseId: COURSE_ID,
    courseWorkId: 'cw1',
    data: { id: 'cw1' }
  });
  await db.insert(courseMaterials).values({ id: `${COURSE_ID}_m1`, courseId: COURSE_ID, data: { id: 'm1' } });
  await db.insert(courseAnnouncements).values({ id: `${COURSE_ID}_a1`, courseId: COURSE_ID, data: { id: 'a1' } });
  await db.insert(courseTopics).values({ id: `${COURSE_ID}_t1`, courseId: COURSE_ID, data: { id: 't1' } });
  await db.insert(courseSubmissions).values({
    id: `${COURSE_ID}_s1`,
    courseId: COURSE_ID,
    data: { id: 's1' }
  });
  await db.insert(classMappings).values({
    courseId: COURSE_ID,
    courseName: 'Toán RESET TEST',
    classId: CLASS_WITHOUT_SCHEDULE,
    className: 'Lớp RESET_TEST_C1',
    confidence: '0.90'
  });
  await db.insert(subjectMappings).values({
    courseId: COURSE_ID,
    courseName: 'Toán RESET TEST',
    subjectId: 'TOAN',
    subjectName: 'Toán Học',
    confidence: '0.90'
  });

  // Lớp KHÔNG có lịch học nào khác -> phải bị xoá hẳn.
  await db.insert(classes).values({
    classId: CLASS_WITHOUT_SCHEDULE,
    className: 'Lớp RESET_TEST_C1',
    courseCount: 1,
    courses: [COURSE_ID],
    studentCount: 5
  });

  // Lớp CÓ 1 dòng thời khóa biểu trỏ tới (nguồn khác, không phải Classroom)
  // -> phải giữ lại bản ghi, chỉ reset số liệu tổng hợp từ Classroom.
  await db.insert(classes).values({
    classId: CLASS_WITH_SCHEDULE,
    className: 'Lớp RESET_TEST_C2',
    grade: 7,
    homeroomTeacher: 'Cô RESET TEST',
    courseCount: 3,
    courses: [COURSE_ID],
    subjects: ['Toán Học'],
    studentCount: 40,
    totalCoursework: 12,
    submissionsTotal: 100,
    submissionsTurnedIn: 90,
    submissionsLate: 2,
    completionRate: '90.0',
    onTimeRate: '88.0',
    averageScore: '8.5'
  });
  await db.insert(schedules).values({
    dayOfWeek: 2,
    period: 1,
    startTime: '07:00',
    endTime: '07:45',
    classId: CLASS_WITH_SCHEDULE,
    className: 'Lớp RESET_TEST_C2',
    subject: 'Toán Học',
    teacherEmail: 'reset-test-teacher@thcsgiangvo.edu.vn',
    schoolYear: '2025-2026',
    semester: 'HK1',
    source: 'MANUAL'
  });

  // Người có dữ liệu Classroom -> courses/classId/className phải bị reset.
  await db.insert(people).values({
    personId: TEACHER_ID,
    personType: 'TEACHER',
    email: 'reset-test-teacher@thcsgiangvo.edu.vn',
    displayName: 'Cô RESET TEST',
    orgUnitPath: '/Giáo viên',
    className: 'Lớp RESET_TEST_C1',
    classId: CLASS_WITHOUT_SCHEDULE,
    courses: [COURSE_ID]
  });
  await db.insert(people).values({
    personId: STUDENT_ID,
    personType: 'STUDENT',
    email: 'reset-test-student@thcsgiangvo.edu.vn',
    displayName: 'Em RESET TEST',
    orgUnitPath: '/Học sinh',
    className: 'Lớp RESET_TEST_C1',
    classId: CLASS_WITHOUT_SCHEDULE,
    courses: [COURSE_ID]
  });

  // Người CHỈ có từ Directory sync (không có Classroom) -> KHÔNG được đụng.
  await db.insert(people).values({
    personId: DIRECTORY_ONLY_ID,
    personType: 'TEACHER',
    email: 'reset-test-directory-only@thcsgiangvo.edu.vn',
    displayName: 'Thầy Chỉ Directory',
    orgUnitPath: '/Giáo viên',
    className: null,
    classId: null,
    courses: []
  });

  // Kết nối Google (token) -> route reset KHÔNG được đụng, đây là việc của
  // route /disconnect riêng.
  await db.insert(googleConnections).values({ id: CONN_ID, uid: 'x', email: 'x@thcsgiangvo.edu.vn', accessToken: 'fake-token' });
}

test('resetClassroomData: chặn đúng quyền — vai trò không đủ (MANAGE_CONNECTIONS)', () => {
  assert.equal(can('TEACHER', 'MANAGE_CONNECTIONS'), false);
  assert.equal(can('VIEWER', 'MANAGE_CONNECTIONS'), false);
  assert.equal(can('SCHOOL_ADMIN', 'MANAGE_CONNECTIONS'), true);
  assert.equal(can('SYSTEM_SUPER_ADMIN', 'MANAGE_CONNECTIONS'), true);
});

test('resetClassroomData: xoá đúng phạm vi Classroom, bảo toàn dữ liệu nguồn khác', { skip }, async () => {
  await cleanupAll();
  try {
    await seed();

    const result = await resetClassroomData();

    assert.ok(result.courses >= 1, 'phải đếm được ít nhất 1 course đã xoá (course seed)');
    assert.ok(result.courseMembers >= 1);
    assert.ok(result.courseCoursework >= 1);
    assert.ok(result.courseMaterials >= 1);
    assert.ok(result.courseAnnouncements >= 1);
    assert.ok(result.courseTopics >= 1);
    assert.ok(result.courseSubmissions >= 1);
    assert.ok(result.classMappings >= 1);
    assert.ok(result.subjectMappings >= 1);
    assert.ok(result.classesDeleted >= 1);
    assert.ok(result.classesReset >= 1);
    assert.ok(result.teachers >= 1);
    assert.ok(result.students >= 1);

    // (a) Dữ liệu Classroom bị xoá sạch.
    const remainingCourses = await db.select().from(courses);
    assert.equal(remainingCourses.length, 0, 'bảng courses phải rỗng sau reset');
    const remainingMembers = await db.select().from(courseMembers).where(eq(courseMembers.courseId, COURSE_ID));
    assert.equal(remainingMembers.length, 0);
    const remainingMappings = await db.select().from(classMappings).where(eq(classMappings.courseId, COURSE_ID));
    assert.equal(remainingMappings.length, 0);

    // Lớp thuần Classroom (không có TKB) -> bị xoá hẳn.
    const classWithoutSchedule = await db.select().from(classes).where(eq(classes.classId, CLASS_WITHOUT_SCHEDULE));
    assert.equal(classWithoutSchedule.length, 0, 'lớp không có TKB trỏ tới phải bị xoá hẳn');

    // Lớp có TKB trỏ tới -> vẫn còn, nhưng số liệu tổng hợp từ Classroom về 0/rỗng,
    // còn className/grade/homeroomTeacher (thuộc nguồn khác) giữ nguyên.
    const [classWithSchedule] = await db.select().from(classes).where(eq(classes.classId, CLASS_WITH_SCHEDULE));
    assert.ok(classWithSchedule, 'lớp có TKB trỏ tới phải được GIỮ LẠI, không xoá');
    assert.equal(classWithSchedule.courseCount, 0);
    assert.deepEqual(classWithSchedule.courses, []);
    assert.deepEqual(classWithSchedule.subjects, []);
    assert.equal(classWithSchedule.studentCount, 0);
    assert.equal(classWithSchedule.totalCoursework, 0);
    assert.equal(classWithSchedule.submissionsTotal, 0);
    assert.equal(classWithSchedule.completionRate, null);
    assert.equal(classWithSchedule.averageScore, null);
    assert.equal(classWithSchedule.className, 'Lớp RESET_TEST_C2', 'className thuộc nguồn schedules, không bị đụng');
    assert.equal(classWithSchedule.grade, 7, 'grade thuộc nguồn schedules, không bị đụng');
    assert.equal(classWithSchedule.homeroomTeacher, 'Cô RESET TEST', 'homeroomTeacher không do rebuildClassesFromCourses ghi, không bị đụng');

    // people có dữ liệu Classroom -> courses/classId/className được reset,
    // nhưng bản ghi vẫn còn (không xoá người).
    const [teacherRow] = await db.select().from(people).where(eq(people.personId, TEACHER_ID));
    assert.ok(teacherRow, 'không được xoá bản ghi people của giáo viên');
    assert.deepEqual(teacherRow.courses, []);
    assert.equal(teacherRow.classId, null);
    assert.equal(teacherRow.className, null);
    assert.equal(teacherRow.email, 'reset-test-teacher@thcsgiangvo.edu.vn', 'các cột khác không bị đụng');

    const [studentRow] = await db.select().from(people).where(eq(people.personId, STUDENT_ID));
    assert.ok(studentRow);
    assert.deepEqual(studentRow.courses, []);
    assert.equal(studentRow.classId, null);

    // (b) Người CHỈ đến từ Directory sync -> hoàn toàn không bị đụng.
    const [directoryOnlyRow] = await db.select().from(people).where(eq(people.personId, DIRECTORY_ONLY_ID));
    assert.ok(directoryOnlyRow, 'không được xoá người chỉ có từ Directory sync');
    assert.equal(directoryOnlyRow.displayName, 'Thầy Chỉ Directory');
    assert.equal(directoryOnlyRow.email, 'reset-test-directory-only@thcsgiangvo.edu.vn');
    assert.deepEqual(directoryOnlyRow.courses, []);

    // (b) googleConnections (token kết nối) không bị đụng — route reset không ngắt kết nối.
    const [connRow] = await db.select().from(googleConnections).where(eq(googleConnections.id, CONN_ID));
    assert.ok(connRow, 'không được xoá google_connections — đó là việc của route /disconnect riêng');
    assert.equal(connRow.accessToken, 'fake-token');

    // Gọi lại lần 2 trên dữ liệu đã rỗng -> không lỗi, số liệu về 0.
    const result2 = await resetClassroomData();
    assert.equal(result2.courses, 0);
  } finally {
    await cleanupAll();
  }
});
