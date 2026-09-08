import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { autoDetectClass } from '../catalog/catalog.service.js';

export const classesRouter = Router();

// Không sử dụng dữ liệu mock/seed tĩnh — 100% dữ liệu lớp học được tổng hợp từ Firestore/SQLite và Google Classroom

export async function getEnrichedClasses(gradeFilter = 'all') {
  const [classesSnap, coursesSnap] = await Promise.all([
    col('classes').get().catch(() => ({ docs: [] })),
    col('courses').get().catch(() => ({ docs: [] }))
  ]);

  const map = new Map<string, any>();

  // 1. Nạp từ CSDL classes quản trị thực tế nếu có
  for (const doc of (classesSnap as any).docs) {
    const data = doc.data();
    const id = doc.id;
    map.set(id, {
      id,
      classId: id,
      className: data.className || `Lớp ${id}`,
      grade: data.grade || Number(String(id).match(/^[6789]|1[0-2]/)?.[0]) || 6,
      expectedStudents: data.expectedStudents || 0,
      homeroomTeacher: data.homeroomTeacher || 'Chưa phân công',
      teacherEmail: data.teacherEmail || '',
      room: data.room || '',
      totalCoursework: 0,
      submissionsTotal: 0,
      submissionsTurnedIn: 0,
      submissionsLate: 0,
      completionRate: 0,
      onTimeRate: 0,
      averageScore: null,
      attendanceRate: null,
      coursesCount: 0,
      subjects: []
    });
  }

  // 2. Hợp nhất dữ liệu thật 100% từ Google Classroom đã đồng bộ (1 Classroom = 1 Lớp thực tế)
  for (const doc of (coursesSnap as any).docs) {
    const course = doc.data();
    const auto = autoDetectClass(course.name || '');
    const classId = course.classId || auto?.classId || doc.id;
    const className = course.className || auto?.className || (auto?.classId ? `Lớp ${auto.classId}` : course.name);
    const grade = course.grade || auto?.grade || 0;

    if (!map.has(classId)) {
      map.set(classId, {
        id: classId,
        classId,
        className,
        grade,
        homeroomTeacher: course.teacherGroupEmail ? 'Giáo viên phụ trách Classroom' : 'Chưa phân công',
        teacherEmail: course.teacherGroupEmail || '',
        room: course.room || '',
        expectedStudents: Number(course.roster?.students || 0),
        totalCoursework: 0,
        submissionsTotal: 0,
        submissionsTurnedIn: 0,
        submissionsLate: 0,
        completionRate: 0,
        onTimeRate: 0,
        averageScore: null,
        attendanceRate: null,
        coursesCount: 0,
        subjects: []
      });
    }

    const current = map.get(classId)!;
    const cw = Number(course.content?.courseWorkCount || course.content?.coursework || 0);
    const subTotal = Number(course.content?.submissionsTotal || 0);
    const subTurned = Number(course.content?.submissionsTurnedIn || 0);
    const subLate = Number(course.content?.submissionsLate || 0);
    const avgScore = course.content?.averageScore != null ? Number(course.content.averageScore) : null;

    current.coursesCount = (current.coursesCount || 0) + 1;
    current.totalCoursework = (current.totalCoursework || 0) + cw;
    current.submissionsTotal = (current.submissionsTotal || 0) + subTotal;
    current.submissionsTurnedIn = (current.submissionsTurnedIn || 0) + subTurned;
    current.submissionsLate = (current.submissionsLate || 0) + subLate;

    if (current.submissionsTotal > 0) {
      current.completionRate = Math.round((current.submissionsTurnedIn / current.submissionsTotal) * 1000) / 10;
    }
    if (current.submissionsTurnedIn > 0) {
      current.onTimeRate = Math.round(((current.submissionsTurnedIn - current.submissionsLate) / current.submissionsTurnedIn) * 1000) / 10;
    }
    if (avgScore != null && avgScore > 0) {
      current.averageScore = Math.round(avgScore * 10) / 10;
    }

    current.subjects.push({
      name: course.subjectName || course.name,
      teacher: course.teacherGroupEmail || '',
      completionRate: Number(course.content?.completionRate || 0),
      avgScore: avgScore,
      coursework: cw
    });
  }

  let items = Array.from(map.values());

  if (gradeFilter !== 'all') {
    const gradeNum = Number(gradeFilter);
    items = items.filter(c => c.grade === gradeNum);
  }

  items.sort((a, b) => (b.completionRate || 0) - (a.completionRate || 0));

  return items;
}

// 1. Lấy danh sách lớp học đã được làm giàu số liệu
classesRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const grade = String(req.query.grade || 'all');
    const items = await getEnrichedClasses(grade);
    res.json({ total: items.length, items });
  })
);

// 2. Lấy dữ liệu so sánh xếp hạng toàn khối / toàn trường
classesRouter.get(
  '/compare',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const grade = String(req.query.grade || 'all');
    const items = await getEnrichedClasses(grade);

    // Tính mức trung bình của nhóm dựa trên dữ liệu thực tế
    const itemsWithScores = items.filter(c => c.averageScore != null);
    const avgCompletion = items.length
      ? Math.round((items.reduce((acc, c) => acc + (c.completionRate || 0), 0) / items.length) * 10) / 10
      : 0;

    const avgOnTime = items.length
      ? Math.round((items.reduce((acc, c) => acc + (c.onTimeRate || 0), 0) / items.length) * 10) / 10
      : 0;

    const avgScore = itemsWithScores.length
      ? Math.round((itemsWithScores.reduce((acc, c) => acc + (c.averageScore || 0), 0) / itemsWithScores.length) * 10) / 10
      : 0;

    res.json({
      total: items.length,
      grade,
      benchmarks: {
        avgCompletion,
        avgOnTime,
        avgScore
      },
      items
    });
  })
);

