import type { Request, Response, NextFunction } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, col } from '../core/firebase.js';
import { HttpError } from '../core/http.js';
import { can, type Capability, type Role, type UserScope } from './roles.js';
import { bootstrapSuperAdminEmails, bootstrapSuperAdminDomains } from '../config/env.js';

export interface AppUser {
  uid: string;
  email: string;
  role: Role;
  active: boolean;
  displayName?: string;
  scope?: UserScope;
}

declare global {
  namespace Express {
    interface Request {
      appUser?: AppUser;
    }
  }
}

function isBootstrapSuperAdmin(email: string): boolean {
  const lower = email.toLowerCase();
  if (bootstrapSuperAdminEmails.has(lower)) return true;
  const domain = lower.split('@')[1];
  if (domain && bootstrapSuperAdminDomains.has(domain)) return true;
  return false;
}

export async function firebaseAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const h = req.header('authorization') || '';
    if (!h.startsWith('Bearer ')) {
      throw new HttpError(401, 'Chưa đăng nhập', 'AUTH_ERROR');
    }
    const token = h.slice(7);

    // Support dev tokens in local development
    if (token.startsWith('dev:')) {
      const parts = token.split(':');
      const email = (parts[1] || '09.levanbinh2003@gmail.com').toLowerCase();
      const role = (parts[2] as Role) || (isBootstrapSuperAdmin(email) ? 'SYSTEM_SUPER_ADMIN' : 'SCHOOL_ADMIN');
      req.appUser = {
        uid: `dev-user-${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
        email,
        role,
        active: true,
        displayName: 'Quản trị viên — Ban Giám Hiệu'
      };
      return next();
    }

    const d = await adminAuth.verifyIdToken(token);
    const email = (d.email || '').toLowerCase();
    const userRef = col('users').doc(d.uid);
    const s = await userRef.get();

    // Tự động cấp SYSTEM_SUPER_ADMIN cho email trong bootstrap config
    if (isBootstrapSuperAdmin(email)) {
      if (!s.exists) {
        await userRef.set({
          uid: d.uid,
          email,
          role: 'SYSTEM_SUPER_ADMIN',
          active: true,
          displayName: d.name || email,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });
      }
      req.appUser = {
        uid: d.uid,
        email,
        role: 'SYSTEM_SUPER_ADMIN',
        active: true,
        displayName: d.name || email
      };
      return next();
    }

    if (!s.exists) {
      throw new HttpError(403, 'Tài khoản chưa được cấp quyền truy cập hệ thống', 'PERMISSION_ERROR');
    }

    const p = s.data()!;
    if (p.active !== true) {
      throw new HttpError(403, 'Tài khoản đã bị tạm khóa bởi Quản trị viên', 'PERMISSION_ERROR');
    }

    req.appUser = {
      uid: d.uid,
      email,
      role: (p.role as Role) || 'TEACHER',
      active: true,
      displayName: p.displayName || d.name,
      scope: p.scope
    };
    next();
  } catch (e) {
    next(e);
  }
}

export const requireCapability =
  (c: Capability) => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.appUser || !can(req.appUser.role, c)) {
      return next(new HttpError(403, 'Không đủ quyền thực hiện thao tác này', 'PERMISSION_ERROR'));
    }
    next();
  };

export function checkUserScope(user: AppUser, target: { grade?: number; classId?: string; subjectId?: string; courseId?: string }): boolean {
  if (user.role === 'SYSTEM_SUPER_ADMIN' || user.role === 'SYSTEM_ADMIN' || user.role === 'SCHOOL_ADMIN' || user.role === 'PRINCIPAL') {
    return true;
  }
  if (!user.scope) return true;
  if (target.grade && user.scope.grades?.length && !user.scope.grades.includes(target.grade)) return false;
  if (target.classId && user.scope.classIds?.length && !user.scope.classIds.includes(target.classId)) return false;
  if (target.subjectId && user.scope.subjectIds?.length && !user.scope.subjectIds.includes(target.subjectId)) return false;
  if (target.courseId && user.scope.courseIds?.length && !user.scope.courseIds.includes(target.courseId)) return false;
  return true;
}

