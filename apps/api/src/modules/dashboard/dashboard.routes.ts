import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import { rebuildDashboard, trend } from './dashboard.service.js';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/current',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const snap = await col('dashboard').doc('current').get();
    if (snap.exists) {
      return r.json(snap.data());
    }
    return r.json(await rebuildDashboard());
  })
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
