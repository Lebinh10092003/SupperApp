/**
 * saved-filters.routes.ts — CRUD tối giản cho bộ lọc đã lưu của từng
 * người (bổ sung 2026-09-22, xem saved-filters.schema.ts). Chỉ thao tác
 * được trên bộ lọc CỦA CHÍNH MÌNH (perId từ actor đã xác thực) — không
 * route nào cho xem/sửa bộ lọc của người khác.
 *
 * `kind` (bổ sung 2026-10-02) — 1 danh sách bộ lọc DÙNG CHUNG cho nhiều
 * trang (Sự vụ/Lịch công tác/Giao việc), GET lọc theo đúng ?kind= của
 * trang đang gọi để không hiện lẫn bộ lọc sai trang.
 */
import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { savedCaseFilters } from './saved-filters.schema.js';

export const savedFiltersRouter = Router();

const VALID_KINDS = ['safety_cases', 'work_schedule_events', 'work_schedule_tasks'];

savedFiltersRouter.get(
  '/saved-filters',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const kind = typeof req.query.kind === 'string' && VALID_KINDS.includes(req.query.kind) ? req.query.kind : 'safety_cases';
    const rows = await db
      .select()
      .from(savedCaseFilters)
      .where(and(eq(savedCaseFilters.perId, actor.perId!), eq(savedCaseFilters.kind, kind)))
      .orderBy(desc(savedCaseFilters.createdAt));
    res.json(rows);
  })
);

savedFiltersRouter.post(
  '/saved-filters',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const d = req.body || {};
    if (!d.name || !String(d.name).trim()) throw new HttpError(400, 'Thiếu tên bộ lọc.', 'INVALID_INPUT');
    if (!d.filterJson || typeof d.filterJson !== 'object') throw new HttpError(400, 'Thiếu nội dung bộ lọc.', 'INVALID_INPUT');
    const kind = typeof d.kind === 'string' && VALID_KINDS.includes(d.kind) ? d.kind : 'safety_cases';
    const [row] = await db
      .insert(savedCaseFilters)
      .values({ perId: actor.perId!, kind, name: String(d.name).trim(), filterJson: d.filterJson })
      .returning();
    res.status(201).json(row);
  })
);

savedFiltersRouter.delete(
  '/saved-filters/:id',
  firebaseAuth,
  asyncRoute(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const id = String(req.params.id);
    const [existing] = await db.select().from(savedCaseFilters).where(eq(savedCaseFilters.id, id)).limit(1);
    if (!existing) throw new HttpError(404, 'Không tìm thấy bộ lọc.', 'NOT_FOUND');
    if (existing.perId !== actor.perId) throw new HttpError(403, 'Không được xoá bộ lọc của người khác.', 'PERMISSION_ERROR');
    await db.delete(savedCaseFilters).where(and(eq(savedCaseFilters.id, id), eq(savedCaseFilters.perId, actor.perId!)));
    res.json({ ok: true });
  })
);
