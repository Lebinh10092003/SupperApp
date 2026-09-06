import { Router } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, col } from '../../core/firebase.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { bootstrapEmails } from '../../config/env.js';
import { firebaseAuth } from '../../auth/middleware.js';
import { safeId } from '../../core/ids.js';

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

    const d = await adminAuth.verifyIdToken(token),
      email = (d.email || '').toLowerCase(),
      ref = col('users').doc(d.uid),
      s = await ref.get();

    if (!s.exists) {
      let role = 'VIEWER',
        allowed = false;
      if (bootstrapEmails.has(email)) {
        role = 'SYSTEM_ADMIN';
        allowed = true;
      } else {
        const g = await col('accessAllowlist').doc(safeId(email)).get();
        if (g.exists && g.data()?.active !== false) {
          allowed = true;
          role = g.data()?.role || 'VIEWER';
        }
      }
      if (!allowed) {
        throw new HttpError(403, 'Tài khoản chưa được cấp quyền', 'PERMISSION_ERROR');
      }
      await ref.set({
        email,
        displayName: d.name || email,
        role,
        active: true,
        createdAt: FieldValue.serverTimestamp(),
        lastLogin: FieldValue.serverTimestamp()
      });
    } else {
      await ref.set({ lastLogin: FieldValue.serverTimestamp() }, { merge: true });
    }
    r.json({ ok: true });
  })
);

sessionRouter.get(
  '/me',
  firebaseAuth,
  asyncRoute(async (q, r) => r.json(q.appUser))
);
