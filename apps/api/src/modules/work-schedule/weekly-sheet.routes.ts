/**
 * weekly-sheet.routes.ts — "Lịch công tác tuần" (bổ sung 2026-09-28, xem
 * weekly-sheet.schema.ts để biết lý do tách khỏi work-schedule.routes.ts
 * gốc). XEM mở cho mọi tài khoản đã đăng nhập (không cần vai trò đặc
 * biệt) — SỬA chỉ cho email nằm trong `WEEKLY_SHEET_EDITOR_EMAILS`,
 * `weekly-sheet.service.ts` tự chặn (`AppError('forbidden', ...)`).
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import {
  AppError,
  isWeeklySheetEditor,
  listWeeklySheetRows,
  createWeeklySheetRow,
  updateWeeklySheetRow,
  deleteWeeklySheetRow,
  copyWeekRows
} from './weekly-sheet.service.js';

export const weeklySheetRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403
};

function withAppError(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      if (e instanceof AppError) {
        res.status(APP_ERROR_STATUS[e.code] ?? 400).json({ error: e.message, code: e.code });
        return;
      }
      next(e);
    }
  };
}

async function loadActor(req: Request) {
  const ctx = await loadActorContext(db, req.appUser!.uid);
  return { perId: ctx.perId, email: req.appUser!.email };
}

weeklySheetRouter.get(
  '/weekly-sheet',
  firebaseAuth,
  withAppError(async (req, res) => {
    const weekStart = String(req.query.weekStart || '');
    if (!weekStart) throw new AppError('invalid_input', 'Thiếu tham số weekStart (YYYY-MM-DD).');
    const result = await listWeeklySheetRows(db, { weekStart });
    res.json({ ...result, isEditor: isWeeklySheetEditor(req.appUser!.email) });
  })
);

weeklySheetRouter.post(
  '/weekly-sheet/rows',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActor(req);
    const row = await createWeeklySheetRow(db, req.body || {}, actor);
    res.status(201).json(row);
  })
);

weeklySheetRouter.patch(
  '/weekly-sheet/rows/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActor(req);
    const row = await updateWeeklySheetRow(db, String(req.params.id), req.body || {}, actor);
    res.json(row);
  })
);

weeklySheetRouter.delete(
  '/weekly-sheet/rows/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActor(req);
    const result = await deleteWeeklySheetRow(db, String(req.params.id), actor);
    res.json(result);
  })
);

weeklySheetRouter.post(
  '/weekly-sheet/copy-week',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActor(req);
    const { fromWeekStart, toWeekStart } = req.body || {};
    if (!fromWeekStart || !toWeekStart) throw new AppError('invalid_input', 'Thiếu fromWeekStart/toWeekStart.');
    const result = await copyWeekRows(db, { fromWeekStart, toWeekStart }, actor);
    res.json(result);
  })
);
