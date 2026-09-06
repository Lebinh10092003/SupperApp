import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { safeId } from '../../core/ids.js';
import { syncDirectory, teacherEmails } from '../directory/directory.service.js';
import { syncAllCourses } from '../classroom/classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';

const roles = [
  'SYSTEM_SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'VICE_PRINCIPAL',
  'DEPARTMENT_HEAD',
  'DATA_VIEWER',
  'TEACHER',
  'SYSTEM_ADMIN',
  'PRINCIPAL',
  'HOMEROOM',
  'VIEWER'
] as const;

export const adminRouter = Router();

adminRouter.post(
  '/full-sync',
  firebaseAuth,
  requireCapability('RUN_SYNC'),
  asyncRoute(async (_q, r) => {
    const directory = await syncDirectory();
    const classroom = await syncAllCourses(await teacherEmails());
    const dashboard = await rebuildDashboard();
    r.json({ ok: true, directory, classroom, dashboardUpdated: !!dashboard });
  })
);

adminRouter.get(
  '/access',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (_q, r) => {
    const [u, a] = await Promise.all([col('users').get(), col('accessAllowlist').get()]);
    r.json({
      users: u.docs.map(d => ({ uid: d.id, ...d.data() })),
      allowlist: a.docs.map(d => ({ id: d.id, ...d.data() }))
    });
  })
);

adminRouter.post(
  '/access',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const b = z
      .object({
        email: z.string().email(),
        role: z.enum(roles),
        active: z.boolean().default(true),
        scope: z
          .object({
            grades: z.array(z.number()).optional(),
            classIds: z.array(z.string()).optional(),
            subjectIds: z.array(z.string()).optional(),
            courseIds: z.array(z.string()).optional()
          })
          .optional()
      })
      .parse(q.body);

    const email = b.email.toLowerCase();

    // Chỉ SYSTEM_SUPER_ADMIN mới được gán vai trò SYSTEM_SUPER_ADMIN
    if (b.role === 'SYSTEM_SUPER_ADMIN' && q.appUser?.role !== 'SYSTEM_SUPER_ADMIN' && q.appUser?.role !== 'SYSTEM_ADMIN') {
      throw new HttpError(403, 'Chỉ Quản trị viên cấp cao nhất mới có quyền cấp quyền SYSTEM_SUPER_ADMIN', 'PERMISSION_ERROR');
    }

    await col('accessAllowlist').doc(safeId(email)).set(
      {
        email,
        role: b.role,
        active: b.active,
        scope: b.scope || null,
        updatedBy: q.appUser!.email,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    const e = await col('users').where('email', '==', email).limit(1).get();
    if (!e.empty) {
      await e.docs[0]!.ref.set(
        {
          role: b.role,
          active: b.active,
          scope: b.scope || null,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    // Ghi nhận Audit Log hệ thống
    await col('systemAuditLogs').add({
      action: 'UPDATE_USER_ACCESS',
      targetEmail: email,
      role: b.role,
      active: b.active,
      scope: b.scope || null,
      performedBy: q.appUser!.email,
      timestamp: FieldValue.serverTimestamp()
    });

    r.json({ ok: true });
  })
);

adminRouter.delete(
  '/access/:email',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const email = decodeURIComponent(String(q.params.email || '')).toLowerCase();
    if (q.appUser?.email === email) {

      throw new HttpError(400, 'Không thể tự thu hồi quyền của chính mình', 'INVALID_OPERATION');
    }

    await col('accessAllowlist').doc(safeId(email)).delete();
    const e = await col('users').where('email', '==', email).limit(1).get();
    if (!e.empty) {
      await e.docs[0]!.ref.set(
        {
          active: false,
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    }

    await col('systemAuditLogs').add({
      action: 'REVOKE_USER_ACCESS',
      targetEmail: email,
      performedBy: q.appUser!.email,
      timestamp: FieldValue.serverTimestamp()
    });

    r.json({ ok: true });
  })
);

