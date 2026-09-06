import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_AUDIT_LOGS'),
  asyncRoute(async (_req, res) => {
    const snap = await col('auditLogs').orderBy('timestamp', 'desc').limit(100).get().catch(async () => {
      // Fallback if index not yet ready
      return await col('auditLogs').limit(100).get();
    });
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ items });
  })
);
