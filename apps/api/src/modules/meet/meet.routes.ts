import { Router } from 'express';
import { desc, eq } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { meetSessions } from './meet.schema.js';

export const meetRouter = Router();

meetRouter.get(
  '/live',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const items = await db.select().from(meetSessions).where(eq(meetSessions.status, 'LIVE')).limit(200);
    r.json({ items });
  })
);

meetRouter.get(
  '/sessions',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const items = await db.select().from(meetSessions).orderBy(desc(meetSessions.date)).limit(500);
    r.json({ items });
  })
);
