import { FieldValue } from 'firebase-admin/firestore';
import { env } from '../../config/env.js';
import { col } from '../../core/firebase.js';
import { googleJson } from '../../integrations/dwd.js';
import { autoDetectClass, autoDetectSubject } from '../catalog/catalog.service.js';
import { evaluateAlertRules } from '../alerts/alert-engine.service.js';

const scopes = [
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly'
];

const base = 'https://classroom.googleapis.com/v1';

// Retry với exponential backoff cho transient errors
async function fetchWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      if (attempt === maxRetries || (err.message && !err.message.includes('429') && !err.message.includes('503'))) {
        throw err;
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Retries exhausted');
}

async function listAll<T>(url: string, subject: string, key: string, customToken?: string): Promise<T[]> {
  let page = '';
  const out: T[] = [];
  do {
    const u = new URL(url);
    u.searchParams.set('pageSize', '100');
    if (page) u.searchParams.set('pageToken', page);

    const d = await fetchWithRetry(async () => {
      if (customToken) {
        const res = await fetch(u.toString(), {
          headers: { Authorization: `Bearer ${customToken}`, 'Content-Type': 'application/json' }
        });
        if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
        return (await res.json()) as any;
      }
      return await googleJson<any>(u.toString(), subject, scopes);
    });

    out.push(...(d[key] || []));
    page = d.nextPageToken || '';
  } while (page);
  return out;
}

export type Course = {
  id: string;
  name: string;
  section?: string;
  descriptionHeading?: string;
  description?: string;
  room?: string;
  ownerId?: string;
  courseState?: 'ACTIVE' | 'ARCHIVED' | 'PROVISIONED' | 'DECLINED' | 'SUSPENDED';
  alternateLink?: string;
  calendarId?: string;
  gradebookSettings?: any;
  creationTime?: string;
  updateTime?: string;
  classId?: string;
  className?: string;
  grade?: number;
  subjectId?: string;
  subjectName?: string;
};

export async function discoverCourses(subject: string, customToken?: string): Promise<Course[]> {
  const merged = new Map<string, Course>();

  // 1. Quét với vai trò giáo viên (teacherId)
  try {
    const u = new URL(`${base}/courses`);
    if (customToken) {
      u.searchParams.set('teacherId', 'me');
    } else if (subject) {
      u.searchParams.set('teacherId', subject);
    }
    u.searchParams.append('courseStates', 'ACTIVE');
    u.searchParams.append('courseStates', 'ARCHIVED');
    u.searchParams.append('courseStates', 'PROVISIONED');
    const teacherCourses = await listAll<Course>(u.toString(), subject, 'courses', customToken);
    for (const c of teacherCourses) merged.set(c.id, c);
  } catch (err: any) {
    console.warn('Teacher courses scan notice:', err.message);
  }

  // 2. Nếu là token cá nhân OAuth, quét thêm các lớp mà user tham gia (studentId)
  if (customToken) {
    try {
      const u2 = new URL(`${base}/courses`);
      u2.searchParams.set('studentId', 'me');
      u2.searchParams.append('courseStates', 'ACTIVE');
      const studentCourses = await listAll<Course>(u2.toString(), subject, 'courses', customToken);
      for (const c of studentCourses) merged.set(c.id, c);
    } catch {}
  }

  // 3. Nếu là Super Admin Workspace hoặc chưa có khóa học, quét toàn bộ
  if (merged.size === 0) {
    try {
      const u3 = new URL(`${base}/courses`);
      u3.searchParams.append('courseStates', 'ACTIVE');
      const allCourses = await listAll<Course>(u3.toString(), subject, 'courses', customToken);
      for (const c of allCourses) merged.set(c.id, c);
    } catch {}
  }

  return Array.from(merged.values());
}

