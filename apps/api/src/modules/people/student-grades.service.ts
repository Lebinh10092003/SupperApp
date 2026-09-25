import { eq, or, inArray, and } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { people } from './people.schema.js';
import { courses, courseMembers, courseCoursework, courseSubmissions } from '../classroom/classroom.schema.js';
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
  photoUrl?: string;
  classId: string;
  className: string;
  grade: number | null;
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
  enrolledCourses?: Array<{
    id: string;
    name: string;
    subjectName?: string;
    completionRate?: number;
  }>;
}

export const STANDARD_TOPICS = [
  { topicId: 'topic_math', name: 'Toán Học', code: 'MATH', teacher: '' },
  { topicId: 'topic_literature', name: 'Ngữ Văn', code: 'LIT', teacher: '' },
  { topicId: 'topic_english', name: 'Tiếng Anh', code: 'ENG', teacher: '' },
  { topicId: 'topic_physics', name: 'Vật Lý', code: 'PHY', teacher: '' },
  { topicId: 'topic_chemistry', name: 'Hóa Học', code: 'CHEM', teacher: '' },
  { topicId: 'topic_biology', name: 'Sinh Học', code: 'BIO', teacher: '' },
  { topicId: 'topic_history', name: 'Lịch Sử', code: 'HIST', teacher: '' },
  { topicId: 'topic_geography', name: 'Địa Lý', code: 'GEO', teacher: '' },
  { topicId: 'topic_informatics', name: 'Tin Học', code: 'INF', teacher: '' },
  { topicId: 'topic_civics', name: 'Giáo Dục Công Dân', code: 'CIV', teacher: '' }
];

