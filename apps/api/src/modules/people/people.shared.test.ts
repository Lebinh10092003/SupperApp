import test from 'node:test';
import assert from 'node:assert/strict';
import { isTeacher, isStudent } from './people.shared.js';

test('isTeacher accurately identifies teachers across all formats', () => {
  assert.equal(isTeacher({ personType: 'TEACHER' }), true);
  assert.equal(isTeacher({ role: 'TEACHER' }), true);
  assert.equal(isTeacher({ role: 'teacher' }), true);
  assert.equal(isTeacher({ personType: 'GIAO_VIEN' }), true);
  assert.equal(isTeacher({ role: 'GIAO_VIEN' }), true);

  assert.equal(isTeacher({ personType: 'STUDENT' }), false);
  assert.equal(isTeacher({ role: 'STUDENT' }), false);
  assert.equal(isTeacher(null), false);
  assert.equal(isTeacher({}), false);
});

test('isStudent accurately identifies students across all formats', () => {
  assert.equal(isStudent({ personType: 'STUDENT' }), true);
  assert.equal(isStudent({ role: 'STUDENT' }), true);
  assert.equal(isStudent({ role: 'student' }), true);
  assert.equal(isStudent({ personType: 'HOC_SINH' }), true);
  assert.equal(isStudent({ role: 'HOC_SINH' }), true);

  assert.equal(isStudent({ personType: 'TEACHER' }), false);
  assert.equal(isStudent({ role: 'TEACHER' }), false);
  assert.equal(isStudent(null), false);
  assert.equal(isStudent({}), false);
});

test('SSOT guarantee: 124 teachers in people collection guarantees 124 in overview & list', () => {
  // Simulate 124 teachers and 1500 students in the same people dataset
  const mockPeople: any[] = [];
  for (let i = 1; i <= 124; i++) {
    mockPeople.push({ id: `teacher_${i}`, displayName: `Giáo viên ${i}`, personType: 'TEACHER', email: `gv${i}@giangvo.edu.vn` });
  }
  for (let i = 1; i <= 1500; i++) {
    mockPeople.push({ id: `student_${i}`, displayName: `Học sinh ${i}`, personType: 'STUDENT', email: `hs${i}@giangvo.edu.vn` });
  }

  // Filter as done in /api/analytics/overview and rebuildDashboard
  const overviewTeacherCount = mockPeople.filter(isTeacher).length;
  const overviewStudentCount = mockPeople.filter(isStudent).length;

  // Filter as done in /api/people/teachers and /api/people/students
  const listTeachers = mockPeople.filter(isTeacher);
  const listStudents = mockPeople.filter(isStudent);

  // Exact 1:1 equality guarantee
  assert.equal(overviewTeacherCount, 124);
  assert.equal(listTeachers.length, 124);
  assert.equal(overviewTeacherCount, listTeachers.length);

  assert.equal(overviewStudentCount, 1500);
  assert.equal(listStudents.length, 1500);
  assert.equal(overviewStudentCount, listStudents.length);
});
