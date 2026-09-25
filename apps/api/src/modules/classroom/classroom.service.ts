import { sql, eq, count } from 'drizzle-orm';
import { env } from '../../config/env.js';
import { db } from '../../core/db/client.js';
import { googleJson } from '../../integrations/dwd.js';
import { autoDetectClass, autoDetectSubject, cleanCourseName } from '../catalog/catalog.service.js';
import { evaluateAlertRules } from '../alerts/alert-engine.service.js';
import { people } from '../people/people.schema.js';
import { classes } from '../classes/classes.schema.js';
import { schedules } from '../schedules/schedules.schema.js';
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

export async function syncCourse(course: Course, subject = env.WORKSPACE_ADMIN_SUBJECT, customToken?: string, runId?: string) {
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
      name: cleanCourseName(course.name) || course.name,
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
      syncRunId: runId ?? null
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
        syncRunId: runId ?? null,
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
    const cleaned = { ...x, title: cleanCourseName(x.title) || x.title };
    await db
      .insert(courseCoursework)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, courseWorkId: x.id, data: cleaned })
      .onConflictDoUpdate({ target: courseCoursework.id, set: { data: cleaned, updatedAt: new Date() } });
  }
  for (const x of materials) {
    const cleaned = { ...x, title: cleanCourseName(x.title) || x.title };
    await db
      .insert(courseMaterials)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, data: cleaned })
      .onConflictDoUpdate({ target: courseMaterials.id, set: { data: cleaned, updatedAt: new Date() } });
  }
  for (const x of announcements) {
    const cleaned = { ...x, text: cleanCourseName(x.text) || x.text };
    await db
      .insert(courseAnnouncements)
      .values({ id: `${course.id}_${x.id}`, courseId: course.id, data: cleaned })
      .onConflictDoUpdate({ target: courseAnnouncements.id, set: { data: cleaned, updatedAt: new Date() } });
  }
  for (const x of topics) {
    const topicId = x.topicId || x.id;
    const cleaned = { ...x, name: cleanCourseName(x.name) || x.name };
    await db
      .insert(courseTopics)
      .values({ id: `${course.id}_${topicId}`, courseId: course.id, data: cleaned })
      .onConflictDoUpdate({ target: courseTopics.id, set: { data: cleaned, updatedAt: new Date() } });
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
        // Google Classroom đánh dấu `late=true` khi đã QUÁ HẠN, kể cả khi
        // học sinh CHƯA TỪNG nộp (state CREATED/NEW) — late không phải là
        // tập con của turnedIn như code cũ ngầm giả định. Chỉ tính "nộp
        // muộn" khi CẢ 2 đúng: đã nộp thật (isTurnedIn) VÀ Google đánh dấu
        // late — nếu không, submissionsLate có thể VƯỢT submissionsTurnedIn
        // (đã xảy ra thật: 971/692 = 140%), kéo theo onTimeRate âm và cảnh
        // báo RULE_SUBMISSION_LATE sai lệch nghiêm trọng.
        if (isTurnedIn && s.late) submissionsLate++;
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
            courseWorkTitle: cleanCourseName(item.title) || item.title,
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
              courseWorkTitle: cleanCourseName(item.title) || item.title,
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
      await syncCourse(c, env.WORKSPACE_ADMIN_SUBJECT, customToken, runId);
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

/**
 * Xóa toàn bộ khóa học (và dữ liệu con) được import trong một phiên đồng bộ.
 * Sau khi xóa, tự động rebuild lại classes và dashboard.
 */
export async function deleteSyncRun(runId: string): Promise<{ coursesDeleted: number; classesRebuilt: number }> {
  return db.transaction(async (tx) => {
    // Lấy danh sách courseId cần xóa
    const targetCourses = await tx
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.syncRunId, runId));
    const courseIds = targetCourses.map((c) => c.id);

    // Xóa dữ liệu con cascade theo courseId nếu có khoá học
    for (const courseId of courseIds) {
      await tx.delete(courseSubmissions).where(eq(courseSubmissions.courseId, courseId));
      await tx.delete(courseCoursework).where(eq(courseCoursework.courseId, courseId));
      await tx.delete(courseMaterials).where(eq(courseMaterials.courseId, courseId));
      await tx.delete(courseAnnouncements).where(eq(courseAnnouncements.courseId, courseId));
      await tx.delete(courseTopics).where(eq(courseTopics.courseId, courseId));
      await tx.delete(courseMembers).where(eq(courseMembers.courseId, courseId));
      await tx.delete(classMappings).where(eq(classMappings.courseId, courseId));
      await tx.delete(subjectMappings).where(eq(subjectMappings.courseId, courseId));
    }

    if (courseIds.length > 0) {
      // Xóa bản thân các khóa học thuộc phiên
      await tx.delete(courses).where(eq(courses.syncRunId, runId));
    }

    // Xoá bản ghi phiên đồng bộ trong sync_runs
    await tx.delete(syncRuns).where(eq(syncRuns.id, runId));

    return { coursesDeleted: courseIds.length, classesRebuilt: 0 };
  }).then(async (result) => {
    // Ngoài transaction: rebuild classes và dashboard
    const classesRebuilt = await rebuildClassesFromCourses().catch(() => 0);
    const { rebuildDashboard } = await import('../dashboard/dashboard.service.js');
    await rebuildDashboard().catch(() => null);
    return { ...result, classesRebuilt };
  });
}

