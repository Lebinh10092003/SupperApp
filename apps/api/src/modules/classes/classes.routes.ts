import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';

export const classesRouter = Router();

classesRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const s = await col('classes').get();
    const items = s.docs.map(d => ({ id: d.id, ...d.data() }));
    items.sort((a: any, b: any) => String(a.className || a.id).localeCompare(String(b.className || b.id), 'vi'));
    res.json({ total: items.length, items });
  })
);