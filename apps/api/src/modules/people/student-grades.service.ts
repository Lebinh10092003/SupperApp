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

export interface LearningCurvePoint {
  id: string;
  title: string;
  subjectName: string;
  date: string;
  score: number;
  maxPoints: number;
  standardizedScore: number;
}

export interface RadarSkill {
  subject: string;
  score: number;
  completionRate: number;
  fullMark: number;
}

export interface DigitalDiscipline {
  onTimeCount: number;
  lateCount: number;
  missingCount: number;
  onTimeRate: number;
  disciplineScore: number;
  habitAssessment: string;
}

export interface AtRiskAssessment {
  level: 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'ATTENTION' | 'CRITICAL';
  label: string;
  velocityDelta: number;
  velocityStatus: 'ACCELERATING' | 'STEADY' | 'DECLINING';
  reasons: string[];
  recommendedAction: string;
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
  learningCurve?: LearningCurvePoint[];
  radarSkills?: RadarSkill[];
  digitalDiscipline?: DigitalDiscipline;
  atRisk?: AtRiskAssessment;
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

  // 5. Chuỗi thời gian Đường cong học tập (Learning Curve)
  const gradedList: LearningCurvePoint[] = [];
  let lateCount = 0;

  for (const s of subjects) {
    for (const a of s.assignments) {
      if (a.isLate) lateCount++;
      if (a.assignedGrade != null) {
        gradedList.push({
          id: a.id,
          title: a.title,
          subjectName: s.subjectCode || s.topicName.split(' ')[0] || 'Chung',
          date: a.dueDate || 'Gần đây',
          score: a.assignedGrade,
          maxPoints: a.maxPoints || 10,
          standardizedScore: Math.round((a.assignedGrade / (a.maxPoints || 10)) * 10 * 10) / 10
        });
      }
    }
  }

  gradedList.sort((a, b) => (a.date > b.date ? 1 : -1));

  // 6. Tính chỉ số Đà tiến bộ (Academic Velocity Delta)
  let velocityDelta = 0;
  let velocityStatus: 'ACCELERATING' | 'STEADY' | 'DECLINING' = 'STEADY';
  if (gradedList.length >= 4) {
    const half = Math.floor(gradedList.length / 2);
    const firstHalf = gradedList.slice(0, half);
    const secondHalf = gradedList.slice(half);
    const avg1 = firstHalf.reduce((acc, curr) => acc + curr.standardizedScore, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((acc, curr) => acc + curr.standardizedScore, 0) / secondHalf.length;
    velocityDelta = Math.round((avg2 - avg1) * 10) / 10;
    if (velocityDelta >= 0.4) velocityStatus = 'ACCELERATING';
    else if (velocityDelta <= -0.4) velocityStatus = 'DECLINING';
    else velocityStatus = 'STEADY';
  }

  // 7. Radar đánh giá năng lực liên môn
  const radarSkills: RadarSkill[] = subjects.map((s) => ({
    subject: s.subjectCode || s.topicName.split(' ')[0] || 'Chung',
    score: s.averageScore != null ? s.averageScore : (gpa != null ? gpa : 7.0),
    completionRate: s.completionRate,
    fullMark: 10
  }));

  // 8. Đánh giá Kỷ luật học tập số (Digital Discipline)
  const missingCount = Math.max(0, totalAssignmentsCount - totalSubmittedCount);
  const onTimeCount = Math.max(0, totalSubmittedCount - lateCount);
  const onTimeRate = totalSubmittedCount > 0 ? Math.round((onTimeCount / totalSubmittedCount) * 100) : 100;
  const disciplineScore = Math.round(overallComp * 0.7 + onTimeRate * 0.3);
  let habitAssessment = 'Kỷ luật số tốt, nộp bài đầy đủ và đúng hạn';
  if (missingCount >= 3) {
    habitAssessment = 'Thiếu nhiều bài tập, cần đôn đốc khẩn trương';
  } else if (lateCount > 2) {
    habitAssessment = 'Có thói quen nộp muộn sát giờ, cần cải thiện tốc độ hoàn thành';
  } else if (overallComp >= 90) {
    habitAssessment = 'Tác phong học tập số chuẩn mực, nộp bài chủ động';
  }

  // 9. Phân loại Học sinh Nguy cơ (At-Risk Assessment)
  let atRiskLevel: 'EXCELLENT' | 'GOOD' | 'NORMAL' | 'ATTENTION' | 'CRITICAL' = 'NORMAL';
  let atRiskLabel = 'Đạt chuẩn tiến độ';
  const reasons: string[] = [];
  let recommendedAction = 'Tiếp tục duy trì nề nếp và tinh thần học tập tích cực.';

  if (missingCount >= 3 || (gpa != null && gpa < 5.0) || velocityDelta <= -1.0) {
    atRiskLevel = 'CRITICAL';
    atRiskLabel = 'Nguy cơ cao - Cần can thiệp';
    if (missingCount >= 3) reasons.push(`Đang bỏ lỡ ${missingCount} bài tập chưa nộp`);
    if (gpa != null && gpa < 5.0) reasons.push(`Điểm số trung bình dưới chuẩn (${gpa} điểm)`);
    if (velocityDelta <= -1.0) reasons.push(`Đà học tập tụt dốc mạnh (${velocityDelta} điểm)`);
    recommendedAction = 'GVCN cần liên hệ trực tiếp với phụ huynh để phối hợp đôn đốc học sinh nộp bài bù.';
  } else if (missingCount >= 2 || (gpa != null && gpa < 6.5) || velocityDelta <= -0.5) {
    atRiskLevel = 'ATTENTION';
    atRiskLabel = 'Cần quan tâm theo dõi';
    if (missingCount >= 2) reasons.push(`Còn ${missingCount} bài tập chưa nộp`);
    if (velocityDelta <= -0.5) reasons.push(`Điểm số các bài gần đây có xu hướng giảm (${velocityDelta})`);
    recommendedAction = 'Nhắc nhở học sinh trong giờ sinh hoạt lớp và giao nhóm bạn cùng tiến kèm cặp.';
  } else if (gpa != null && gpa >= 8.5 && overallComp >= 90) {
    atRiskLevel = 'EXCELLENT';
    atRiskLabel = 'Học sinh Xuất sắc';
    reasons.push('Điểm trung bình và tỷ lệ hoàn thành ở nhóm dẫn đầu trường');
    recommendedAction = 'Gợi ý tham gia các đội tuyển học sinh giỏi hoặc làm nhóm trưởng môn học.';
  } else if (gpa != null && gpa >= 7.5) {
    atRiskLevel = 'GOOD';
    atRiskLabel = 'Học sinh Khá Giỏi';
    reasons.push('Hoàn thành tốt các nhiệm vụ học tập trên Google Classroom');
    recommendedAction = 'Tiếp tục phát huy và thử sức với các bài tập nâng cao.';
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
    })),
    learningCurve: gradedList,
    radarSkills,
    digitalDiscipline: {
      onTimeCount,
      lateCount,
      missingCount,
      onTimeRate,
      disciplineScore,
      habitAssessment
    },
    atRisk: {
      level: atRiskLevel,
      label: atRiskLabel,
      velocityDelta,
      velocityStatus,
      reasons,
      recommendedAction
    }
  };
}
