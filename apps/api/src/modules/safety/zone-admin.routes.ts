/**
 * zone-admin.routes.ts — route quản trị "bản đồ khu vực" (Tab Quản lý khu
 * vực: trình vẽ kéo-thả khu vực + icon ghim + nhóm khu vực), port từ
 * `index.js`: listCampusZones, listCampusZonesAdmin, upsertCampusZone,
 * listZoneCategories, upsertZoneCategory, deleteZoneCategory,
 * listCampusMapMarkers, upsertCampusMapMarker, deleteCampusMapMarker.
 *
 * Mọi hàm ghi (upsert/delete) dùng CHUNG action `catalog.edit` (đã có sẵn
 * trong ma trận quyền `authz.ts`) — khớp đúng bản gốc, không tự thêm action
 * mới. Ghi audit log SAU KHI service function xử lý xong (đúng thứ tự bản
 * gốc: ghi dữ liệu trước, audit sau).
 */

import { Router } from 'express';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { checkAuthorization } from './authz.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import { AppError } from './shared.js';
import {
  listCampusZones,
  listAllCampusZones,
  upsertCampusZone,
  listZoneCategories,
  upsertZoneCategory,
  deleteZoneCategory,
  listCampusMapMarkers,
  upsertCampusMapMarker,
  deleteCampusMapMarker
} from './zoneStats.js';

export const zoneAdminRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  category_in_use: 409
};

function withAppError(fn: (req: Parameters<Parameters<typeof asyncRoute>[0]>[0], res: Parameters<Parameters<typeof asyncRoute>[0]>[1]) => Promise<unknown>) {
  return asyncRoute(async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof AppError) {
        throw new HttpError(APP_ERROR_STATUS[e.code] ?? 500, e.message, e.code.toUpperCase());
      }
      throw e;
    }
  });
}

/** `catalog.edit` + `require_approval` (Phó HT cần `approvedBy` của Hiệu trưởng) — dùng chung cho mọi route ghi ở file này. */
async function requireCatalogEdit(req: { appUser?: { uid: string } }, body: Record<string, unknown>) {
  const actor = await loadActorContext(db, req.appUser!.uid);
  const decision = checkAuthorization({ actor, action: 'catalog.edit', resource: {} });
  if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');
  if (decision.conditions.includes('require_approval') && !body.approvedBy) {
    throw new HttpError(412, 'Hành động cần phê duyệt của Hiệu trưởng trước khi thực hiện.', 'APPROVAL_REQUIRED');
  }
  return actor;
}

// Port từ `exports.listCampusZones` — chỉ khu vực ACTIVE, dùng cho màn xem thường (khác bản admin bên dưới).
zoneAdminRouter.get(
  '/campus-zones/internal',
  firebaseAuth,
  withAppError(async (req, res) => {
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : undefined;
    const zones = await listCampusZones(db, { campusId });
    res.json(zones);
  })
);

// Port từ `exports.listCampusZonesAdmin` — trả CẢ khu vực đã tắt (active=false) để còn bật lại được.
zoneAdminRouter.get(
  '/campus-zones/admin',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'catalog.edit', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason ?? 'Không đủ quyền.', 'PERMISSION_ERROR');
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : undefined;
    const zones = await listAllCampusZones(db, { campusId });
    res.json(zones);
  })
);

// Port từ `exports.upsertCampusZone`.
zoneAdminRouter.post(
  '/campus-zones',
  firebaseAuth,
  withAppError(async (req, res) => {
    const body = req.body || {};
    const actor = await requireCatalogEdit(req, body);
    const result = await upsertCampusZone(db, body, { now: new Date() });
    await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'config.campus_zone_edited', objectId: result.zoneId, after: result, now: new Date() }));
    res.json({ ok: true });
  })
);

// Port từ `exports.listZoneCategories`.
zoneAdminRouter.get(
  '/zone-categories',
  firebaseAuth,
  withAppError(async (_req, res) => {
    const rows = await listZoneCategories(db);
    res.json(rows);
  })
);

// Port từ `exports.upsertZoneCategory`.
zoneAdminRouter.post(
  '/zone-categories',
  firebaseAuth,
  withAppError(async (req, res) => {
    const body = req.body || {};
    const actor = await requireCatalogEdit(req, body);
    const result = await upsertZoneCategory(db, body, { now: new Date() });
    await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'config.zone_category_edited', objectId: result.categoryId, after: result, now: new Date() }));
    res.json({ ok: true });
  })
);

// Port từ `exports.deleteZoneCategory`.
zoneAdminRouter.delete(
  '/zone-categories/:categoryId',
  firebaseAuth,
  withAppError(async (req, res) => {
    const body = req.body || {};
    const actor = await requireCatalogEdit(req, body);
    const categoryId = String(req.params.categoryId);
    await deleteZoneCategory(db, categoryId, { now: new Date() });
    await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'config.zone_category_deleted', objectId: categoryId, now: new Date() }));
    res.json({ ok: true });
  })
);

// Port từ `exports.listCampusMapMarkers`.
zoneAdminRouter.get(
  '/campus-map-markers',
  firebaseAuth,
  withAppError(async (req, res) => {
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : '';
    const rows = await listCampusMapMarkers(db, { campusId });
    res.json(rows);
  })
);

// Port từ `exports.upsertCampusMapMarker`.
zoneAdminRouter.post(
  '/campus-map-markers',
  firebaseAuth,
  withAppError(async (req, res) => {
    const body = req.body || {};
    const actor = await requireCatalogEdit(req, body);
    const result = await upsertCampusMapMarker(db, body, { now: new Date() });
    await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'config.map_marker_edited', objectId: result.markerId, after: result, now: new Date() }));
    res.json({ ok: true });
  })
);

// Port từ `exports.deleteCampusMapMarker`.
zoneAdminRouter.delete(
  '/campus-map-markers/:markerId',
  firebaseAuth,
  withAppError(async (req, res) => {
    const body = req.body || {};
    const actor = await requireCatalogEdit(req, body);
    const markerId = String(req.params.markerId);
    await deleteCampusMapMarker(db, markerId);
    await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'config.map_marker_deleted', objectId: markerId, now: new Date() }));
    res.json({ ok: true });
  })
);
