import { pgTable, text, integer, numeric, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';

/**
 * courses — port từ Firestore collection `courses` (classroom.service.ts
 * là nguồn ghi thật duy nhất qua syncAllCourses). `roster`/`content` CHUẨN
 * HOÁ về đúng tên field bản ghi thật dùng (roster.teachers/students/status,
 * content.coursework/materials/announcements/topics/submissionsTotal/
 * submissionsTurnedIn/submissionsLate/submissionsGraded/completionRate/
 * onTimeRate/averageScore/status) — bản Firestore cũ có 1 writer khác
 * (demo-seed) dùng tên field lệch (teacherCount/courseWorkCount...),
 * SỬA LUÔN khi chuyển sang Postgres theo quyết định của Sin, không giữ 2
 * bộ tên song song nữa.
 */
export const courses = pgTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  section: text('section'),
  descriptionHeading: text('description_heading'),
  description: text('description'),
  room: text('room'),
  ownerId: text('owner_id'),
  courseState: text('course_state').notNull().default('ACTIVE'),
  alternateLink: text('alternate_link'),
  calendarId: text('calendar_id'),
  gradebookSettings: jsonb('gradebook_settings'),
  creationTime: timestamp('creation_time', { withTimezone: true }),
  updateTime: timestamp('update_time', { withTimezone: true }),
  classId: text('class_id'),
  className: text('class_name'),
  grade: integer('grade'),
  subjectId: text('subject_id'),
  subjectName: text('subject_name'),
  rosterTeachers: integer('roster_teachers').notNull().default(0),
  rosterStudents: integer('roster_students').notNull().default(0),
  rosterStatus: text('roster_status').notNull().default('DATA_UNAVAILABLE'),
  contentCoursework: integer('content_coursework').notNull().default(0),
  contentMaterials: integer('content_materials').notNull().default(0),
  contentAnnouncements: integer('content_announcements').notNull().default(0),
  contentTopics: integer('content_topics').notNull().default(0),
  submissionsTotal: integer('submissions_total').notNull().default(0),
  submissionsTurnedIn: integer('submissions_turned_in').notNull().default(0),
  submissionsLate: integer('submissions_late').notNull().default(0),
  submissionsGraded: integer('submissions_graded').notNull().default(0),
  completionRate: numeric('completion_rate', { precision: 5, scale: 1 }),
  onTimeRate: numeric('on_time_rate', { precision: 5, scale: 1 }),
  averageScore: numeric('average_score', { precision: 5, scale: 2 }),
  contentStatus: text('content_status').notNull().default('DATA_UNAVAILABLE'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const courseMembers = pgTable('course_members', {
  id: text('id').primaryKey(), // `${courseId}_${userId}`
  courseId: text('course_id').notNull(),
  userId: text('user_id').notNull(),
  role: text('role').notNull(), // TEACHER | STUDENT
  email: text('email'),
  name: text('name'),
  photoUrl: text('photo_url'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_members_course_role_idx').on(t.courseId, t.role)]);

export const courseCoursework = pgTable('course_coursework', {
  id: text('id').primaryKey(), // `${courseId}_${courseWorkId}`
  courseId: text('course_id').notNull(),
  courseWorkId: text('course_work_id').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_coursework_course_idx').on(t.courseId)]);

export const courseMaterials = pgTable('course_materials', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_materials_course_idx').on(t.courseId)]);

export const courseAnnouncements = pgTable('course_announcements', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_announcements_course_idx').on(t.courseId)]);

export const courseTopics = pgTable('course_topics', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull(),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_topics_course_idx').on(t.courseId)]);

export const courseSubmissions = pgTable('course_submissions', {
  id: text('id').primaryKey(), // `${courseId}_${submissionId}`
  courseId: text('course_id').notNull(),
  courseWorkId: text('course_work_id'),
  courseWorkTitle: text('course_work_title'),
  maxPoints: numeric('max_points', { precision: 6, scale: 2 }),
  dueDate: jsonb('due_date'),
  dueTime: jsonb('due_time'),
  isTurnedIn: boolean('is_turned_in').notNull().default(false),
  isLate: boolean('is_late').notNull().default(false),
  isGraded: boolean('is_graded').notNull().default(false),
  data: jsonb('data').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('course_submissions_course_idx').on(t.courseId)]);

/** class_mappings/subject_mappings — port từ Firestore classMappings/subjectMappings (gợi ý tự động, chưa có luồng "confirmed" thật). */
export const classMappings = pgTable('class_mappings', {
  courseId: text('course_id').primaryKey(),
  courseName: text('course_name').notNull(),
  classId: text('class_id').notNull(),
  className: text('class_name').notNull(),
  grade: integer('grade'),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  confirmed: boolean('confirmed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const subjectMappings = pgTable('subject_mappings', {
  courseId: text('course_id').primaryKey(),
  courseName: text('course_name').notNull(),
  subjectId: text('subject_id').notNull(),
  subjectName: text('subject_name').notNull(),
  confidence: numeric('confidence', { precision: 3, scale: 2 }).notNull(),
  confirmed: boolean('confirmed').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/**
 * sync_runs — HỢP NHẤT 3 kiểu field khác nhau ở bản Firestore cũ
 * (classroom.service.ts dùng startTime/runId/coursesTotal, 2 job CLI
 * full-sync.ts/renew-subscriptions.ts dùng startedAt/type riêng, khiến
 * trang Hệ thống (đọc theo startedAt) KHÔNG BAO GIỜ thấy lần đồng bộ
 * Classroom thật) — SỬA LUÔN theo quyết định của Sin: 1 bảng, 1 bộ tên
 * cột duy nhất, mọi nơi ghi đều dùng chung.
 */
export const syncRuns = pgTable('sync_runs', {
  id: text('id').primaryKey(),
  type: text('type').notNull().default('CLASSROOM_SYNC'), // CLASSROOM_SYNC | FULL_SYNC | RENEW_SUBSCRIPTIONS
  status: text('status').notNull(), // IN_PROGRESS | COMPLETED | PARTIAL | FAILED
  performedBy: text('performed_by'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  coursesTotal: integer('courses_total').notNull().default(0),
  coursesSuccess: integer('courses_success').notNull().default(0),
  coursesError: integer('courses_error').notNull().default(0),
  errors: jsonb('errors').$type<Array<{ courseId?: string; error: string }>>().default([]),
  note: text('note')
}, (t) => [index('sync_runs_started_at_idx').on(t.startedAt)]);