export async function getStudentTranscript(studentId: string): Promise<StudentTranscript | null> {
  // 1. Tìm thông tin học sinh trong bảng people hoặc course_members
  let person = await db
    .select()
    .from(people)
    .where(or(eq(people.personId, studentId), eq(people.email, studentId)))
    .then((r) => r[0] ?? null);

  let email = person?.email || '';
  let displayName = person?.displayName || (email ? email.split('@')[0] : 'Học sinh');
  let photoUrl = person?.photoUrl || '';
  let classId = person?.classId || '';
  let className = person?.className || '';

  // 2. Tìm các khóa học học sinh tham gia từ course_members
  const memberRows = await db
    .select({
      courseId: courseMembers.courseId,
      name: courseMembers.name,
      email: courseMembers.email,
      photoUrl: courseMembers.photoUrl
    })
    .from(courseMembers)
    .where(or(eq(courseMembers.userId, studentId), eq(courseMembers.email, studentId), ...(email ? [eq(courseMembers.email, email)] : [])));

  if (!person && memberRows.length === 0) {
    return null;
  }

  const firstMember = memberRows[0];
  if (firstMember) {
    if (!email && firstMember.email) email = firstMember.email;
    if ((!displayName || displayName === 'Học sinh') && firstMember.name) displayName = firstMember.name;
    if (!photoUrl && firstMember.photoUrl) photoUrl = firstMember.photoUrl;
  }

  const courseIds = Array.from(new Set(memberRows.map((m) => m.courseId)));

  // Lấy chi tiết các khóa học này
  let enrolledCourses: any[] = [];
  if (courseIds.length > 0) {
    enrolledCourses = await db
      .select()
      .from(courses)
      .where(inArray(courses.id, courseIds));
  }

  // Tự động nhận diện lớp nếu chưa có
  if (!className && enrolledCourses.length > 0) {
    const firstWithClass = enrolledCourses.find((c) => c.className || c.classId);
    if (firstWithClass) {
      className = firstWithClass.className || `Lớp ${firstWithClass.classId}`;
      classId = firstWithClass.classId || '';
    } else {
      const auto = autoDetectClass(enrolledCourses[0].name);
      if (auto) {
        className = auto.className;
        classId = auto.classId;
      }
    }
  }

  // 3. Lấy toàn bộ coursework và submissions của học sinh
  let allCoursework: any[] = [];
  let userSubmissions: any[] = [];

  if (courseIds.length > 0) {
    const [cwRows, subRows] = await Promise.all([
      db.select().from(courseCoursework).where(inArray(courseCoursework.courseId, courseIds)),
      db.select().from(courseSubmissions).where(inArray(courseSubmissions.courseId, courseIds))
    ]);
    allCoursework = cwRows;
    userSubmissions = subRows.filter((r) => {
      const d = r.data as any;
      return d?.userId === studentId || (email && d?.userId === email);
    });
  }

  // 4. Nhóm bài tập và bài nộp theo từng khóa học
  let totalScoreSum = 0;
  let totalScoreCount = 0;
  let totalAssignmentsCount = allCoursework.length;
  let totalSubmittedCount = 0;

  const subjects: SubjectTopicGrade[] = enrolledCourses.map((c) => {
    const courseCw = allCoursework.filter((w) => w.courseId === c.id);
    let submitted = 0;
    let scoreSum = 0;
    let graded = 0;

    const assignments = courseCw.map((cw) => {
      const d = cw.data as any;
      const sub = userSubmissions.find((s) => s.courseWorkId === cw.courseWorkId || s.courseWorkId === cw.id);
      const isTurnedIn = sub ? Boolean(sub.isTurnedIn) : false;
      if (isTurnedIn) submitted++;

      const assignedGrade = sub?.assignedGrade != null ? Number(sub.assignedGrade) : null;
      if (assignedGrade != null) {
        graded++;
        scoreSum += (assignedGrade / Number(d?.maxPoints || 10)) * 10;
      }

      return {
        id: cw.courseWorkId || cw.id,
        title: cleanCourseName(d?.title) || 'Bài tập môn học',
        dueDate: d?.dueDate ? `${d.dueDate.year}-${d.dueDate.month}-${d.dueDate.day}` : null,
        maxPoints: Number(d?.maxPoints || 10),
        assignedGrade,
        state: isTurnedIn ? ('TURNED_IN' as const) : ('NEW' as const),
        isLate: Boolean(sub?.isLate)
      };
    });

    const avgScore = graded > 0 ? Math.round((scoreSum / graded) * 10) / 10 : null;
    if (avgScore != null) {
      totalScoreSum += avgScore;
      totalScoreCount++;
    }
    totalSubmittedCount += submitted;

    const compRate = courseCw.length > 0 ? Math.round((submitted / courseCw.length) * 100) : 0;
    let evaluation = 'Chưa có bài nộp';
    if (avgScore != null) {
      if (avgScore >= 9.0) evaluation = 'Xuất sắc: Nắm sâu kiến thức, nộp bài đầy đủ';
      else if (avgScore >= 8.0) evaluation = 'Giỏi: Tiếp thu bài tốt, hoàn thành đúng hạn';
      else if (avgScore >= 6.5) evaluation = 'Khá: Cần chú ý làm bài tập về nhà';
      else evaluation = 'Cần đôn đốc thêm';
    } else if (courseCw.length > 0) {
      evaluation = 'Đang chờ giáo viên chấm bài';
    }

    return {
      topicId: c.id,
      topicName: c.name,
      subjectCode: c.subjectName || 'MON',
      teacherName: c.section || 'Giáo viên bộ môn',
      totalAssignments: courseCw.length,
      submittedCount: submitted,
      missingCount: Math.max(0, courseCw.length - submitted),
      completionRate: compRate,
      averageScore: avgScore,
      evaluation,
      assignments
    };
  });

  const gpa = totalScoreCount > 0 ? Math.round((totalScoreSum / totalScoreCount) * 10) / 10 : null;
  const overallComp = totalAssignmentsCount > 0 ? Math.round((totalSubmittedCount / totalAssignmentsCount) * 100) : 0;
  let rank = 'Chưa xếp hạng';
  if (gpa != null) {
    if (gpa >= 9.0) rank = 'Học sinh Xuất sắc';
    else if (gpa >= 8.0) rank = 'Học sinh Giỏi';
    else if (gpa >= 6.5) rank = 'Học sinh Khá';
    else rank = 'Đạt';
  }

  return {
    studentId,
    displayName: String(displayName || (email ? email.split('@')[0] : 'Học sinh')),
    email: String(email || ''),
    photoUrl: photoUrl || undefined,
    classId: classId || '',
    className: className || 'Chưa phân lớp',
    grade: classId ? Number(classId.match(/^[0-9]+/)?.[0]) || null : null,
    academicYear: '2025–2026',
    semester: 'Học kỳ I',
    summary: {
      totalSubjects: enrolledCourses.length,
      gpa,
      rank,
      totalAssignments: totalAssignmentsCount,
      submittedAssignments: totalSubmittedCount,
      completionRate: overallComp
    },
    subjects,
    enrolledCourses: enrolledCourses.map((c) => ({
      id: c.id,
      name: c.name,
      subjectName: c.subjectName,
      completionRate: c.completionRate != null ? Number(c.completionRate) : undefined
    }))
  };
}
