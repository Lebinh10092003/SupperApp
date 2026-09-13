import { sql, eq } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../core/db/client.js';
import { googleJson } from '../../integrations/dwd.js';
import { autoDetectClass, autoDetectSubject } from '../catalog/catalog.service.js';
import { evaluateAlertRules } from '../alerts/alert-engine.service.js';
import { people } from '../people/people.schema.js';
import { classes } from '../classes/classes.schema.js';
import {
  courses,
  courseMembers,
  courseCoursework,
  courseMaterials,
  courseAnnouncements,
  courseTopics,
  courseSubmissions,
  classMappings,
  subjectMappings,
  syncRuns
} from './classroom.schema.js';

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
      await new Promise((r) => setTimeout(r, delay));
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
  let lastError: Error | null = null;

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
    lastError = err;
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
    } catch (err: any) {
      lastError = lastError || err;
    }
  }

  // 3. Nếu là Super Admin Workspace hoặc chưa có khóa học, quét toàn bộ
  if (merged.size === 0) {
    try {
      const u3 = new URL(`${base}/courses`);
      u3.searchParams.append('courseStates', 'ACTIVE');
      const allCourses = await listAll<Course>(u3.toString(), subject, 'courses', customToken);
      for (const c of allCourses) merged.set(c.id, c);
    } catch (err: any) {
      lastError = lastError || err;
    }
  }

  if (merged.size === 0 && lastError && customToken) {
    if (lastError.message?.includes('401')) {
      throw new Error('Google Access Token không hợp lệ hoặc đã hết hạn (401 Unauthorized). Vui lòng cấp lại Token mới từ Google OAuth Playground.');
    }
    if (lastError.message?.includes('403')) {
      throw new Error(`Google Classroom API trả về 403 Forbidden: ${lastError.message}. Vui lòng kiểm tra quyền truy cập Classroom.`);
    }
  }

  return Array.from(merged.values());
}

/** Ghép thêm 1 courseId vào cột jsonb `courses` của người này, không trùng lặp. */
function appendCourseIdSql(column: typeof people.courses, courseId: string) {
  const courseJson = JSON.stringify([courseId]);
  return sql`(
    SELECT jsonb_agg(DISTINCT value)
    FROM jsonb_array_elements(COALESCE(${column}, '[]'::jsonb) || ${courseJson}::jsonb) AS value
  )`;
}

