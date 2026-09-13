import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { meetSessions } from '../meet/meet.schema.js';

export const attendanceRouter = Router();

attendanceRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_STUDENT_DATA'),
  asyncRoute(async (q, r) => {
    const date = String(q.query.date || new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
    const items = await db.select().from(meetSessions).where(eq(meetSessions.date, date)).limit(500);
    r.json({ items });
  })
);
