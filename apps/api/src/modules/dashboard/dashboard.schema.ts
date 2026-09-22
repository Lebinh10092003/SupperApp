import { pgTable, text, integer, numeric, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * dashboard_snapshot — port từ Firestore doc đơn `dashboard/current`
 * (KPI đã tính sẵn, ghi lại mỗi lần rebuildDashboard chạy) — chỉ 1 dòng
 * duy nhất, id cố định 'current'.
 */
export const dashboardSnapshot = pgTable('dashboard_snapshot', {
  id: text('id').primaryKey().default('current'),
  kpis: jsonb('kpis').notNull(),
  schoolHealth: jsonb('school_health').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

/** metrics_daily — port từ Firestore collection `metricsDaily` (1 dòng/ngày, cho biểu đồ xu hướng). */
export const metricsDaily = pgTable('metrics_daily', {
  date: text('date').primaryKey(), // YYYY-MM-DD
  students: integer('students').notNull().default(0),
  teachers: integer('teachers').notNull().default(0),
  activeCourses: integer('active_courses').notNull().default(0),
  onlineStudents: integer('online_students').notNull().default(0),
  openAlerts: integer('open_alerts').notNull().default(0),
  attendanceRate: numeric('attendance_rate', { precision: 5, scale: 1 }),
  submissionRate: numeric('submission_rate', { precision: 5, scale: 1 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
