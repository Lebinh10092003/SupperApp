import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { isTeacher, isStudent } from './people.shared.js';

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

// Lấy danh sách toàn bộ nhân sự hoặc lọc theo vai trò (TEACHER / STUDENT)
peopleRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (req, res) => {
    const roleQuery = String(req.query.role || req.query.type || '').toUpperCase();
    const s = await col('people').get();
    let items = s.docs.map(mapPersonDoc);

    if (roleQuery === 'TEACHER' || roleQuery === 'TEACHERS') {
      items = items.filter(isTeacher);
    } else if (roleQuery === 'STUDENT' || roleQuery === 'STUDENTS') {
      items = items.filter(isStudent);
    }

    items.sort((a, b) =>
      String(a.displayName || a.name || a.email).localeCompare(String(b.displayName || b.name || b.email), 'vi')
    );

    res.json({
      total: items.length,
      items
    });
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
    const items = s.docs.map(mapPersonDoc).filter(filterFn);

    items.sort((a, b) =>
      String(a.displayName || a.name || a.email).localeCompare(String(b.displayName || b.name || b.email), 'vi')
    );

    res.json({
      total: items.length,
      items
    });
  })
);