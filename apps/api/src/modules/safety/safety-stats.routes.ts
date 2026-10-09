/**
 * safety-stats.routes.ts — route thống kê/tìm người của module An toàn,
 * port từ `index.js` gốc: `getIncidentStats`, `getTrendAlerts`,
 * `getCampusComparisonStats`, `getClassStats`, `searchPeople`. Tách RIÊNG
 * khỏi `safety.routes.ts` (Hestia đang code
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
import { computeIncidentStats, isValidRangeDays, type IncidentStatsRow } from './incident-stats.js';
import { computeCampusComparisonStats } from './campus-comparison-stats.js';
import { computeClassStats } from './classStats.js';
import { searchPeopleByName, listAllPeople } from './people-search.js';

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

    // `rangeDays` HOẶC `fromDate`/`toDate` lọc "mấy thông số"
    // (total/byPriority/byState/byCategory/byCampus/trend) theo khoảng
    // thời gian — trước đây trang Tổng quan An toàn chỉ xem được tổng
    // toàn thời gian, không lọc được và không có xu hướng (Sin phản hồi
    // 09/10/2026). Mốc tự chọn (fromDate/toDate) ưu tiên hơn rangeDays khi
    // cả 2 cùng được truyền — xem `resolveRange` trong incident-stats.ts.
    // Không truyền gì = toàn bộ thời gian.
    const rawRangeDays = req.query.rangeDays;
    const parsedRangeDays = typeof rawRangeDays === 'string' && rawRangeDays.trim() ? Number(rawRangeDays) : null;
    const rangeDays = isValidRangeDays(parsedRangeDays) ? parsedRangeDays : null;
    const fromDate = typeof req.query.fromDate === 'string' ? req.query.fromDate : null;
    const toDate = typeof req.query.toDate === 'string' ? req.query.toDate : null;

    // KHÔNG còn `.limit(500)` — một khoảng xem rộng (VD 365 ngày/toàn bộ)
    // dễ vượt 500 dòng ở trường có nhiều hồ sơ, cắt ngầm sẽ làm số liệu
    // lọc theo thời gian sai mà không ai biết. 5000 là trần an toàn chống
    // phình bộ nhớ bất thường, không phải giới hạn nghiệp vụ thật.
    const rows = await db.select().from(incidents).orderBy(desc(incidents.updatedAt)).limit(5000);
    const filtered = rows
      .filter((it) => wholeSchool || myCampusIds.indexOf(it.campusId) !== -1)
      .filter((it) => !filterCampusId || it.campusId === filterCampusId);

    const now = new Date();
    const statsRows: IncidentStatsRow[] = filtered.map((it) => ({
      incidentId: it.incidentId,
      campusId: it.campusId,
      categoryCode: it.categoryCode,
      priority: it.priority,
      state: it.state,
      createdAt: it.createdAt,
      closedAt: it.closedAt
    }));
    const incidentStats = computeIncidentStats(statsRows, { rangeDays, fromDate, toDate }, { now });

    // Quá hạn: đồng hồ 'ack'/'assign' của các hồ sơ CHƯA đóng, đã vượt
    // deadlineAt — LUÔN tính trên TOÀN BỘ hồ sơ đang mở trong phạm vi cơ
    // sở (KHÔNG áp `rangeDays`), vì đây là danh sách việc cần làm NGAY bây
    // giờ, không phải số liệu lịch sử theo khoảng thời gian đã chọn.
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
      rangeDays: incidentStats.rangeDays,
      fromDate: incidentStats.fromDate,
      toDate: incidentStats.toDate,
      rangeFrom: incidentStats.rangeFrom,
      rangeTo: incidentStats.rangeTo,
      totalIncidents: incidentStats.totalIncidents,
      openCount: incidentStats.openCount,
      closedInRange: incidentStats.closedInRange,
      byPriority: incidentStats.byPriority,
      byState: incidentStats.byState,
      byCategory: incidentStats.byCategory,
      byCampus: incidentStats.byCampus,
      trend: incidentStats.trend,
      trendBucket: incidentStats.trendBucket,
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

// Port mới 2026-09-21 — nút "Chọn toàn bộ" ở ô Thành phần tham dự lịch
// công tác (Sin yêu cầu, thay vì bấm chọn từng người khi muốn mời hết).
safetyStatsRouter.get(
  '/people/all',
  firebaseAuth,
  withAppError(async (_req, res) => {
    const results = await listAllPeople(db);
    res.json({ results });
  })
);
