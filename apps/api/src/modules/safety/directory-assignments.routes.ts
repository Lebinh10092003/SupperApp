/**
 * directory-assignments.routes.ts — route HTTP cho 4 hàm CRUD dữ liệu nền
 * ở `directory-assignments.ts`. Port từ `index.js`:
 * upsertHomeroomAssignment, upsertGradeSupervisorAssignment,
 * upsertPersonDirectoryEntry, getPersonDirectoryEntry. Theo đúng khuôn
 * `safety.routes.ts` (K4): `firebaseAuth` bắt buộc, `actor` lấy từ
 * `loadActorContext` (đọc DB thật), authz thật nằm trong service layer.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { AppError } from './shared.js';
import {
  upsertHomeroomAssignment,
  upsertGradeSupervisorAssignment,
  upsertPersonDirectoryEntry,
  getPersonDirectoryEntry
} from './directory-assignments.js';

export const directoryAssignmentsRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  approval_required: 403
};

function withAppError(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return asyncRoute(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      if (e instanceof AppError) {
        throw new HttpError(APP_ERROR_STATUS[e.code] ?? 500, e.message, e.code.toUpperCase());
      }
      throw e;
    }
  });
}

// Port từ `exports.upsertHomeroomAssignment`.
directoryAssignmentsRouter.put(
  '/homeroom-assignments/:className',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const result = await upsertHomeroomAssignment(
      db,
      { actor, className: String(req.params.className), perId: d.perId, name: d.name ?? null },
      { approvedBy: d.approvedBy }
    );
    res.json(result);
  })
);

// Port từ `exports.upsertGradeSupervisorAssignment`.
directoryAssignmentsRouter.put(
  '/grade-supervisor-assignments/:grade',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const result = await upsertGradeSupervisorAssignment(
      db,
      { actor, grade: String(req.params.grade), perId: d.perId, name: d.name ?? null },
      { approvedBy: d.approvedBy }
    );
    res.json(result);
  })
);

// Port từ `exports.upsertPersonDirectoryEntry`.
directoryAssignmentsRouter.put(
  '/people-directory/:perId',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    const result = await upsertPersonDirectoryEntry(db, { actor, perId: String(req.params.perId), email: d.email ?? null });
    res.json(result);
  })
);

// Port từ `exports.getPersonDirectoryEntry`.
directoryAssignmentsRouter.get(
  '/people-directory/:perId',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const result = await getPersonDirectoryEntry(db, { actor, perId: String(req.params.perId) });
    res.json(result);
  })
);
