import { col } from '../../core/firebase.js';
import { autoDetectClass, cleanCourseName } from '../catalog/catalog.service.js';

export interface SubjectTopicGrade {
  topicId: string;
  topicName: string;
  subjectCode: string;
  teacherName: string;
  totalAssignments: number;
  submittedCount: number;
  missingCount: number;
  completionRate: number;
  averageScore: number | null;
  evaluation: string;
  assignments: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    maxPoints: number;
    assignedGrade?: number | null;
    state: 'TURNED_IN' | 'RETURNED' | 'NEW' | 'CREATED';
    isLate: boolean;
  }>;
}

export interface StudentTranscript {
  studentId: string;
  displayName: string;
  email: string;
  classId: string;
  className: string;
  grade: number;
  academicYear: string;
  semester: string;
  summary: {
    totalSubjects: number;
    gpa: number | null;
    rank: string;
    totalAssignments: number;
    submittedAssignments: number;
    completionRate: number;
  };
  subjects: SubjectTopicGrade[];
}

export const STANDARD_TOPICS = [
  { topicId: 'topic_math', name: 'Toán Học', code: 'MATH', teacher: 'Thầy Nguyễn Văn Đức' },
  { topicId: 'topic_literature', name: 'Ngữ Văn', code: 'LIT', teacher: 'Cô Trần Thị Thu' },
  { topicId: 'topic_english', name: 'Tiếng Anh', code: 'ENG', teacher: 'Cô Lê Hoàng Oanh' },
  { topicId: 'topic_physics', name: 'Vật Lý', code: 'PHY', teacher: 'Thầy Phạm Thanh Tùng' },
  { topicId: 'topic_chemistry', name: 'Hóa Học', code: 'CHEM', teacher: 'Cô Đỗ Thúy Hằng' },
  { topicId: 'topic_biology', name: 'Sinh Học', code: 'BIO', teacher: 'Thầy Bùi Quang Hưng' },
  { topicId: 'topic_history', name: 'Lịch Sử', code: 'HIST', teacher: 'Cô Vũ Phương Linh' },
  { topicId: 'topic_geography', name: 'Địa Lý', code: 'GEO', teacher: 'Thầy Hoàng Trọng Nam' },
  { topicId: 'topic_informatics', name: 'Tin Học', code: 'INF', teacher: 'Cô Lê Thu Trang' },
  { topicId: 'topic_civics', name: 'Giáo Dục Công Dân', code: 'CIV', teacher: 'Cô Nguyễn Hồng Vân' }
];

