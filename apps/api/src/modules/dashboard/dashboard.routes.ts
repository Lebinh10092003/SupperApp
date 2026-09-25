import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { dashboardSnapshot } from './dashboard.schema.js';
import { rebuildDashboard, trend, getAcademicPulse } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/current',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const row = await db.select().from(dashboardSnapshot).where(eq(dashboardSnapshot.id, 'current')).then((rows) => rows[0] ?? null);
    if (row) return r.json(row);
    return r.json(await rebuildDashboard());
  })
);

dashboardRouter.get(
  '/academic-pulse',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => r.json(await getAcademicPulse()))
);

dashboardRouter.get(
  '/trend',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (q, r) => r.json({ items: await trend(Number(q.query.days || 30)) }))
);

dashboardRouter.post(
  '/rebuild',
  firebaseAuth,
  requireCapability('RUN_SYNC'),
  asyncRoute(async (_q, r) => r.json(await rebuildDashboard()))
);
