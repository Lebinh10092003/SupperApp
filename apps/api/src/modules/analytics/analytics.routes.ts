import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { isTeacher, isStudent } from '../people/people.shared.js';

export const analyticsRouter = Router();

analyticsRouter.get(
  '/overview',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const period = String(req.query.period || 'this_month');
    const gradeParam = String(req.query.grade || 'all');

    // Đọc số liệu thực tế 100% từ Firestore / Google Classroom đã đồng bộ (Single Source of Truth)
    const [coursesSnap, peopleSnap, alertsSnap, classesSnap] = await Promise.all([
      col('courses').get(),
      col('people').get(),
      col('alerts').where('resolved', '==', false).get(),
      col('classes').get()
    ]);

    let courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
    if (gradeParam !== 'all') {
      const gradeNum = Number(gradeParam);
      courses = courses.filter(c => c.grade === gradeNum);
    }

    const totalCourses = courses.length;
    const totalClasses = classesSnap.size;

    // Phân loại người dùng từ Classroom theo Single Source of Truth
    const teachersCount = peopleSnap.docs.filter(d => isTeacher(d.data())).length;
    const studentsCount = peopleSnap.docs.filter(d => isStudent(d.data())).length;

    // Tính toán từ dữ liệu bài nộp & chỉ số thực của từng khóa học
    let totalSubmissions = 0;
    let totalTurnedIn = 0;
    let totalLate = 0;
    let totalGraded = 0;
    let totalAssignments = 0;
    let activeClassroomsCount = 0;
    let dormantClassroomsCount = 0;
    let totalScoresSum = 0;
    let scoredCoursesCount = 0;

    for (const c of courses) {
      const cw = Number(c.content?.coursework || c.content?.courseWorkTotal || 0);
      const isDormant = c.courseState !== 'ACTIVE' || (cw === 0 && Boolean(c.lastSyncAt));
      if (isDormant) {
        dormantClassroomsCount++;
      } else {
        activeClassroomsCount++;
      }

      totalAssignments += cw;
      totalSubmissions += Number(c.content?.submissionsTotal || 0);
      totalTurnedIn += Number(c.content?.submissionsTurnedIn || 0);
      totalLate += Number(c.content?.submissionsLate || 0);
      totalGraded += Number(c.content?.submissionsGraded || 0);

      if (c.content?.averageScore != null && Number(c.content.averageScore) > 0) {
        totalScoresSum += Number(c.content.averageScore);
        scoredCoursesCount++;
      }
    }

    const completionRate = totalSubmissions > 0
      ? Math.round((totalTurnedIn / totalSubmissions) * 1000) / 10
      : 0;

    const onTimeRate = totalTurnedIn > 0
      ? Math.round(((totalTurnedIn - totalLate) / totalTurnedIn) * 1000) / 10
      : 0;

    const schoolGpa = scoredCoursesCount > 0
      ? Math.round((totalScoresSum / scoredCoursesCount) * 10) / 10
      : 0;

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
        totalClasses: {
          value: totalClasses,
          delta: totalClasses > 0 ? `${totalClasses} lớp hành chính` : 'Chưa thiết lập lớp'
        },
        activeClassrooms: {
          value: activeClassroomsCount,
          delta: totalCourses > 0 ? `${activeClassroomsCount}/${totalCourses} lớp đang hoạt động` : 'Chưa đồng bộ Classroom'
        },
        dormantClassrooms: {
          value: dormantClassroomsCount,
          delta: dormantClassroomsCount > 0 ? `${dormantClassroomsCount} lớp chưa có bài tập` : 'Tất cả đang hoạt động tốt'
        },
        totalTeachers: {
          value: teachersCount,
          delta: teachersCount > 0 ? `${teachersCount} giáo viên từ Classroom` : 'Chưa có dữ liệu'
        },
        totalStudents: {
          value: studentsCount,
          delta: studentsCount > 0 ? `${studentsCount} học sinh từ Classroom` : 'Chưa có dữ liệu'
        },
        assignmentsCount: {
          value: totalAssignments,
          delta: totalAssignments > 0 ? `${totalAssignments} bài tập đã giao trên Classroom` : 'Chưa có dữ liệu'
        },
        completionRate: {
          value: completionRate,
          delta: totalSubmissions > 0 ? `${totalTurnedIn}/${totalSubmissions} bài đã nộp` : 'Chưa có bài nộp'
        },
        onTimeRate: {
          value: onTimeRate,
          delta: totalTurnedIn > 0 ? `${Math.max(0, totalTurnedIn - totalLate)}/${totalTurnedIn} bài đúng hạn` : 'Chưa có số liệu'
        },
        missingAssignments: {
          value: Math.max(0, totalSubmissions - totalTurnedIn),
          delta: totalSubmissions > 0 ? 'Bài tập chưa nộp' : 'Không có bài quá hạn'
        },
        ungradedAssignments: {
          value: ungraded,
          delta: ungraded > 0 ? `${ungraded} bài chờ giáo viên chấm` : 'Đã chấm đầy đủ'
        },
        schoolGpa: {
          value: schoolGpa,
          delta: schoolGpa > 0 ? `${schoolGpa}/10 Điểm trung bình` : 'Chưa có điểm'
        },
        openAlerts: {
          value: alertsSnap.size,
          delta: alertsSnap.size > 0 ? `${alertsSnap.size} vấn đề cần xử lý` : 'Không có cảnh báo'
        }
      }
    });
  })
);

analyticsRouter.get(
  '/compare',
  firebaseAuth,
  requireCapability('VIEW_EXECUTIVE_BI'),
  asyncRoute(async (_req, res) => {
    const classesSnap = await col('classes').limit(100).get();
    const items = classesSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        className: data.className || d.id,
        grade: data.grade || null,
        completionRate: data.completionRate || 0,
        onTimeRate: data.onTimeRate || 0,
        avgScore: data.averageScore || data.avgScore || null,
        activeStudents: data.studentCount || data.expectedStudents || 0,
        courseCount: data.courseCount || (data.courses?.length || 0),
        totalCoursework: data.totalCoursework || 0
      };
    });

    items.sort((a, b) => (b.completionRate || 0) - (a.completionRate || 0));
    res.json({ items });
  })
);

analyticsRouter.get(
  '/trend',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const dailySnap = await col('metricsDaily').orderBy('date', 'desc').limit(14).get();
    const docs = dailySnap.docs.map(d => ({ date: d.id, ...d.data() })).reverse();
    res.json({ items: docs });
  })
);

