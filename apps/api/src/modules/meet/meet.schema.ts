import { pgTable, text, integer, numeric, timestamp, uuid, index } from 'drizzle-orm/pg-core';

/**
 * meet_sessions — HỢP NHẤT `meetSessions`+`liveSessions` (bản Firestore
 * cũ là 2 collection tách biệt cho CÙNG 1 buổi học, chỉ khác `status`,
 * ghi bởi CÙNG 1 hàm `refreshConference()` — hợp nhất về 1 bảng, phân
 * biệt bằng cột `status` thay vì 2 bảng trùng schema, theo quyết định
 * "sửa luôn" của Sin).
 */
export const meetSessions = pgTable('meet_sessions', {
  id: text('id').primaryKey(), // conferenceRecord id (Google Meet)
  conferenceName: text('conference_name').notNull(),
  raw: text('raw'), // JSON passthrough của object Google trả về (space/startTime/endTime...)
  date: text('date').notNull(), // YYYY-MM-DD, Asia/Ho_Chi_Minh
  scheduleId: uuid('schedule_id'),
  classId: text('class_id'),
  className: text('class_name'),
  subject: text('subject'),
  teacherEmail: text('teacher_email'),
  onlineStudents: integer('online_students').notNull().default(0),
  joinedStudents: integer('joined_students').notNull().default(0),
  status: text('status').notNull(), // LIVE | FINISHED
  attendanceStatus: text('attendance_status'), // COMPLETE | DATA_UNAVAILABLE
  attendanceReason: text('attendance_reason'),
  rosterSize: integer('roster_size'),
  present: integer('present'),
  late: integer('late'),
  absent: integer('absent'),
  attendanceRate: numeric('attendance_rate', { precision: 5, scale: 1 }),
  lateRate: numeric('late_rate', { precision: 5, scale: 1 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index('meet_sessions_date_idx').on(t.date),
  index('meet_sessions_status_idx').on(t.status)
]);

/** meet_attendance — port từ subcollection meetSessions/{id}/attendance. */
export const meetAttendance = pgTable('meet_attendance', {
  id: text('id').primaryKey(), // `${sessionId}_${userId}`
  sessionId: text('session_id').notNull(),
  userId: text('user_id').notNull(),
  email: text('email'),
  name: text('name'),
  status: text('status').notNull(), // PRESENT | LATE | ABSENT
  durationMinutes: integer('duration_minutes').notNull().default(0),
  joinTime: timestamp('join_time', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => [index('meet_attendance_session_idx').on(t.sessionId)]);
