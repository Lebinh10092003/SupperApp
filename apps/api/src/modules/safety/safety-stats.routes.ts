/**
 * safety-stats.routes.ts — route thống kê/tìm người của module An toàn,
 * port từ `index.js` gốc: `getIncidentStats`, `getTrendAlerts`,
 * `getCampusComparisonStats`, `getZoneStats`, `getClassStats`,
 * `searchPeople`. Tách RIÊNG khỏi `safety.routes.ts` (Hestia đang code
 * song song cụm route liệt kê/quản trị khác) để tránh đụng cùng 1 file —
 * gộp lại lúc merge tuỳ Hestia quyết định.
 *
 * Theo đúng khuôn `safety.routes.ts`: `firebaseAuth` xác thực, phân quyền
 * THẬT nằm trong `authz.ts` (9 bước), `actor` LUÔN lấy từ
 * `loadActorContext` (đọc DB thật) — không tin client tự khai vai trò.
 *
 * Nguồn đối chiếu: `index.js` dòng 1590-1884 (getIncidentStats tới
 * searchPeople).
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { desc } from 'drizzle-orm';
import { firebaseAuth } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { loadActorContext } from '../identity/actor-context.js';
import { checkAuthorization } from './authz.js';
import * as catalog from './catalog.js';
import { AppError } from './shared.js';
import { incidents } from './incidents.schema.js';
import { slaClocks } from './sla-clocks.schema.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import { computeTrendAlerts } from './trend-alerts.js';
import { computeCampusComparisonStats } from './campus-comparison-stats.js';
import { computeZoneStats } from './zoneStats.js';
import { computeClassStats } from './classStats.js';
import { searchPeopleByName } from './people-search.js';

export const safetyStatsRouter = Router();

const APP_ERROR_STATUS: Record<string, number> = {
  invalid_input: 400,
  not_found: 404,
  forbidden: 403,
  category_in_use: 409
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

function parseCsv(v: unknown): string[] | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Phạm vi cơ sở actor được xem — Hiệu trưởng (wholeSchool) xem toàn trường, còn lại chỉ đúng cơ sở mình. Port đúng logic lặp lại ở getIncidentStats/getTrendAlerts gốc. */
function actorCampusScope(roles: Array<{ roleId: string; campusId?: string | null }>): { wholeSchool: boolean; myCampusIds: string[] } {
  const wholeSchool = roles.some((r) => r.roleId === catalog.ROLE.PRINCIPAL);
  const myCampusIds = Array.from(new Set(roles.map((r) => r.campusId).filter((v): v is string => Boolean(v))));
  return { wholeSchool, myCampusIds };
}

// Port từ `exports.getIncidentStats`.
safetyStatsRouter.get(
  '/stats/incidents',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'incident.view_stats', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason || 'Không có quyền.', 'PERMISSION_ERROR');

    const { wholeSchool, myCampusIds } = actorCampusScope(actor.roles);
    // Pha 1: Hiệu trưởng tự chọn xem đúng 1 cơ sở thay vì luôn gộp toàn
    // trường — CHỈ áp dụng khi wholeSchool=true (Phó HT vốn đã giới hạn
    // đúng cơ sở mình).
    const requestedCampusId = typeof req.query.campusId === 'string' ? req.query.campusId : null;
    const filterCampusId = wholeSchool && requestedCampusId ? requestedCampusId : null;

    const rows = await db.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(500);
    const filtered = rows
      .filter((it) => wholeSchool || myCampusIds.indexOf(it.campusId) !== -1)
      .filter((it) => !filterCampusId || it.campusId === filterCampusId);

    const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const byState: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byCampus: Record<string, number> = {};
    let openCount = 0;
    let closedLast30d = 0;
    const now = new Date();
    const thirtyDaysAgoMs = now.getTime() - 30 * 24 * 3600 * 1000;
    for (const it of filtered) {
      const cur = byPriority[it.priority];
      if (cur !== undefined) byPriority[it.priority] = cur + 1;
      byState[it.state] = (byState[it.state] || 0) + 1;
      byCategory[it.categoryCode] = (byCategory[it.categoryCode] || 0) + 1;
      byCampus[it.campusId] = (byCampus[it.campusId] || 0) + 1;
      if (!catalog.isTerminal(it.state as catalog.IncidentState)) openCount += 1;
      if (it.state === catalog.STATE.CLOSED && it.closedAt) {
        const closedMs = it.closedAt.getTime();
        if (closedMs >= thirtyDaysAgoMs) closedLast30d += 1;
      }
    }

    // Quá hạn: đồng hồ 'ack'/'assign' của các hồ sơ CHƯA đóng, đã vượt deadlineAt.
    const inScopeIds = new Set(filtered.filter((it) => !catalog.isTerminal(it.state as catalog.IncidentState)).map((it) => it.incidentId));
    const overdue: Array<{ incidentId: string; clockLabel: string; priority: string; deadlineAt: Date }> = [];
    if (inScopeIds.size > 0) {
      const clockRows = await db.select().from(slaClocks).limit(1000);
      for (const clock of clockRows) {
        if (!inScopeIds.has(clock.objectId)) continue;
        if (clock.paused || clock.status === 'met') continue;
        if (clock.deadlineAt.getTime() < now.getTime()) {
          overdue.push({ incidentId: clock.objectId, clockLabel: clock.clockLabel, priority: clock.priority, deadlineAt: clock.deadlineAt });
        }
      }
    }

    res.json({
      scope: wholeSchool ? 'school' : 'campus',
      campusIds: wholeSchool ? [] : myCampusIds,
      filteredCampusId: filterCampusId,
      totalIncidents: filtered.length,
      openCount,
      closedLast30d,
      byPriority,
      byState,
      byCategory,
      byCampus,
      overdue
    });
  })
);

