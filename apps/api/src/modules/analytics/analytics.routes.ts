import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { courses } from '../classroom/classroom.schema.js';
import { people } from '../people/people.schema.js';
import { alerts } from '../alerts/alerts.schema.js';
import { classes } from '../classes/classes.schema.js';
import { metricsDaily } from '../dashboard/dashboard.schema.js';
import { isTeacher, isStudent } from '../people/people.shared.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/overview',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const period = String(req.query.period || 'this_month');
    const gradeParam = String(req.query.grade || 'all');

    const [allCourses, allPeople, openAlerts, allClasses] = await Promise.all([
      db.select().from(courses),
      db.select().from(people),
      db.select().from(alerts).where(eq(alerts.resolved, false)),
      db.select().from(classes)
    ]);

    let filteredCourses = allCourses;
    if (gradeParam !== 'all') {
      const gradeNum = Number(gradeParam);
      filteredCourses = allCourses.filter((c) => c.grade === gradeNum);
    }

    const totalCourses = filteredCourses.length;
    const totalClasses = allClasses.length;

    const teachersCount = allPeople.filter(isTeacher).length;
    const studentsCount = allPeople.filter(isStudent).length;

    let totalSubmissions = 0;
    let totalTurnedIn = 0;
    let totalLate = 0;
    let totalGraded = 0;
    let totalAssignments = 0;
    let activeClassroomsCount = 0;
    let dormantClassroomsCount = 0;
    let totalScoresSum = 0;
    let scoredCoursesCount = 0;

    for (const c of filteredCourses) {
      const cw = c.contentCoursework;
      const isDormant = c.courseState !== 'ACTIVE' || (cw === 0 && Boolean(c.lastSyncAt));
      if (isDormant) dormantClassroomsCount++;
      else activeClassroomsCount++;

      totalAssignments += cw;
      totalSubmissions += c.submissionsTotal;
      totalTurnedIn += c.submissionsTurnedIn;
      totalLate += c.submissionsLate;
      totalGraded += c.submissionsGraded;

      if (c.averageScore != null && Number(c.averageScore) > 0) {
        totalScoresSum += Number(c.averageScore);
        scoredCoursesCount++;
      }
    }

    const completionRate = totalSubmissions > 0 ? Math.round((totalTurnedIn / totalSubmissions) * 1000) / 10 : 0;
    const onTimeRate = totalTurnedIn > 0 ? Math.round(((totalTurnedIn - totalLate) / totalTurnedIn) * 1000) / 10 : 0;
    const schoolGpa = scoredCoursesCount > 0 ? Math.round((totalScoresSum / scoredCoursesCount) * 10) / 10 : 0;
    const ungraded = Math.max(0, totalTurnedIn - totalGraded);

    res.json({
      period,
      grade: gradeParam,
      isSynced: totalCourses > 0,
      kpis: {
        totalCourses: {
          value: totalCourses,
          delta: totalCourses > 0 ? `${activeClassroomsCount}/${totalCourses} lớp đang hoạt động` : 'Chưa đồng bộ Classroom'
        },
        totalClasses: { value: totalClasses, delta: totalClasses > 0 ? `${totalClasses} lớp hành chính` : 'Chưa thiết lập lớp' },
        activeClassrooms: {
          value: activeClassroomsCount,
          delta: totalCourses > 0 ? `${activeClassroomsCount}/${totalCourses} lớp đang hoạt động` : 'Chưa đồng bộ Classroom'
        },
        dormantClassrooms: {
          value: dormantClassroomsCount,
          delta: dormantClassroomsCount > 0 ? `${dormantClassroomsCount} lớp chưa có bài tập` : 'Tất cả đang hoạt động tốt'
        },
        totalTeachers: { value: teachersCount, delta: teachersCount > 0 ? `${teachersCount} giáo viên từ Classroom` : 'Chưa có dữ liệu' },
        totalStudents: { value: studentsCount, delta: studentsCount > 0 ? `${studentsCount} học sinh từ Classroom` : 'Chưa có dữ liệu' },
        assignmentsCount: {
          value: totalAssignments,
          delta: totalAssignments > 0 ? `${totalAssignments} bài tập đã giao trên Classroom` : 'Chưa có dữ liệu'
        },
        completionRate: { value: completionRate, delta: totalSubmissions > 0 ? `${totalTurnedIn}/${totalSubmissions} bài đã nộp` : 'Chưa có bài nộp' },
        onTimeRate: {
          value: onTimeRate,
          delta: totalTurnedIn > 0 ? `${Math.max(0, totalTurnedIn - totalLate)}/${totalTurnedIn} bài đúng hạn` : 'Chưa có số liệu'
        },
        missingAssignments: {
          value: Math.max(0, totalSubmissions - totalTurnedIn),
          delta: totalSubmissions > 0 ? 'Bài tập chưa nộp' : 'Không có bài quá hạn'
        },
        ungradedAssignments: { value: ungraded, delta: ungraded > 0 ? `${ungraded} bài chờ giáo viên chấm` : 'Đã chấm đầy đủ' },
        schoolGpa: { value: schoolGpa, delta: schoolGpa > 0 ? `${schoolGpa}/10 Điểm trung bình` : 'Chưa có điểm' },
        openAlerts: { value: openAlerts.length, delta: openAlerts.length > 0 ? `${openAlerts.length} vấn đề cần xử lý` : 'Không có cảnh báo' }
      }
    });
  })
);

analyticsRouter.get(
  '/compare',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const grade = String(req.query.grade || 'all');
    const { getEnrichedClasses } = await import('../classes/classes.routes.js');
    const items = await getEnrichedClasses(grade);
    res.json({ items });
  })
);

analyticsRouter.get(
  '/trend',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const rows = await db.select().from(metricsDaily).orderBy(desc(metricsDaily.date)).limit(14);
    res.json({ items: rows.reverse() });
  })
);
