import { and, count, desc, eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { people } from '../people/people.schema.js';
import { classes } from '../classes/classes.schema.js';
import { courses } from '../classroom/classroom.schema.js';
import { meetSessions } from '../meet/meet.schema.js';
import { alerts } from '../alerts/alerts.schema.js';
import { isTeacher, isStudent } from '../people/people.shared.js';
import { dashboardSnapshot, metricsDaily } from './dashboard.schema.js';

const metric = (value: number | null, status = 'COMPLETE', source = 'AGGREGATE') => ({
  value,
  dataStatus: status,
  source,
  updatedAt: new Date()
});

export async function rebuildDashboard() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  const [allPeople, allClasses, allCourses, live, openAlerts, sessions] = await Promise.all([
    db.select().from(people),
    db.select().from(classes),
    db.select().from(courses),
    db.select().from(meetSessions).where(eq(meetSessions.status, 'LIVE')),
    db.select().from(alerts).where(eq(alerts.resolved, false)),
    db
      .select()
      .from(meetSessions)
      .where(and(eq(meetSessions.status, 'FINISHED'), eq(meetSessions.date, today)))
  ]);

  // Áp dụng Single Source of Truth (SSOT) cho phân loại Giáo viên & Học sinh
  const students = allPeople.filter(isStudent).length;
  const teachers = allPeople.filter(isTeacher).length;

  const activeCourses = allCourses.filter((c) => c.courseState === 'ACTIVE').length;
  const online = live.reduce((n, s) => n + (s.onlineStudents || 0), 0);

  let present = 0;
  let late = 0;
  let roster = 0;
  for (const s of sessions) {
    if (s.attendanceStatus === 'COMPLETE') {
      present += (s.present || 0) + (s.late || 0);
      late += s.late || 0;
      roster += s.rosterSize || 0;
    }
  }

  let submissions = 0;
  let turned = 0;
  for (const c of allCourses) {
    submissions += c.submissionsTotal;
    turned += c.submissionsTurnedIn;
  }

  const attendanceRate = roster ? Math.round((present / roster) * 1000) / 10 : null;
  const lateRate = roster ? Math.round((late / roster) * 1000) / 10 : null;
  const submissionRate = submissions ? Math.round((turned / submissions) * 1000) / 10 : null;

  const rosterOk = allCourses.filter((c) => c.rosterStatus === 'COMPLETE').length;
  const mapped = allCourses.filter((c) => c.classId).length;
  const health = allCourses.length
    ? Math.round((rosterOk / allCourses.length) * 50 + (mapped / allCourses.length) * 30 + (allPeople.length ? 20 : 0))
    : null;

  const noData = allPeople.length === 0 && allCourses.length === 0;

  const kpis = {
    students: metric(students, allPeople.length === 0 ? 'UNAVAILABLE' : 'COMPLETE', 'DIRECTORY'),
    teachers: metric(teachers, allPeople.length === 0 ? 'UNAVAILABLE' : 'COMPLETE', 'DIRECTORY'),
    classes: metric(allClasses.length, allClasses.length === 0 ? 'UNAVAILABLE' : 'SCHEDULE'),
    classrooms: metric(allCourses.length, allCourses.length === 0 ? 'UNAVAILABLE' : 'CLASSROOM'),
    activeClassrooms: metric(activeCourses, 'COMPLETE', 'CLASSROOM'),
    meetSessionsToday: metric(sessions.length, 'COMPLETE', 'MEET'),
    liveMeets: metric(live.length, 'COMPLETE', 'MEET_EVENTS'),
    onlineStudents: metric(online, 'COMPLETE', 'MEET_EVENTS'),
    attendanceRate: metric(attendanceRate, roster ? 'COMPLETE' : 'UNAVAILABLE', 'MEET'),
    lateRate: metric(lateRate, roster ? 'COMPLETE' : 'UNAVAILABLE', 'MEET'),
    submissionRate: metric(submissionRate, allCourses.length === 0 ? 'UNAVAILABLE' : 'CLASSROOM'),
    openAlerts: metric(openAlerts.length, 'COMPLETE', 'ALERTS')
  };

  const schoolHealth = {
    score: health,
    components: {
      rosterCompleteness: allCourses.length ? Math.round((rosterOk / allCourses.length) * 100) : null,
      classMapping: allCourses.length ? Math.round((mapped / allCourses.length) * 100) : null,
      directory: allPeople.length ? 100 : 0
    },
    dataStatus: allCourses.length === 0 ? 'UNAVAILABLE' : 'COMPLETE'
  };

  const doc = {
    schoolName: process.env.SCHOOL_NAME || 'Trường THCS Giảng Võ',
    date: today,
    updatedAt: new Date(),
    dataStatus: noData ? 'UNAVAILABLE' : 'COMPLETE',
    kpis,
    schoolHealth
  };

  await db
    .insert(dashboardSnapshot)
    .values({ id: 'current', kpis, schoolHealth })
    .onConflictDoUpdate({ target: dashboardSnapshot.id, set: { kpis, schoolHealth, updatedAt: new Date() } });

  await db
    .insert(metricsDaily)
    .values({
      date: today,
      students,
      teachers,
      activeCourses,
      onlineStudents: online,
      openAlerts: openAlerts.length,
      attendanceRate: attendanceRate != null ? String(attendanceRate) : null,
      submissionRate: submissionRate != null ? String(submissionRate) : null
    })
    .onConflictDoUpdate({
      target: metricsDaily.date,
      set: {
        students,
        teachers,
        activeCourses,
        onlineStudents: online,
        openAlerts: openAlerts.length,
        attendanceRate: attendanceRate != null ? String(attendanceRate) : null,
        submissionRate: submissionRate != null ? String(submissionRate) : null
      }
    });

  return doc;
}

export async function trend(days = 30) {
  const rows = await db
    .select()
    .from(metricsDaily)
    .orderBy(desc(metricsDaily.date))
    .limit(Math.min(Math.max(days, 1), 90));
  return rows.reverse();
}
