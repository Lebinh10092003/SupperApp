import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { isTeacher, isStudent } from './people.shared.js';
import { autoDetectClass, cleanCourseName } from '../catalog/catalog.service.js';
import { getStudentTranscript, STANDARD_TOPICS } from './student-grades.service.js';

export const peopleRouter = Router();

function mapPersonDoc(d: any) {
  const data = d.data();
  const displayName = data.displayName || data.name || data.email || 'Chưa cập nhật họ tên';
  return {
    id: d.id,
    name: displayName,
    displayName,
    ...data
  };
}

// Chuẩn hóa danh sách khóa học từ object { elements: [...] } hoặc array
function extractCourseIds(coursesField: any): string[] {
  if (Array.isArray(coursesField)) return coursesField;
  if (coursesField?.elements && Array.isArray(coursesField.elements)) return coursesField.elements;
  if (typeof coursesField === 'string' && coursesField) return [coursesField];
  return [];
}

async function enrichStudentItems(rawStudents: any[]): Promise<{ items: any[]; classSubjectAverages: Record<string, number | null> }> {
  const coursesSnap = await col('courses').get().catch(() => ({ docs: [] }));
  const coursesMap = new Map<string, any>();

  for (const doc of coursesSnap.docs) {
    const data = doc.data();
    const detected = autoDetectClass(data.name || '');
    const cleanName = cleanCourseName(data.name) || data.name;
    coursesMap.set(doc.id, {
      id: doc.id,
      name: cleanName,
      classId: data.classId || detected?.classId || doc.id,
      className: data.className || detected?.className || (detected?.classId ? `Lớp ${detected.classId}` : cleanName),
      grade: data.grade || detected?.grade || 12,
      topicsCount: Number(data.content?.topics || 10)
    });
  }

  const enriched = await Promise.all(
    rawStudents.map(async (st) => {
      const courseIds = extractCourseIds(st.courses);
      let className = st.className;
      let classId = st.classId;
      let grade = st.grade || 12;
      let topicsCount = 10;

      // Tìm kiếm thông tin lớp từ khóa học đầu tiên học sinh tham gia
      const firstId = courseIds[0];
      if (firstId) {
        const c = coursesMap.get(firstId);
        if (c) {
          className = className && className !== 'Học sinh' && className !== '—' ? className : c.className;
          classId = classId || c.classId;
          grade = c.grade || grade;
          topicsCount = c.topicsCount || 10;
        }
      }

      // Xử lý triệt để nếu lớp bị lỗi thành "Học sinh"
      if (!className || className === 'Học sinh' || className === '—') {
        const firstCourse = coursesMap.values().next().value;
        if (firstCourse) {
          className = firstCourse.className;
          classId = firstCourse.classId;
          grade = firstCourse.grade;
        } else {
          className = 'Lớp 12A1';
          classId = '12A1';
          grade = 12;
        }
      }

      className = cleanCourseName(className) || 'Lớp 12A1';
      const orgUnit = `/Học sinh/Khối ${grade}/Lớp ${classId || className.replace(/^Lớp\s*/, '')}`;

      // Cập nhật lại vào CSDL nếu dữ liệu cũ chưa có className hoặc bị gán nhầm
      if (!st.className || st.className === 'Học sinh') {
        await col('people').doc(st.id).set(
          {
            className,
            classId,
            grade,
            orgUnitPath: orgUnit,
            courses: courseIds.length > 0 ? courseIds : (coursesMap.size > 0 ? [coursesMap.keys().next().value] : ['869086101416'])
          },
          { merge: true }
        ).catch(() => null);
      }

      // Lấy kết quả học tập thực tế 100% từ Google Classroom
      const transcript = await getStudentTranscript(st.id).catch(() => null);
      const gpa = transcript?.summary?.gpa ?? null;
      const completionRate = transcript?.summary?.completionRate ?? 0;

      const subjectScores: Record<string, number | null> = {};
      const codes = ['MATH', 'LIT', 'ENG', 'PHY', 'CHEM', 'BIO', 'HIST', 'GEO', 'INF', 'CIV'];
      for (const code of codes) {
        const found = transcript?.subjects?.find(s => s.subjectCode === code);
        subjectScores[code] = found?.averageScore ?? null;
      }

      return {
        ...st,
        className,
        classId: classId || className.replace(/^Lớp\s*/, ''),
        grade,
        orgUnitPath: orgUnit,
        courses: courseIds,
        topicsCount,
        subjectCount: topicsCount,
        subjects: STANDARD_TOPICS.map(t => t.name),
        gpa,
        completionRate,
        subjectScores
      };
    })
  );

  // Tính điểm trung bình từng môn của lớp / toàn trường từ điểm thật
  const classSubjectAverages: Record<string, number | null> = {};
  const codes = ['MATH', 'LIT', 'ENG', 'PHY', 'CHEM', 'BIO', 'HIST', 'GEO', 'INF', 'CIV'];
  for (const code of codes) {
    const validScores = enriched.map(s => s.subjectScores?.[code]).filter((sc): sc is number => typeof sc === 'number');
    classSubjectAverages[code] = validScores.length ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10 : null;
  }

  return { items: enriched, classSubjectAverages };
}

// Lấy danh sách toàn bộ nhân sự hoặc lọc theo vai trò (TEACHER / STUDENT)
peopleRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const roleQuery = String(req.query.role || req.query.type || '').toUpperCase();
    const s = await col('people').get();
    let items = s.docs.map(mapPersonDoc);

    let classSubjectAverages: Record<string, number | null> | undefined = undefined;
    if (roleQuery === 'TEACHER' || roleQuery === 'TEACHERS') {
      items = items.filter(isTeacher);
    } else if (roleQuery === 'STUDENT' || roleQuery === 'STUDENTS') {
      const rawStudents = items.filter(isStudent);
      const enrichedRes = await enrichStudentItems(rawStudents);
      items = enrichedRes.items;
      classSubjectAverages = enrichedRes.classSubjectAverages;
    }

    items.sort((a, b) =>
      String(a.displayName || a.name || a.email).localeCompare(String(b.displayName || b.name || b.email), 'vi')
    );

    res.json({
      total: items.length,
      classSubjectAverages,
      items
    });
  })
);

// Lấy bảng điểm chi tiết theo Topic (Môn học) và bài tập của học sinh
peopleRouter.get(
  '/students/:id/grades',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const studentId = String(req.params.id);
    const transcript = await getStudentTranscript(studentId);
    if (!transcript) {
      return res.status(404).json({ error: { message: 'Không tìm thấy hồ sơ học sinh' } });
    }
    res.json(transcript);
  })
);

// Lấy theo đường dẫn định danh: /api/people/teachers hoặc /api/people/students
peopleRouter.get(
  '/:kind',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const isTeacherReq = req.params.kind === 'teachers';
    const s = await col('people').get();
    const filterFn = isTeacherReq ? isTeacher : isStudent;
    let items = s.docs.map(mapPersonDoc).filter(filterFn);

    let classSubjectAverages: Record<string, number | null> | undefined = undefined;
    if (!isTeacherReq) {
      const enrichedRes = await enrichStudentItems(items);
      items = enrichedRes.items;
      classSubjectAverages = enrichedRes.classSubjectAverages;
    }

    items.sort((a, b) =>
      String(a.displayName || a.name || a.email).localeCompare(String(b.displayName || b.name || b.email), 'vi')
    );

    res.json({
      total: items.length,
      classSubjectAverages,
      items
    });
  })
);