// 3. Phân tích so sánh đối đầu trực diện 1 vs 1 giữa 2 lớp học (Head-to-Head Duel)
classesRouter.get(
  '/duel',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const all = await getEnrichedClasses('all');

    if (all.length === 0) {
      return res.json({
        classA: null,
        classB: null,
        deltas: null,
        radarData: [],
        insights: [],
        recommendations: []
      });
    }

    const requestedA = String(req.query.classA || '');
    const requestedB = String(req.query.classB || '');

    const classA = (requestedA && all.find(c => c.classId === requestedA || c.id === requestedA)) || all[0];
    const classB = (requestedB && all.find(c => (c.classId === requestedB || c.id === requestedB) && c.classId !== classA.classId)) || (all.length > 1 ? all[1] : all[0]);

    if (!classB || classA.classId === classB.classId) {
      return res.json({
        classA,
        classB: null,
        deltas: null,
        radarData: [],
        insights: [],
        recommendations: []
      });
    }

    // Dữ liệu biểu đồ Radar so sánh 5 chiều
    const radarData = [
      { metric: 'Tỷ lệ nộp bài', classA: classA.completionRate || 0, classB: classB.completionRate || 0, fullMark: 100 },
      { metric: 'Nộp đúng hạn', classA: classA.onTimeRate || 0, classB: classB.onTimeRate || 0, fullMark: 100 },
      { metric: 'Điểm số (x10)', classA: Math.round((classA.averageScore || 0) * 10), classB: Math.round((classB.averageScore || 0) * 10), fullMark: 100 },
      { metric: 'Chuyên cần', classA: classA.attendanceRate || 0, classB: classB.attendanceRate || 0, fullMark: 100 },
      { metric: 'Bài tập giao', classA: Math.min(100, (classA.totalCoursework || 0) * 6), classB: Math.min(100, (classB.totalCoursework || 0) * 6), fullMark: 100 }
    ];

    // Tính chênh lệch
    const deltas = {
      completionRate: Math.round(((classA.completionRate || 0) - (classB.completionRate || 0)) * 10) / 10,
      onTimeRate: Math.round(((classA.onTimeRate || 0) - (classB.onTimeRate || 0)) * 10) / 10,
      averageScore: Math.round(((classA.averageScore || 0) - (classB.averageScore || 0)) * 10) / 10,
      attendanceRate: Math.round(((classA.attendanceRate || 0) - (classB.attendanceRate || 0)) * 10) / 10,
      totalCoursework: (classA.totalCoursework || 0) - (classB.totalCoursework || 0)
    };

    // Nhận định sư phạm và khuyến nghị vận hành cho Ban Giám hiệu
    const insights: string[] = [];
    if (deltas.completionRate > 2) {
      insights.push(`${classA.className} có tỷ lệ nộp bài vượt trội hơn ${classB.className} (+${deltas.completionRate}%). Học sinh duy trì thói quen học tập tích cực.`);
    } else if (deltas.completionRate < -2) {
      insights.push(`${classB.className} dẫn trước về tỷ lệ nộp bài (+${Math.abs(deltas.completionRate)}%). Ban Giám hiệu nên nhắc nhở giáo viên chủ nhiệm ${classA.className} theo sát các bài tập về nhà.`);
    } else {
      insights.push(`Hai lớp có tỷ lệ nộp bài bám sát nhau (chênh lệch chỉ ${Math.abs(deltas.completionRate)}%), thể hiện tiến độ học tập đồng đều.`);
    }

    if (deltas.onTimeRate > 3) {
      insights.push(`${classA.className} kiểm soát hạn nộp bài tốt hơn rõ rệt (+${deltas.onTimeRate}% bài đúng hạn).`);
    } else if (deltas.onTimeRate < -3) {
      insights.push(`${classA.className} có dấu hiệu nộp bài trễ nhiều hơn (-${Math.abs(deltas.onTimeRate)}%). Cần thông báo qua sổ liên lạc điện tử cho phụ huynh.`);
    }

    if (deltas.averageScore > 0.3) {
      insights.push(`Chất lượng bài làm của ${classA.className} nhỉnh hơn (+${deltas.averageScore} điểm TB).`);
    } else if (deltas.averageScore < -0.3) {
      insights.push(`${classB.className} có phổ điểm bài tập cao hơn (+${Math.abs(deltas.averageScore)} điểm TB).`);
    }

    const recommendations: string[] = [
      `Tổ chức buổi sinh hoạt chuyên môn giữa GVCN ${classA.homeroomTeacher || classA.className} và GVCN ${classB.homeroomTeacher || classB.className} để chia sẻ kinh nghiệm thúc đẩy học sinh làm bài.`,
      `Kiểm tra lại độ khó của các bài tập phân ban trên Google Classroom để đảm bảo tính công bằng giữa các lớp cùng khối.`
    ];

    res.json({
      classA,
      classB,
      deltas,
      radarData,
      insights,
      recommendations
    });
  })
);