export async function syncCourse(course: Course, subject = env.WORKSPACE_ADMIN_SUBJECT, customToken?: string) {
  const ref = col('courses').doc(course.id);

  // Kiểm tra mapping lớp & môn học có sẵn, nếu chưa có thì tự động gợi ý
  const [classMapDoc, subMapDoc] = await Promise.all([
    col('classMappings').doc(course.id).get(),
    col('subjectMappings').doc(course.id).get()
  ]);

  let classId = classMapDoc.data()?.classId;
  let className = classMapDoc.data()?.className;
  let grade = classMapDoc.data()?.grade;
  let subjectId = subMapDoc.data()?.subjectId;
  let subjectName = subMapDoc.data()?.subjectName;

  if (!classId) {
    const autoClass = autoDetectClass(course.name);
    if (autoClass) {
      classId = autoClass.classId;
      className = autoClass.className;
      grade = autoClass.grade;
      await col('classMappings').doc(course.id).set({
        courseId: course.id,
        courseName: course.name,
        classId,
        className,
        grade,
        confidence: autoClass.confidence,
        confirmed: false,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  if (!subjectId) {
    const autoSub = autoDetectSubject(course.name);
    if (autoSub) {
      subjectId = autoSub.subjectId;
      subjectName = autoSub.subjectName;
      await col('subjectMappings').doc(course.id).set({
        courseId: course.id,
        courseName: course.name,
        subjectId,
        subjectName,
        confidence: autoSub.confidence,
        confirmed: false,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }

  await ref.set(
    {
      ...course,
      classId: classId || null,
      className: className || null,
      grade: grade || null,
      subjectId: subjectId || null,
      subjectName: subjectName || null,
      source: 'CLASSROOM',
      dataStatus: 'COMPLETE',
      lastSyncAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  // Lấy dữ liệu chi tiết
  const [teachers, students, work, materials, announcements, topics] = await Promise.all([
    listAll<any>(`${base}/courses/${course.id}/teachers`, subject, 'teachers', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/students`, subject, 'students', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/courseWork`, subject, 'courseWork', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/courseWorkMaterials`, subject, 'courseWorkMaterial', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/announcements`, subject, 'announcements', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/topics`, subject, 'topic', customToken).catch(() => [])
  ]);

  const writer = ref.firestore.bulkWriter();

  // Đồng bộ thành viên
  for (const [role, arr] of [['TEACHER', teachers], ['STUDENT', students]] as const) {
    for (const m of arr) {
      const id = m.userId || m.profile?.id;
      if (id) {
        writer.set(
          ref.collection('members').doc(id),
          {
            userId: id,
            role,
            email: m.profile?.emailAddress || null,
            name: m.profile?.name?.fullName || null,
            photoUrl: m.profile?.photoUrl || null,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        // Cập nhật sổ danh bạ trường tổng hợp từ Google Classroom
        const orgUnit = role === 'TEACHER'
          ? '/Giáo viên'
          : (classId ? `/Học sinh/Khối ${grade || classId[0]}/Lớp ${classId}` : '/Học sinh');

        col('people').doc(id).set(
          {
            personId: id,
            email: m.profile?.emailAddress || null,
            displayName: m.profile?.name?.fullName || null,
            photoUrl: m.profile?.photoUrl || null,
            personType: role,
            role,
            orgUnitPath: orgUnit,
            className: classId || null,
            classId: classId || null,
            courses: FieldValue.arrayUnion(course.id),
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
    }
  }

  for (const x of work) {
    writer.set(ref.collection('coursework').doc(x.id), { ...x, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  for (const x of materials) {
    writer.set(ref.collection('materials').doc(x.id), { ...x, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  for (const x of announcements) {
    writer.set(ref.collection('announcements').doc(x.id), { ...x, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  for (const x of topics) {
    writer.set(ref.collection('topics').doc(x.topicId || x.id), { ...x, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  // Đồng bộ đầy đủ toàn bộ submissions (không giới hạn 50 bài)
  let submissionsTotal = 0;
  let submissionsTurnedIn = 0;
  let submissionsLate = 0;
  let submissionsGraded = 0;
  let totalScoreAssigned = 0;
  let totalMaxScore = 0;

  for (const item of work) {
    try {
      const subs = await listAll<any>(
        `${base}/courses/${course.id}/courseWork/${item.id}/studentSubmissions`,
        subject,
        'studentSubmissions',
        customToken
      );

      submissionsTotal += subs.length;
      for (const s of subs) {
        const isTurnedIn = ['TURNED_IN', 'RETURNED'].includes(s.state);
        if (isTurnedIn) submissionsTurnedIn++;
        if (s.late) submissionsLate++;
        if (s.assignedGrade != null) {
          submissionsGraded++;
          totalScoreAssigned += Number(s.assignedGrade);
          totalMaxScore += Number(item.maxPoints || 10);
        }

        writer.set(
          ref.collection('submissions').doc(s.id),
          {
            ...s,
            courseWorkId: item.id,
            courseWorkTitle: item.title,
            courseId: course.id,
            maxPoints: item.maxPoints || 10,
            dueDate: item.dueDate || null,
            dueTime: item.dueTime || null,
            isTurnedIn,
            isLate: Boolean(s.late),
            isGraded: s.assignedGrade != null,
            updatedAt: FieldValue.serverTimestamp()
          },
          { merge: true }
        );
      }
    } catch {}
  }

  const completionRate = submissionsTotal ? Math.round((submissionsTurnedIn / submissionsTotal) * 1000) / 10 : null;
  const onTimeRate = submissionsTurnedIn ? Math.round(((submissionsTurnedIn - submissionsLate) / submissionsTurnedIn) * 1000) / 10 : null;
  const avgScore = totalMaxScore ? Math.round((totalScoreAssigned / totalMaxScore) * 100) / 10 : null;

  writer.set(
    ref,
    {
      roster: {
        teachers: teachers.length,
        students: students.length,
        status: 'COMPLETE'
      },
      content: {
        coursework: work.length,
        materials: materials.length,
        announcements: announcements.length,
        topics: topics.length,
        submissionsTotal,
        submissionsTurnedIn,
        submissionsLate,
        submissionsGraded,
        completionRate,
        onTimeRate,
        averageScore: avgScore,
        status: 'COMPLETE'
      },
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await writer.close();

  return {
    courseId: course.id,
    teachers: teachers.length,
    students: students.length,
    work: work.length,
    submissions: submissionsTotal
  };
}

export async function syncAllCourses(teachers: string[] = [], customToken?: string, performedBy = 'SYSTEM') {
  const runId = `sync_${Date.now()}`;
  const runRef = col('syncRuns').doc(runId);

  await runRef.set({
    runId,
    startTime: FieldValue.serverTimestamp(),
    status: 'IN_PROGRESS',
    performedBy,
    coursesTotal: 0,
    coursesSuccess: 0,
    coursesError: 0,
    errors: []
  });

  const map = new Map<string, Course>();
  const errorLogs: Array<{ courseId?: string; error: string }> = [];

  // Quét danh sách khóa học
  if (customToken) {
    try {
      const courses = await discoverCourses('', customToken);
      for (const c of courses) map.set(c.id, c);
    } catch (err: any) {
      errorLogs.push({ error: `Khám phá khóa học OAuth thất bại: ${err.message}` });
    }
  } else if (teachers.length) {
    for (const t of teachers) {
      try {
        const courses = await discoverCourses(t);
        for (const c of courses) map.set(c.id, c);
      } catch (err: any) {
        errorLogs.push({ error: `Quét giáo viên ${t} thất bại: ${err.message}` });
      }
    }
  } else if (env.WORKSPACE_ADMIN_SUBJECT) {
    try {
      const courses = await discoverCourses(env.WORKSPACE_ADMIN_SUBJECT);
      for (const c of courses) map.set(c.id, c);
    } catch (err: any) {
      errorLogs.push({ error: `Quét admin subject thất bại: ${err.message}` });
    }
  }

  let successCount = 0;
  for (const c of map.values()) {
    try {
      await syncCourse(c, env.WORKSPACE_ADMIN_SUBJECT, customToken);
      successCount++;
    } catch (err: any) {
      errorLogs.push({ courseId: c.id, error: `Đồng bộ khóa học ${c.name} (${c.id}) lỗi: ${err.message}` });
    }
  }

  await runRef.set(
    {
      endTime: FieldValue.serverTimestamp(),
      status: errorLogs.length === 0 ? 'COMPLETED' : successCount > 0 ? 'PARTIAL' : 'FAILED',
      coursesTotal: map.size,
      coursesSuccess: successCount,
      coursesError: errorLogs.length,
      errors: errorLogs.slice(0, 50)
    },
    { merge: true }
  );

  // Tự động tổng hợp dữ liệu lớp học và đánh giá cảnh báo từ dữ liệu Google Classroom thực tế
  await rebuildClassesFromCourses().catch((e) => console.warn('Lỗi cập nhật lớp học:', e.message));
  await evaluateAlertRules().catch((e) => console.warn('Lỗi đánh giá cảnh báo:', e.message));

  return {
    runId,
    courses: map.size,
    success: successCount,
    errors: errorLogs
  };
}

export async function rebuildClassesFromCourses(): Promise<number> {
  const coursesSnap = await col('courses').get();
  if (coursesSnap.empty || coursesSnap.size === 0) return 0;

  const classesMap = new Map<string, any>();

  for (const doc of coursesSnap.docs) {
    const c = doc.data() as any;
    const classId = c.classId;
    if (!classId) continue;

    if (!classesMap.has(classId)) {
      const grade = c.grade || Number(classId.match(/^[6789]/)?.[0] || 0) || null;
      classesMap.set(classId, {
        id: classId,
        classId,
        className: c.className || `Lớp ${classId}`,
        grade,
        active: true,
        courseCount: 0,
        courses: [],
        subjects: new Set<string>(),
        studentCount: 0,
        totalCoursework: 0,
        submissionsTotal: 0,
        submissionsTurnedIn: 0,
        submissionsLate: 0,
        totalScores: 0,
        scoredCount: 0
      });
    }

    const cls = classesMap.get(classId)!;
    cls.courseCount++;
    cls.courses.push(c.id);
    if (c.subjectName) cls.subjects.add(c.subjectName);
    const students = Number(c.roster?.students || 0);
    if (students > cls.studentCount) cls.studentCount = students;

    const cw = Number(c.content?.coursework || 0);
    cls.totalCoursework += cw;
    const subTotal = Number(c.content?.submissionsTotal || 0);
    const subTurnedIn = Number(c.content?.submissionsTurnedIn || 0);
    const subLate = Number(c.content?.submissionsLate || 0);
    cls.submissionsTotal += subTotal;
    cls.submissionsTurnedIn += subTurnedIn;
    cls.submissionsLate += subLate;

    if (c.content?.averageScore != null) {
      cls.totalScores += Number(c.content.averageScore);
      cls.scoredCount++;
    }
  }

  for (const [classId, cls] of classesMap.entries()) {
    const completionRate = cls.submissionsTotal ? Math.round((cls.submissionsTurnedIn / cls.submissionsTotal) * 1000) / 10 : null;
    const onTimeRate = cls.submissionsTurnedIn ? Math.round(((cls.submissionsTurnedIn - cls.submissionsLate) / cls.submissionsTurnedIn) * 1000) / 10 : null;
    const avgScore = cls.scoredCount ? Math.round((cls.totalScores / cls.scoredCount) * 10) / 10 : null;

    const data = {
      id: classId,
      classId,
      className: cls.className,
      grade: cls.grade,
      active: true,
      courseCount: cls.courseCount,
      courses: cls.courses,
      subjects: Array.from(cls.subjects),
      studentCount: cls.studentCount,
      totalCoursework: cls.totalCoursework,
      submissionsTotal: cls.submissionsTotal,
      submissionsTurnedIn: cls.submissionsTurnedIn,
      submissionsLate: cls.submissionsLate,
      completionRate,
      onTimeRate,
      averageScore: avgScore,
      updatedAt: FieldValue.serverTimestamp()
    };
    await col('classes').doc(classId).set(data, { merge: true });
  }

  return classesMap.size;
}