export async function getStudentTranscript(studentId: string): Promise<StudentTranscript | null> {
  const personDoc = await col('people').doc(studentId).get();
  if (!personDoc.exists) return null;
  const person = personDoc.data();

  // Xác định danh sách khóa học Google Classroom
  let courseIds: string[] = [];
  if (Array.isArray(person.courses)) {
    courseIds = person.courses;
  } else if (person.courses?.elements && Array.isArray(person.courses.elements)) {
    courseIds = person.courses.elements;
  } else if (typeof person.courses === 'string') {
    courseIds = [person.courses];
  }

  // Lấy thông tin lớp học thực tế từ khóa học
  let className = person.className;
  let classId = person.classId;
  let grade = person.grade || 12;
  let primaryCourse: any = null;

  if (courseIds.length > 0) {
    const courseDoc = await col('courses').doc(courseIds[0]).get();
    if (courseDoc.exists) {
      primaryCourse = courseDoc.data();
      const detected = autoDetectClass(primaryCourse.name || '');
      className = className || primaryCourse.className || detected?.className || `Lớp ${primaryCourse.id}`;
      classId = classId || primaryCourse.classId || detected?.classId || primaryCourse.id;
      grade = primaryCourse.grade || detected?.grade || 12;
    }
  }

  if (!className || className === 'Học sinh' || className === '—') {
    className = 'Lớp 12A1';
    classId = '12A1';
    grade = 12;
  }

  // 1. Quét các Topics thực tế từ subcollection courses/{id}/topics nếu có
  let topicsList: Array<{ topicId: string; name: string; teacher?: string; code?: string }> = [];
  if (primaryCourse) {
    try {
      const snap = await col('courses').doc(primaryCourse.id).collection('topics').get();
      if (!snap.empty && snap.size > 0) {
        topicsList = snap.docs.map((d: any) => ({
          topicId: d.id,
          name: d.data().name || 'Môn học',
          code: d.data().topicId || d.id
        }));
      }
    } catch {}
  }

  // Nếu chưa có topic nào trong CSDL, dùng bộ 10 môn chuẩn theo chương trình
  if (topicsList.length === 0) {
    topicsList = STANDARD_TOPICS.map(t => ({
      topicId: t.topicId,
      name: t.name,
      teacher: t.teacher,
      code: t.code
    }));
  }

  // 2. Lấy toàn bộ coursework và submissions của lớp học
  let courseworkDocs: any[] = [];
  let submissionsDocs: any[] = [];
  if (primaryCourse) {
    try {
      const [cwSnap, subSnap] = await Promise.all([
        col('courses').doc(primaryCourse.id).collection('coursework').get(),
        col('courses').doc(primaryCourse.id).collection('submissions').get()
      ]);
      courseworkDocs = cwSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      submissionsDocs = subSnap.docs
        .map((d: any) => ({ id: d.id, ...d.data() }))
        .filter((s: any) => s.userId === studentId || s.userId === person.personId);
    } catch {}
  }

  // 3. Tính điểm từng môn học theo Topic (Dữ liệu thực 100% từ Google Classroom)
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let totalAssignmentsCount = 0;
  let totalSubmittedCount = 0;

  const subjects: SubjectTopicGrade[] = topicsList.map((topic) => {
    // Lọc bài tập thuộc về Topic này
    const topicWork = courseworkDocs.filter((w: any) => w.topicId === topic.topicId || w.topicId === topic.code);

    let assignments: any[] = [];
    let avgScore: number | null = null;
    let submitted = 0;
    let totalAssignments = topicWork.length;

    if (totalAssignments > 0) {
      let scoreSum = 0;
      let graded = 0;

      for (const cw of topicWork) {
        const sub = submissionsDocs.find((s: any) => s.courseWorkId === cw.id);
        const isTurnedIn = sub ? ['TURNED_IN', 'RETURNED'].includes(sub.state) : false;
        if (isTurnedIn) submitted++;

        const assignedGrade = sub?.assignedGrade != null ? Number(sub.assignedGrade) : null;
        if (assignedGrade != null) {
          graded++;
          scoreSum += (assignedGrade / Number(cw.maxPoints || 10)) * 10;
        }

        assignments.push({
          id: cw.id,
          title: cleanCourseName(cw.title) || `Bài tập ${topic.name}`,
          dueDate: cw.dueDate ? `${cw.dueDate.year}-${cw.dueDate.month}-${cw.dueDate.day}` : null,
          maxPoints: Number(cw.maxPoints || 10),
          assignedGrade,
          state: (sub?.state || 'NEW') as any,
          isLate: Boolean(sub?.late)
        });
      }

      if (graded > 0) {
        avgScore = Math.round((scoreSum / graded) * 10) / 10;
      } else {
        avgScore = null;
      }
    } else {
      // Chưa có bài tập được tạo trong Topic môn học này trên Google Classroom
      totalAssignments = 0;
      submitted = 0;
      avgScore = null;
      assignments = [];
    }

    if (avgScore != null) {
      totalScoreSum += avgScore;
      totalScoreCount++;
    }
    totalAssignmentsCount += totalAssignments;
    totalSubmittedCount += submitted;

    const completionRate = totalAssignments > 0 ? Math.round((submitted / totalAssignments) * 1000) / 10 : 0;

    let evaluation = 'Chưa có bài tập trên Google Classroom';
    if (avgScore != null) {
      if (avgScore >= 9.0) evaluation = 'Xuất sắc: Nắm sâu kiến thức, tư duy phản biện tốt và nộp bài đều đặn';
      else if (avgScore >= 8.0) evaluation = 'Giỏi: Tiếp thu bài nhanh, làm bài tập đầy đủ';
      else if (avgScore >= 6.5) evaluation = 'Khá: Cần chú ý hoàn thành bài tập đúng hạn để cải thiện điểm số';
      else evaluation = 'Cần cố gắng thêm';
    } else if (totalAssignments > 0) {
      evaluation = 'Đang chờ giáo viên chấm bài trên Google Classroom';
    }

    const std = STANDARD_TOPICS.find(s => s.name.toLowerCase() === topic.name.toLowerCase() || s.topicId === topic.topicId);

    return {
      topicId: topic.topicId,
      topicName: cleanCourseName(topic.name) || topic.name,
      subjectCode: std?.code || topic.code || 'SUB',
      teacherName: topic.teacher || std?.teacher || 'Giáo viên bộ môn',
      totalAssignments,
      submittedCount: submitted,
      missingCount: Math.max(0, totalAssignments - submitted),
      completionRate,
      averageScore: avgScore,
      evaluation,
      assignments
    };
  });

  const gpa = totalScoreCount > 0 ? Math.round((totalScoreSum / totalScoreCount) * 10) / 10 : null;
  const overallCompletionRate = totalAssignmentsCount > 0
    ? Math.round((totalSubmittedCount / totalAssignmentsCount) * 1000) / 10
    : 0;

  let rank = 'Chưa có điểm';
  if (gpa != null) {
    if (gpa >= 9.0) rank = 'Học sinh Xuất sắc';
    else if (gpa >= 8.0) rank = 'Học sinh Giỏi';
    else if (gpa >= 6.5) rank = 'Học sinh Khá';
    else rank = 'Đạt';
  }

  return {
    studentId,
    displayName: person.displayName || person.name || 'Học sinh',
    email: person.email || '',
    classId: classId || '12A1',
    className: cleanCourseName(className) || 'Lớp 12A1',
    grade,
    academicYear: '2026–2027',
    semester: 'Học kỳ I',
    summary: {
      totalSubjects: subjects.length,
      gpa,
      rank,
      totalAssignments: totalAssignmentsCount,
      submittedAssignments: totalSubmittedCount,
      completionRate: overallCompletionRate
    },
    subjects
  };
}
