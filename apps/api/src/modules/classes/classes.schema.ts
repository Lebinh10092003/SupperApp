import { pgTable, text, integer, boolean, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';

/** classes — port từ Firestore collection `classes`. */
export const classes = pgTable('classes', {
  classId: text('class_id').primaryKey(),
  className: text('class_name').notNull(),
  grade: integer('grade'),
  active: boolean('active').notNull().default(true),
  homeroomTeacher: text('homeroom_teacher'),
  courseCount: integer('course_count').notNull().default(0),
  courses: jsonb('courses').$type<string[]>().default([]),
  subjects: jsonb('subjects').$type<string[]>().default([]),
  studentCount: integer('student_count').notNull().default(0),
  totalCoursework: integer('total_coursework').notNull().default(0),
  submissionsTotal: integer('submissions_total').notNull().default(0),
  submissionsTurnedIn: integer('submissions_turned_in').notNull().default(0),
  submissionsLate: integer('submissions_late').notNull().default(0),
  completionRate: numeric('completion_rate', { precision: 5, scale: 1 }),
  onTimeRate: numeric('on_time_rate', { precision: 5, scale: 1 }),
  averageScore: numeric('average_score', { precision: 5, scale: 2 }),
  expectedStudents: integer('expected_students'),
  room: text('room'),
  teacherEmail: text('teacher_email'),
  source: text('source').notNull().default('CLASSROOM_SYNC'), // CLASSROOM_SYNC | MANUAL
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