// Port từ `exports.getTrendAlerts`.
safetyStatsRouter.get(
  '/stats/trend-alerts',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'incident.view_trend_alerts', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason || 'Không có quyền.', 'PERMISSION_ERROR');

    const { wholeSchool, myCampusIds } = actorCampusScope(actor.roles);
    const alerts = await computeTrendAlerts(db, { campusIds: wholeSchool ? [] : myCampusIds }, { now: new Date() });
    res.json({ alerts });
  })
);

// Port từ `exports.getCampusComparisonStats`.
safetyStatsRouter.get(
  '/stats/campus-comparison',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'incident.view_campus_comparison', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason || 'Không có quyền.', 'PERMISSION_ERROR');

    const result = await computeCampusComparisonStats(
      db,
      {
        fromMonth: typeof req.query.fromMonth === 'string' ? req.query.fromMonth : undefined,
        toMonth: typeof req.query.toMonth === 'string' ? req.query.toMonth : undefined,
        categoryCodes: parseCsv(req.query.categoryCodes)
      },
      { now: new Date() }
    );
    res.json(result);
  })
);

// Port từ `exports.getZoneStats`.
safetyStatsRouter.get(
  '/stats/zones',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'incident.view_zone_map', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason || 'Không có quyền.', 'PERMISSION_ERROR');
    const reason = typeof req.query.reason === 'string' ? req.query.reason : undefined;
    if (decision.conditions.includes('require_reason') && !reason) {
      throw new HttpError(400, 'Bắt buộc nhập lý do khi xem bản đồ điểm nóng theo khu vực.', 'REASON_REQUIRED');
    }

    const { wholeSchool, myCampusIds } = actorCampusScope(actor.roles);
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : null;
    if (!campusId) throw new HttpError(400, 'Thiếu campusId.', 'INVALID_INPUT');
    if (!wholeSchool && myCampusIds.indexOf(campusId) === -1) {
      throw new HttpError(403, 'Cơ sở này không thuộc phạm vi được phân công.', 'PERMISSION_ERROR');
    }

    const result = await computeZoneStats(
      db,
      { campusId, categoryCodes: parseCsv(req.query.categoryCodes), rangeDays: req.query.rangeDays ? Number(req.query.rangeDays) : undefined },
      { now: new Date() }
    );
    if (decision.conditions.includes('require_reason')) {
      await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'incident.view_zone_map', objectId: campusId, reason, now: new Date() }));
    }
    res.json(result);
  })
);

// Port từ `exports.getClassStats`.
safetyStatsRouter.get(
  '/stats/classes',
  firebaseAuth,
  withAppError(async (req, res) => {
    const actor = await loadActorContext(db, req.appUser!.uid);
    const decision = checkAuthorization({ actor, action: 'incident.view_class_stats', resource: {} });
    if (!decision.allowed) throw new HttpError(403, decision.reason || 'Không có quyền.', 'PERMISSION_ERROR');
    const reason = typeof req.query.reason === 'string' ? req.query.reason : undefined;
    if (decision.conditions.includes('require_reason') && !reason) {
      throw new HttpError(400, 'Bắt buộc nhập lý do khi xem thống kê theo lớp học.', 'REASON_REQUIRED');
    }

    const { wholeSchool, myCampusIds } = actorCampusScope(actor.roles);
    const campusId = typeof req.query.campusId === 'string' ? req.query.campusId : null;
    if (!campusId) throw new HttpError(400, 'Thiếu campusId.', 'INVALID_INPUT');
    if (!wholeSchool && myCampusIds.indexOf(campusId) === -1) {
      throw new HttpError(403, 'Cơ sở này không thuộc phạm vi được phân công.', 'PERMISSION_ERROR');
    }

    const result = await computeClassStats(
      db,
      { campusId, categoryCodes: parseCsv(req.query.categoryCodes), rangeDays: req.query.rangeDays ? Number(req.query.rangeDays) : undefined },
      { now: new Date() }
    );
    if (decision.conditions.includes('require_reason')) {
      await writeAuditLog(db, buildAuditRecord({ actorPerId: actor.perId, action: 'incident.view_class_stats', objectId: campusId, reason, now: new Date() }));
    }
    res.json(result);
  })
);

// Port từ `exports.searchPeople` — chỉ cần đăng nhập, không action riêng
// trong ma trận (đúng bản gốc: `requireAuth(request)` rồi tìm thẳng).
safetyStatsRouter.get(
  '/people/search',
  firebaseAuth,
  withAppError(async (req, res) => {
    const query = typeof req.query.q === 'string' ? req.query.q : undefined;
    const results = await searchPeopleByName(db, query);
    res.json({ results });
  })
);
