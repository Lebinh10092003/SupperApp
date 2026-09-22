import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { resolveEffectiveScope, matchesScope } from '../../auth/scope.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { people } from './people.schema.js';
import { isTeacher, isStudent } from './people.shared.js';
import { autoDetectClass, cleanCourseName } from '../catalog/catalog.service.js';
import { getStudentTranscript, STANDARD_TOPICS } from './student-grades.service.js';

export const peopleRouter = Router();

function mapPerson(row: typeof people.$inferSelect) {
  const displayName = row.displayName || row.email || 'Chưa cập nhật họ tên';
  return {
    ...row,
    id: row.personId,
    name: displayName,
    displayName
  };
}

function sortByName<T extends { displayName?: string | null; name?: string | null; email?: string | null }>(
  items: T[]
) {
  return items.sort((a, b) =>
    String(a.displayName || a.name || a.email).localeCompare(String(b.displayName || b.name || b.email), 'vi')
  );
}

// Danh bạ GV/NV xem chung toàn trường — chỉ DỮ LIỆU HỌC SINH mới giới hạn
// theo lớp/khối GV phụ trách (đúng ý nghĩa capability VIEW_STUDENT_DATA và
// quyết định của Sin: GV chỉ xem khối/lớp phụ trách, không xem toàn trường).
async function applyStudentScope<T extends { classId?: string | null }>(
  appUser: NonNullable<Express.Request['appUser']>,
  items: T[],
  isStudentItem: (item: T) => boolean
): Promise<T[]> {
  const scope = await resolveEffectiveScope(appUser);
  if (scope === null) return items; // vai trò quản lý toàn trường
  return items.filter((item) => !isStudentItem(item) || matchesScope(item, scope));
}

// Lấy danh sách toàn bộ nhân sự hoặc lọc theo vai trò (TEACHER / STUDENT)
peopleRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const roleQuery = String(req.query.role || req.query.type || '').toUpperCase();
    const rows = await db.select().from(people);
    let items = rows.map(mapPerson);

    let classSubjectAverages: Record<string, number | null> | undefined = undefined;
    if (roleQuery === 'TEACHER' || roleQuery === 'TEACHERS') {
      items = items.filter(isTeacher);
    } else if (roleQuery === 'STUDENT' || roleQuery === 'STUDENTS') {
      const rawStudents = items.filter(isStudent);
      const enrichedRes = await enrichStudentItems(rawStudents);
      items = enrichedRes.items;
      classSubjectAverages = enrichedRes.classSubjectAverages;
    }

    items = await applyStudentScope(req.appUser!, items, isStudent);

    sortByName(items);
    res.json({ total: items.length, items });
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
    const filterFn = isTeacherReq ? isTeacher : isStudent;
    const rows = await db.select().from(people);
    let items = rows.map(mapPerson).filter(filterFn);

    items = await applyStudentScope(req.appUser!, items, isStudent);

    sortByName(items);
    res.json({ total: items.length, items });
  })
);
