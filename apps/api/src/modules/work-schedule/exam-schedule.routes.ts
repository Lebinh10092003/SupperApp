/**
 * exam-schedule.routes.ts — "Lịch thi". XEM: mọi tài khoản đăng nhập được,
 * nhưng SERVER TỰ LỌC theo đúng actor nếu KHÔNG phải lãnh đạo (Sin: "người
 * khác chỉ cho xem lịch trông thi của bản thân thôi"). SỬA (tạo/sửa/xoá):
 * CHỈ Hiệu trưởng/Phó Hiệu trưởng (`isLeadership`, cùng chốt chặn với lịch
 * toàn trường ở work-schedule.routes.ts) — Sin: "người ko có thẩm quyền ko
 * cho sửa lịch phân công trông thi, có người quản trị mới edit được thôi".
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { getPersonSummariesByPerIds, formatPersonLabel } from '../identity/person-directory.js';
import {
  AppError,
  ImportValidationError,
  listExamShifts,
  createExamShift,
  updateExamShift,
  deleteExamShift,
  importExamShifts,
  type ExamShiftInput,
  type ImportRowInput
} from './exam-schedule.service.js';
import { isLeadership } from './work-schedule.authz.js';

export const examScheduleRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = { invalid_input: 400, not_found: 404, forbidden: 403 };

function withAppError(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return asyncRoute(async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (e) {
      // §22: lỗi import phải trả danh sách đủ dòng/cột/giá trị/nội dung —
      // không gộp thành 1 message chung như AppError thường.
      if (e instanceof ImportValidationError) {
        res.status(400).json({ error: { message: e.message, code: 'INVALID_INPUT' }, errors: e.errors });
        return;
      }
      if (e instanceof AppError) throw new HttpError(APP_ERROR_STATUS[e.code] ?? 500, e.message, e.code.toUpperCase());
      throw e;
    }
  });
}

function requireLeadership(roles: { roleId: string; campusId: string | null; domain: string | null }[]) {
  if (!isLeadership(roles)) throw new HttpError(403, 'Chỉ Hiệu trưởng/Phó Hiệu trưởng mới được sửa lịch thi.', 'FORBIDDEN');
}

function parseInput(d: any): ExamShiftInput {
  return {
    examDate: d.examDate,
    session: d.session,
    periodLabel: d.periodLabel,
    timeLabel: d.timeLabel,
    subject: d.subject,
    className: d.className,
    campusId: d.campusId,
    firstProctorPerId: d.firstProctorPerId || null,
    secondProctorPerId: d.secondProctorPerId || null,
    note: d.note
  };
}

// §9 identity cũ (tạo/sửa tay) dùng perId -> resolve tên thật; dòng import
// (§17-25) chỉ có chữ tự do firstProctorName/secondProctorName — ưu tiên
// tên đã resolve từ perId nếu có, không thì hiện thẳng tên chữ tự do.
async function withLabels(rows: Awaited<ReturnType<typeof listExamShifts>>) {
  const perIds = [...new Set(rows.flatMap((r) => [r.firstProctorPerId, r.secondProctorPerId]).filter((v): v is string => !!v))];
  const summaries = await getPersonSummariesByPerIds(db, perIds);
  return rows.map((r) => ({
    ...r,
    firstProctorLabel: r.firstProctorPerId ? formatPersonLabel(r.firstProctorPerId, summaries[r.firstProctorPerId]) : r.firstProctorName || null,
    secondProctorLabel: r.secondProctorPerId ? formatPersonLabel(r.secondProctorPerId, summaries[r.secondProctorPerId]) : r.secondProctorName || null
  }));
}

// GET /exam-shifts?month=YYYY-MM
examScheduleRouter.get(
  '/exam-shifts',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const month = typeof req.query.month === 'string' && /^\d{4}-\d{2}$/.test(req.query.month) ? req.query.month : new Date().toISOString().slice(0, 7);
    const monthStart = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
    const monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
    const admin = isLeadership(actor.roles);
    // §24-25 — bộ lọc bổ sung, mọi tham số đều tuỳ chọn.
    const rows = await listExamShifts(db, {
      monthStart,
      monthEnd,
      forPerId: admin ? undefined : actor.perId,
      examDate: typeof req.query.examDate === 'string' ? req.query.examDate : undefined,
      subject: typeof req.query.subject === 'string' ? req.query.subject : undefined,
      className: typeof req.query.className === 'string' ? req.query.className : undefined,
      teacherName: typeof req.query.teacherName === 'string' ? req.query.teacherName : undefined
    });
    res.json({ items: await withLabels(rows), isAdmin: admin });
  })
);

// §17-25 — import file atomic. `campusId` áp dụng cho TOÀN BỘ file (§18),
// `rows` đã được frontend parse từ CSV sẵn thành mảng object (xem
// ExamScheduleImportDialog.tsx) — service tự validate lại HẾT (không chỉ
// tin frontend), atomic thật qua transaction.
examScheduleRouter.post(
  '/exam-shifts/import',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    requireLeadership(actor.roles);
    const d = req.body || {};
    const rows: ImportRowInput[] = Array.isArray(d.rows)
      ? d.rows.map((r: any, i: number) => ({
          rowNumber: typeof r.rowNumber === 'number' ? r.rowNumber : i + 1,
          examDate: String(r.examDate || ''),
          session: r.session,
          periodLabel: r.periodLabel,
          timeLabel: r.timeLabel,
          subject: r.subject,
          className: r.className,
          firstProctorName: r.firstProctorName,
          secondProctorName: r.secondProctorName,
          note: r.note
        }))
      : [];
    const result = await importExamShifts(db, { campusId: d.campusId, rows }, actor.perId);
    res.status(201).json(result);
  })
);

examScheduleRouter.post(
  '/exam-shifts',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    requireLeadership(actor.roles);
    const row = await createExamShift(db, parseInput(req.body || {}), actor.perId);
    const [withLabel] = await withLabels([row]);
    res.status(201).json(withLabel);
  })
);

examScheduleRouter.patch(
  '/exam-shifts/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    requireLeadership(actor.roles);
    const row = await updateExamShift(db, String(req.params.id), parseInput(req.body || {}), actor.perId);
    const [withLabel] = await withLabels([row]);
    res.json(withLabel);
  })
);

examScheduleRouter.delete(
  '/exam-shifts/:id',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    requireLeadership(actor.roles);
    await deleteExamShift(db, String(req.params.id), actor.perId);
    res.json({ ok: true });
  })
);
