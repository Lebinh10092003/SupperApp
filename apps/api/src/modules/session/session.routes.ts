import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../../core/firebase.js';
import { db } from '../../core/db/client.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { bootstrapEmails } from '../../config/env.js';
import { firebaseAuth } from '../../auth/middleware.js';
import { safeId } from '../../core/ids.js';
import { users, accessAllowlist } from './session.schema.js';

export const sessionRouter = Router();

sessionRouter.post(
  '/bootstrap',
  asyncRoute(async (q, r) => {
    const h = q.header('authorization') || '';
    if (!h.startsWith('Bearer ')) {
      throw new HttpError(401, 'Chưa đăng nhập', 'AUTH_ERROR');
    }
    const token = h.slice(7);

    // Support dev mode bootstrap
    if (token.startsWith('dev:')) {
      return r.json({ ok: true });
    }

    const d = await adminAuth.verifyIdToken(token);
    const email = (d.email || '').toLowerCase();
    const existing = await db.select().from(users).where(eq(users.uid, d.uid)).then((rows) => rows[0] ?? null);

    if (!existing) {
      let role = 'VIEWER';
      let allowed = false;
      if (bootstrapEmails.has(email)) {
        role = 'SYSTEM_ADMIN';
        allowed = true;
      } else {
        const grant = await db
          .select()
          .from(accessAllowlist)
          .where(eq(accessAllowlist.id, safeId(email)))
          .then((rows) => rows[0] ?? null);
        if (grant && grant.active !== false) {
          allowed = true;
          role = grant.role || 'VIEWER';
        }
      }
      if (!allowed) {
        throw new HttpError(403, 'Tài khoản chưa được cấp quyền', 'PERMISSION_ERROR');
      }
      await db.insert(users).values({
        uid: d.uid,
        email,
        displayName: d.name || email,
        role,
        active: true,
        lastLogin: new Date()
      });
    } else {
      await db.update(users).set({ lastLogin: new Date() }).where(eq(users.uid, d.uid));
    }
    r.json({ ok: true });
  })
);

sessionRouter.get(
  '/me',
  firebaseAuth,
  asyncRoute(async (q, r) => r.json(q.appUser))
);

// Tự sửa thông tin cá nhân của chính mình (chỉ tên hiển thị — email/vai
// trò/cơ sở vẫn phải qua Quản trị viên ở trang /admin để tránh người dùng
// tự nâng quyền hoặc đổi email gắn với accessAllowlist).
sessionRouter.patch(
  '/me',
  firebaseAuth,
  asyncRoute(async (q, r) => {
    if (!q.appUser) {
      throw new HttpError(401, 'Chưa đăng nhập', 'AUTH_ERROR');
    }
    const displayName = String(q.body?.displayName || '').trim();
    if (!displayName) {
      throw new HttpError(400, 'Tên hiển thị không được để trống', 'VALIDATION_ERROR');
    }
    await db.update(users).set({ displayName, updatedAt: new Date() }).where(eq(users.uid, q.appUser.uid));
    await adminAuth.updateUser(q.appUser.uid, { displayName }).catch(() => {});
    r.json({ ...q.appUser, displayName });
  })
);