export async function syncCourse(course: Course, subject = env.WORKSPACE_ADMIN_SUBJECT, customToken?: string) {
  // Kiểm tra mapping lớp & môn học có sẵn, nếu chưa có thì tự động gợi ý
  const [classMapRow, subMapRow] = await Promise.all([
    db.select().from(classMappings).where(eq(classMappings.courseId, course.id)).then((r) => r[0] ?? null),
    db.select().from(subjectMappings).where(eq(subjectMappings.courseId, course.id)).then((r) => r[0] ?? null)
  ]);

  let classId = classMapRow?.classId;
  let className = classMapRow?.className;
  let grade = classMapRow?.grade;
  let subjectId = subMapRow?.subjectId;
  let subjectName = subMapRow?.subjectName;

  if (!classId) {
    const autoClass = autoDetectClass(course.name);
    if (autoClass) {
      classId = autoClass.classId;
      className = autoClass.className;
      grade = autoClass.grade;
      await db
        .insert(classMappings)
        .values({
          courseId: course.id,
          courseName: course.name,
          classId,
          className,
          grade,
          confidence: String(autoClass.confidence),
          confirmed: false
        })
        .onConflictDoUpdate({
          target: classMappings.courseId,
          set: { courseName: course.name, classId, className, grade, confidence: String(autoClass.confidence), updatedAt: new Date() }
        });
    }
  }

  if (!subjectId) {
    const autoSub = autoDetectSubject(course.name);
    if (autoSub) {
      subjectId = autoSub.subjectId;
      subjectName = autoSub.subjectName;
      await db
        .insert(subjectMappings)
        .values({
          courseId: course.id,
          courseName: course.name,
          subjectId,
          subjectName,
          confidence: String(autoSub.confidence),
          confirmed: false
        })
        .onConflictDoUpdate({
          target: subjectMappings.courseId,
          set: { courseName: course.name, subjectId, subjectName, confidence: String(autoSub.confidence), updatedAt: new Date() }
        });
    }
  }

  await db
    .insert(courses)
    .values({
      id: course.id,
      name: course.name,
      section: course.section ?? null,
      descriptionHeading: course.descriptionHeading ?? null,
      description: course.description ?? null,
      room: course.room ?? null,
      ownerId: course.ownerId ?? null,
      courseState: course.courseState ?? 'ACTIVE',
      alternateLink: course.alternateLink ?? null,
      calendarId: course.calendarId ?? null,
      gradebookSettings: course.gradebookSettings ?? null,
      creationTime: course.creationTime ? new Date(course.creationTime) : null,
      updateTime: course.updateTime ? new Date(course.updateTime) : null,
      classId: classId || null,
      className: className || null,
      grade: grade || null,
      subjectId: subjectId || null,
      subjectName: subjectName || null,
      lastSyncAt: new Date()
    })
    .onConflictDoUpdate({
      target: courses.id,
      set: {
        name: course.name,
        section: course.section ?? null,
        descriptionHeading: course.descriptionHeading ?? null,
        description: course.description ?? null,
        room: course.room ?? null,
        ownerId: course.ownerId ?? null,
        courseState: course.courseState ?? 'ACTIVE',
        alternateLink: course.alternateLink ?? null,
        calendarId: course.calendarId ?? null,
        gradebookSettings: course.gradebookSettings ?? null,
        creationTime: course.creationTime ? new Date(course.creationTime) : null,
        updateTime: course.updateTime ? new Date(course.updateTime) : null,
        classId: classId || null,
        className: className || null,
        grade: grade || null,
        subjectId: subjectId || null,
        subjectName: subjectName || null,
        lastSyncAt: new Date(),
        updatedAt: new Date()
      }
    });

  // Lấy dữ liệu chi tiết
  const [teachers, students, work, materials, announcements, topics] = await Promise.all([
    listAll<any>(`${base}/courses/${course.id}/teachers`, subject, 'teachers', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/students`, subject, 'students', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/courseWork`, subject, 'courseWork', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/courseWorkMaterials`, subject, 'courseWorkMaterial', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/announcements`, subject, 'announcements', customToken).catch(() => []),
    listAll<any>(`${base}/courses/${course.id}/topics`, subject, 'topic', customToken).catch(() => [])
  ]);

  // Đồng bộ thành viên
  for (const [role, arr] of [['TEACHER', teachers], ['STUDENT', students]] as const) {
    for (const m of arr) {
      const id = m.userId || m.profile?.id;
      if (!id) continue;

      const memberId = `${course.id}_${id}`;
      await db
        .insert(courseMembers)
        .values({
          id: memberId,
          courseId: course.id,
          userId: id,
          role,
          email: m.profile?.emailAddress || null,
          name: m.profile?.name?.fullName || null,
          photoUrl: m.profile?.photoUrl || null
        })
        .onConflictDoUpdate({
          target: courseMembers.id,
          set: {
            role,
            email: m.profile?.emailAddress || null,
            name: m.profile?.name?.fullName || null,
            photoUrl: m.profile?.photoUrl || null,
            updatedAt: new Date()
          }
        });

      // Cập nhật sổ danh bạ trường tổng hợp từ Google Classroom
      const orgUnit = role === 'TEACHER' ? '/Giáo viên' : classId ? `/Học sinh/Khối ${grade || classId[0]}/Lớp ${classId}` : '/Học sinh';

      await db
        .insert(people)
        .values({
          personId: id,
          email: m.profile?.emailAddress || null,
          displayName: m.profile?.name?.fullName || null,
          photoUrl: m.profile?.photoUrl || null,
          personType: role,
          orgUnitPath: orgUnit,
          className: classId || null,
          classId: classId || null,
          courses: [course.id]
        })
        .onConflictDoUpdate({
          target: people.personId,
          set: {
            email: m.profile?.emailAddress || null,
            displayName: m.profile?.name?.fullName || null,
            photoUrl: m.profile?.photoUrl || null,
            personType: role,
            orgUnitPath: orgUnit,
            className: classId || null,
            classId: classId || null,
            courses: appendCourseIdSql(people.courses, course.id),
            updatedAt: new Date()
          }
        });
    }
  }

  for (const x of work) {
    await db
      .insert(courseCoursework)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, courseWorkId: x.id, data: x })
      .onConflictDoUpdate({ target: courseCoursework.id, set: { data: x, updatedAt: new Date() } });
  }
  for (const x of materials) {
    await db
      .insert(courseMaterials)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, data: x })
      .onConflictDoUpdate({ target: courseMaterials.id, set: { data: x, updatedAt: new Date() } });
  }
  for (const x of announcements) {
    await db
      .insert(courseAnnouncements)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, data: x })
      .onConflictDoUpdate({ target: courseAnnouncements.id, set: { data: x, updatedAt: new Date() } });
  }
  for (const x of topics) {
    const topicId = x.topicId || x.id;
    await db
      .insert(courseTopics)
      .values({ id: `${course.id}_${topicId}`, courseId: course.id, data: x })
      .onConflictDoUpdate({ target: courseTopics.id, set: { data: x, updatedAt: new Date() } });
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

        const isLate = Boolean(s.late);
        const isGraded = s.assignedGrade != null;
        const submissionId = `${course.id}_${s.id}`;
        await db
          .insert(courseSubmissions)
          .values({
            id: submissionId,
            courseId: course.id,
            courseWorkId: item.id,
            courseWorkTitle: item.title,
            maxPoints: String(item.maxPoints || 10),
            dueDate: item.dueDate || null,
            dueTime: item.dueTime || null,
            isTurnedIn,
            isLate,
            isGraded,
            data: s
          })
          .onConflictDoUpdate({
            target: courseSubmissions.id,
            set: {
              courseWorkId: item.id,
              courseWorkTitle: item.title,
              maxPoints: String(item.maxPoints || 10),
              dueDate: item.dueDate || null,
              dueTime: item.dueTime || null,
              isTurnedIn,
              isLate,
              isGraded,
              data: s,
              updatedAt: new Date()
            }
          });
      }
    } catch {}
  }

  const completionRate = submissionsTotal ? Math.round((submissionsTurnedIn / submissionsTotal) * 1000) / 10 : null;
  const onTimeRate = submissionsTurnedIn ? Math.round(((submissionsTurnedIn - submissionsLate) / submissionsTurnedIn) * 1000) / 10 : null;
  const avgScore = totalMaxScore ? Math.round((totalScoreAssigned / totalMaxScore) * 100) / 10 : null;

  await db
    .update(courses)
    .set({
      rosterTeachers: teachers.length,
      rosterStudents: students.length,
      rosterStatus: 'COMPLETE',
      contentCoursework: work.length,
      contentMaterials: materials.length,
      contentAnnouncements: announcements.length,
      contentTopics: topics.length,
      submissionsTotal,
      submissionsTurnedIn,
      submissionsLate,
      submissionsGraded,
      completionRate: completionRate != null ? String(completionRate) : null,
      onTimeRate: onTimeRate != null ? String(onTimeRate) : null,
      averageScore: avgScore != null ? String(avgScore) : null,
      contentStatus: 'COMPLETE',
      updatedAt: new Date()
    })
    .where(eq(courses.id, course.id));

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

  await db.insert(syncRuns).values({
    id: runId,
    type: 'CLASSROOM_SYNC',
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
      const found = await discoverCourses('', customToken);
      for (const c of found) map.set(c.id, c);
    } catch (err: any) {
      errorLogs.push({ error: `Khám phá khóa học OAuth thất bại: ${err.message}` });
    }
  } else if (teachers.length) {
    for (const t of teachers) {
      try {
        const found = await discoverCourses(t);
        for (const c of found) map.set(c.id, c);
      } catch (err: any) {
        errorLogs.push({ error: `Quét giáo viên ${t} thất bại: ${err.message}` });
      }
    }
  } else if (env.WORKSPACE_ADMIN_SUBJECT) {
    try {
      const found = await discoverCourses(env.WORKSPACE_ADMIN_SUBJECT);
      for (const c of found) map.set(c.id, c);
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

  await db
    .update(syncRuns)
    .set({
      finishedAt: new Date(),
      status: errorLogs.length === 0 ? 'COMPLETED' : successCount > 0 ? 'PARTIAL' : 'FAILED',
      coursesTotal: map.size,
      coursesSuccess: successCount,
      coursesError: errorLogs.length,
      errors: errorLogs.slice(0, 50)
    })
    .where(eq(syncRuns.id, runId));

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
  const allCourses = await db.select().from(courses);
  if (allCourses.length === 0) return 0;

  type ClassAgg = {
    classId: string;
    className: string;
    grade: number | null;
    courseCount: number;
    courses: string[];
    subjects: Set<string>;
    studentCount: number;
    totalCoursework: number;
    submissionsTotal: number;
    submissionsTurnedIn: number;
    submissionsLate: number;
    totalScores: number;
    scoredCount: number;
  };

  const classesMap = new Map<string, ClassAgg>();

  for (const c of allCourses) {
    const classId = c.classId;
    if (!classId) continue;

    if (!classesMap.has(classId)) {
      const grade = c.grade || Number(classId.match(/^[6789]/)?.[0] || 0) || null;
      classesMap.set(classId, {
        classId,
        className: c.className || `Lớp ${classId}`,
        grade,
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
    if (c.rosterStudents > cls.studentCount) cls.studentCount = c.rosterStudents;

    cls.totalCoursework += c.contentCoursework;
    cls.submissionsTotal += c.submissionsTotal;
    cls.submissionsTurnedIn += c.submissionsTurnedIn;
    cls.submissionsLate += c.submissionsLate;

    if (c.averageScore != null) {
      cls.totalScores += Number(c.averageScore);
      cls.scoredCount++;
    }
  }

  for (const [classId, cls] of classesMap.entries()) {
    const completionRate = cls.submissionsTotal ? Math.round((cls.submissionsTurnedIn / cls.submissionsTotal) * 1000) / 10 : null;
    const onTimeRate = cls.submissionsTurnedIn ? Math.round(((cls.submissionsTurnedIn - cls.submissionsLate) / cls.submissionsTurnedIn) * 1000) / 10 : null;
    const avgScore = cls.scoredCount ? Math.round((cls.totalScores / cls.scoredCount) * 10) / 10 : null;

    await db
      .insert(classes)
      .values({
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
        completionRate: completionRate != null ? String(completionRate) : null,
        onTimeRate: onTimeRate != null ? String(onTimeRate) : null,
        averageScore: avgScore != null ? String(avgScore) : null
      })
      .onConflictDoUpdate({
        target: classes.classId,
        set: {
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
          completionRate: completionRate != null ? String(completionRate) : null,
          onTimeRate: onTimeRate != null ? String(onTimeRate) : null,
          averageScore: avgScore != null ? String(avgScore) : null,
          updatedAt: new Date()
        }
      });
  }

  return classesMap.size;
}