export async function rebuildClassesFromCourses(): Promise<number> {
  const allCourses = await db.select().from(courses);
  const existingClasses = await db.select().from(classes);

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
      const grade = c.grade || Number(classId.match(/^(?:1[0-2]|[1-9])/)?.[0] || 0) || null;
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

  // 1. Kiểm tra các lớp hiện có trong bảng `classes`
  for (const existing of existingClasses) {
    if (existing.source === 'MANUAL') {
      // Lớp tạo thủ công: Giữ nguyên metadata định danh, chỉ đồng bộ chỉ số khoá học nếu có course map vào
      const normalizedKey = existing.classId.replace(/^(?:Lớp\s*|Lớp_)/i, '').trim();
      const cls = classesMap.get(existing.classId) || classesMap.get(normalizedKey) || classesMap.get(existing.className.replace(/^Lớp\s*/i, '').trim());
      if (cls) {
        const completionRate = cls.submissionsTotal ? Math.round((cls.submissionsTurnedIn / cls.submissionsTotal) * 1000) / 10 : null;
        const onTimeRate = cls.submissionsTurnedIn ? Math.round(((cls.submissionsTurnedIn - cls.submissionsLate) / cls.submissionsTurnedIn) * 1000) / 10 : null;
        const avgScore = cls.scoredCount ? Math.round((cls.totalScores / cls.scoredCount) * 10) / 10 : null;
        await db
          .update(classes)
          .set({
            courseCount: cls.courseCount,
            courses: cls.courses,
            subjects: Array.from(cls.subjects),
            studentCount: cls.studentCount > 0 ? cls.studentCount : existing.studentCount,
            totalCoursework: cls.totalCoursework,
            submissionsTotal: cls.submissionsTotal,
            submissionsTurnedIn: cls.submissionsTurnedIn,
            submissionsLate: cls.submissionsLate,
            completionRate: completionRate != null ? String(completionRate) : null,
            onTimeRate: onTimeRate != null ? String(onTimeRate) : null,
            averageScore: avgScore != null ? String(avgScore) : null,
            updatedAt: new Date()
          })
          .where(eq(classes.classId, existing.classId));
      } else {
        await db
          .update(classes)
          .set({
            courseCount: 0,
            courses: [],
            subjects: [],
            totalCoursework: 0,
            submissionsTotal: 0,
            submissionsTurnedIn: 0,
            submissionsLate: 0,
            completionRate: null,
            onTimeRate: null,
            averageScore: null,
            updatedAt: new Date()
          })
          .where(eq(classes.classId, existing.classId));
      }
    } else {
      // Lớp đồng bộ CLASSROOM_SYNC:
      if (!classesMap.has(existing.classId)) {
        // Không còn khoá học nào liên kết với lớp này (đã bị rollback hoặc xóa)
        // Kiểm tra xem có tiết thời khoá biểu nào trỏ tới lớp này không
        const [schedRow] = await db
          .select({ n: count() })
          .from(schedules)
          .where(eq(schedules.classId, existing.classId));
        if (schedRow && schedRow.n > 0) {
          // Có lịch trỏ tới: GIỮ NGUYÊN bản ghi lớp (để không phá vỡ TKB), reset các chỉ số Classroom về 0/rỗng
          await db
            .update(classes)
            .set({
              courseCount: 0,
              courses: [],
              subjects: [],
              studentCount: 0,
              totalCoursework: 0,
              submissionsTotal: 0,
              submissionsTurnedIn: 0,
              submissionsLate: 0,
              completionRate: null,
              onTimeRate: null,
              averageScore: null,
              updatedAt: new Date()
            })
            .where(eq(classes.classId, existing.classId));
        } else {
          // Thuần Classroom và không có lịch: XOÁ HẲN bản ghi lớp
          await db.delete(classes).where(eq(classes.classId, existing.classId));
        }
      }
    }
  }

  // 2. Cập nhật hoặc thêm mới các lớp có khoá học từ Classroom
  for (const [classId, cls] of classesMap.entries()) {
    const existing = existingClasses.find(
      (e) => e.classId === classId || e.classId.replace(/^(?:Lớp\s*|Lớp_)/i, '').trim() === classId || e.className.replace(/^Lớp\s*/i, '').trim() === classId
    );
    if (existing && existing.source === 'MANUAL') {
      // Đã xử lý ở bước 1
      continue;
    }

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
        source: 'CLASSROOM_SYNC',
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

export type ResetClassroomDataResult = {
  courses: number;
  courseMembers: number;
  courseCoursework: number;
  courseMaterials: number;
  courseAnnouncements: number;
  courseTopics: number;
  courseSubmissions: number;
  classMappings: number;
  subjectMappings: number;
  classesDeleted: number;
  classesReset: number;
  teachers: number;
  students: number;
};

/**
 * Xoá sạch toàn bộ dữ liệu ĐÃ ĐỒNG BỘ từ Google Classroom, để test lại từ
 * đầu với 1 tài khoản Google Workspace khác — dùng cho nút "Xoá dữ liệu
 * Classroom" ở trang /connections. KHÔNG đụng `google_connections` (token
 * kết nối, route riêng `disconnect` mới xử lý việc đó), KHÔNG đụng dữ liệu
 * module An toàn/Lịch công tác (2 module đó không ghi vào bất kỳ bảng nào
 * bên dưới).
 *
 * Phạm vi xoá — xác định qua khảo sát thật ai ghi vào bảng nào (không đoán):
 * - `courses`, `course_members`, `course_coursework`, `course_materials`,
 *   `course_announcements`, `course_topics`, `course_submissions`,
 *   `class_mappings`, `subject_mappings` — CHỈ classroom.service.ts ghi vào
 *   các bảng này (khoá chính theo `courseId`) → xoá sạch toàn bộ an toàn.
 * - `people` — bảng DÙNG CHUNG với `directory.service.ts` (đồng bộ Google
 *   Workspace Directory, ghi personId/email/displayName/personType/
 *   orgUnitPath/suspended). Riêng 2 cột `courses`/`className`/`classId` CHỈ
 *   được ghi bởi classroom.service.ts (xem syncCourse) — Directory sync
 *   không đụng tới 2 cột này → CHỈ reset 2 cột đó về rỗng/null, KHÔNG xoá
 *   bản ghi `people`, KHÔNG đụng các cột còn lại.
 * - `classes` — bảng DÙNG CHUNG với module Lịch học/Thời khóa biểu
 *   (`schedules.routes.ts` tự tạo/cập nhật `classes` khi thêm 1 dòng lịch
 *   thủ công, chỉ set classId/className/grade/expectedStudents). Lớp nào
 *   KHÔNG có bất kỳ dòng `schedules` nào trỏ tới (classId) → coi là thuần
 *   Classroom, xoá hẳn. Lớp NÀO CÓ dòng `schedules` trỏ tới → giữ nguyên
 *   bản ghi (có nguồn khác cần), chỉ reset về 0/rỗng các cột do
 *   `rebuildClassesFromCourses()` tính ra (courseCount/courses/subjects/
 *   studentCount/totalCoursework/submissionsTotal/submissionsTurnedIn/
 *   submissionsLate/completionRate/onTimeRate/averageScore) — các cột
 *   className/grade/expectedStudents/homeroomTeacher/active KHÔNG đụng vì
 *   thuộc sở hữu của nguồn khác (schedules/demo-seed).
 * - `sync_runs` KHÔNG bị xoá (đây là nhật ký các lần chạy đồng bộ, không
 *   phải nội dung Classroom đã đồng bộ — giữ lại để còn tra được lịch sử).
 */
/**
 * Xem trước số liệu sẽ bị ảnh hưởng nếu gọi resetClassroomData() ngay bây
 * giờ — CHỈ ĐỌC, không xoá/sửa gì — dùng để hiển thị hộp thoại xác nhận ở
 * giao diện trước khi người dùng bấm nút xoá thật. Dùng lại ĐÚNG tiêu chí
 * phân loại lớp/người của resetClassroomData() (không viết lại logic 2 lần
 * dễ lệch nhau).
 */
export async function previewClassroomReset(): Promise<ResetClassroomDataResult> {
  const countRows = async (table: any) => (await db.select().from(table)).length;

  const [
    coursesCount,
    courseMembersCount,
    courseCourseworkCount,
    courseMaterialsCount,
    courseAnnouncementsCount,
    courseTopicsCount,
    courseSubmissionsCount,
    classMappingsCount,
    subjectMappingsCount
  ] = await Promise.all([
    countRows(courses),
    countRows(courseMembers),
    countRows(courseCoursework),
    countRows(courseMaterials),
    countRows(courseAnnouncements),
    countRows(courseTopics),
    countRows(courseSubmissions),
    countRows(classMappings),
    countRows(subjectMappings)
  ]);

  const scheduleClassIds = new Set((await db.select({ classId: schedules.classId }).from(schedules)).map((r) => r.classId));
  const allClasses = await db.select().from(classes);
  const classesDeleted = allClasses.filter((c) => !scheduleClassIds.has(c.classId)).length;
  const classesReset = allClasses.length - classesDeleted;

  const peopleWithClassroomData = (await db.select().from(people)).filter((p) => Array.isArray(p.courses) && p.courses.length > 0);
  const teachers = peopleWithClassroomData.filter((p) => p.personType === 'TEACHER').length;
  const students = peopleWithClassroomData.filter((p) => p.personType === 'STUDENT').length;

  return {
    courses: coursesCount,
    courseMembers: courseMembersCount,
    courseCoursework: courseCourseworkCount,
    courseMaterials: courseMaterialsCount,
    courseAnnouncements: courseAnnouncementsCount,
    courseTopics: courseTopicsCount,
    courseSubmissions: courseSubmissionsCount,
    classMappings: classMappingsCount,
    subjectMappings: subjectMappingsCount,
    classesDeleted,
    classesReset,
    teachers,
    students
  };
}

export async function resetClassroomData(): Promise<ResetClassroomDataResult> {
  return db.transaction(async (tx) => {
    const countRows = async (table: any) => (await tx.select().from(table)).length;

    const [
      coursesCount,
      courseMembersCount,
      courseCourseworkCount,
      courseMaterialsCount,
      courseAnnouncementsCount,
      courseTopicsCount,
      courseSubmissionsCount,
      classMappingsCount,
      subjectMappingsCount
    ] = await Promise.all([
      countRows(courses),
      countRows(courseMembers),
      countRows(courseCoursework),
      countRows(courseMaterials),
      countRows(courseAnnouncements),
      countRows(courseTopics),
      countRows(courseSubmissions),
      countRows(classMappings),
      countRows(subjectMappings)
    ]);

    await tx.delete(courseSubmissions);
    await tx.delete(courseCoursework);
    await tx.delete(courseMaterials);
    await tx.delete(courseAnnouncements);
    await tx.delete(courseTopics);
    await tx.delete(courseMembers);
    await tx.delete(classMappings);
    await tx.delete(subjectMappings);
    await tx.delete(courses);

    // classId nào đang có dòng thời khóa biểu (nguồn khác, không phải
    // Classroom) trỏ tới — lớp đó KHÔNG được xoá hẳn.
    const scheduleClassIds = new Set(
      (await tx.select({ classId: schedules.classId }).from(schedules)).map((r) => r.classId)
    );

    const allClasses = await tx.select().from(classes);
    let classesDeleted = 0;
    let classesReset = 0;
    for (const c of allClasses) {
      if (c.source === 'MANUAL') {
        // Lớp tạo thủ công không bao giờ bị xoá hẳn ở đây, kể cả khi chưa
        // gắn thời khoá biểu — khớp đúng bảo vệ đã có ở rebuildClassesFromCourses().
        // Chỉ reset số liệu tổng hợp từ Classroom (lớp này vốn không có số
        // liệu Classroom thật nên set về 0/rỗng là an toàn).
        await tx
          .update(classes)
          .set({
            courseCount: 0,
            courses: [],
            subjects: [],
            totalCoursework: 0,
            submissionsTotal: 0,
            submissionsTurnedIn: 0,
            submissionsLate: 0,
            completionRate: null,
            onTimeRate: null,
            averageScore: null,
            updatedAt: new Date()
          })
          .where(eq(classes.classId, c.classId));
        classesReset++;
      } else if (!scheduleClassIds.has(c.classId)) {
        await tx.delete(classes).where(eq(classes.classId, c.classId));
        classesDeleted++;
      } else {
        await tx
          .update(classes)
          .set({
            courseCount: 0,
            courses: [],
            subjects: [],
            studentCount: 0,
            totalCoursework: 0,
            submissionsTotal: 0,
            submissionsTurnedIn: 0,
            submissionsLate: 0,
            completionRate: null,
            onTimeRate: null,
            averageScore: null,
            updatedAt: new Date()
          })
          .where(eq(classes.classId, c.classId));
        classesReset++;
      }
    }

    // Chỉ những `people` thực sự còn dấu vết Classroom (courses không rỗng)
    // mới tính vào số liệu trả về — người chỉ có từ Directory sync không hề
    // bị đụng tới nên không nên tính vào "đã xoá dữ liệu".
    const peopleWithClassroomData = (await tx.select().from(people)).filter(
      (p) => Array.isArray(p.courses) && p.courses.length > 0
    );
    let teachers = 0;
    let students = 0;
    for (const p of peopleWithClassroomData) {
      if (p.personType === 'TEACHER') teachers++;
      else if (p.personType === 'STUDENT') students++;
      await tx
        .update(people)
        .set({ courses: [], className: null, classId: null, updatedAt: new Date() })
        .where(eq(people.personId, p.personId));
    }

    return {
      courses: coursesCount,
      courseMembers: courseMembersCount,
      courseCoursework: courseCourseworkCount,
      courseMaterials: courseMaterialsCount,
      courseAnnouncements: courseAnnouncementsCount,
      courseTopics: courseTopicsCount,
      courseSubmissions: courseSubmissionsCount,
      classMappings: classMappingsCount,
      subjectMappings: subjectMappingsCount,
      classesDeleted,
      classesReset,
      teachers,
      students
    };
  });
}
