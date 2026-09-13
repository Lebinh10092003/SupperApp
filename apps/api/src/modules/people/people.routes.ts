import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { people } from './people.schema.js';
import { isTeacher, isStudent } from './people.shared.js';

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

// Lấy danh sách toàn bộ nhân sự hoặc lọc theo vai trò (TEACHER / STUDENT)
peopleRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const roleQuery = String(req.query.role || req.query.type || '').toUpperCase();
    const rows = await db.select().from(people);
    let items = rows.map(mapPerson);

    if (roleQuery === 'TEACHER' || roleQuery === 'TEACHERS') {
      items = items.filter(isTeacher);
    } else if (roleQuery === 'STUDENT' || roleQuery === 'STUDENTS') {
      items = items.filter(isStudent);
    }

    sortByName(items);
    res.json({ total: items.length, items });
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
    const items = rows.map(mapPerson).filter(filterFn);

    sortByName(items);
    res.json({ total: items.length, items });
  })
);