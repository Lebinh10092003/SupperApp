import { pgTable, text, integer, timestamp, uuid, index } from 'drizzle-orm/pg-core';

/** schedules — port từ Firestore collection `schedules`. */
export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  dayOfWeek: integer('day_of_week').notNull(),
  period: integer('period').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  classId: text('class_id').notNull(),
  className: text('class_name').notNull(),
  subject: text('subject').notNull(),
  teacherEmail: text('teacher_email').notNull(),
  courseId: text('course_id'),
  meetingCode: text('meeting_code'),
  spaceName: text('space_name'),
  schoolYear: text('school_year').notNull(),
  semester: text('semester').notNull(),
  expectedStudents: integer('expected_students'),
  lateMinutes: integer('late_minutes').notNull().default(10),
  source: text('source').notNull().default('MANUAL'), // MANUAL | CSV_IMPORT
  importBatchId: uuid('import_batch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index('schedules_day_period_idx').on(t.dayOfWeek, t.period),
  index('schedules_import_batch_idx').on(t.importBatchId),
  index('schedules_space_name_idx').on(t.spaceName)
]);

/** schedule_imports — nhật ký 1 lần nhập CSV (để rollback theo importBatchId). */
export const scheduleImports = pgTable('schedule_imports', {
  id: uuid('id').primaryKey().defaultRandom(),
  imported: integer('imported').notNull(),
  status: text('status').notNull().default('IMPORTED'), // IMPORTED | ROLLED_BACK
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  rolledBack: integer('rolled_back'),
  rolledBackAt: timestamp('rolled_back_at', { withTimezone: true })
});
