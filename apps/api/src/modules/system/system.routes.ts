import { Router } from 'express';
import { desc, eq, count } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { serviceAccountInfo } from '../../core/firebase.js';
import { ensureSystemRules } from '../../core/rules-initializer.js';
import { env } from '../../config/env.js';
import { syncRuns } from '../classroom/classroom.schema.js';
import { events } from '../events/events.schema.js';
import { courses } from '../classroom/classroom.schema.js';
import { people } from '../people/people.schema.js';
import { subscriptions } from './system.schema.js';

export const systemRouter = Router();

systemRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const [runs, subs, failedEvents, [coursesCount], [peopleCount]] = await Promise.all([
      db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(10),
      db.select().from(subscriptions),
      db.select().from(events).where(eq(events.status, 'ERROR')).limit(100),
      db.select({ n: count() }).from(courses),
      db.select({ n: count() }).from(people)
    ]);

    r.json({
      services: {
        database: 'CONNECTED',
        classroom: subs.some((s) => s.provider === 'CLASSROOM') ? 'CONNECTED' : 'NOT_CONFIGURED',
        meet: subs.some((s) => s.provider === 'MEET') ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      serviceAccount: {
        configured: Boolean(serviceAccountInfo || env.DWD_SERVICE_ACCOUNT_EMAIL),
        type: serviceAccountInfo ? 'FILE_JSON' : env.DWD_SERVICE_ACCOUNT_EMAIL ? 'APPLICATION_DEFAULT_CREDENTIALS' : 'UNCONFIGURED',
        clientEmail: serviceAccountInfo?.clientEmail || env.DWD_SERVICE_ACCOUNT_EMAIL || null,
        projectId: serviceAccountInfo?.projectId || env.PROJECT_ID
      },
      stats: {
        courses: coursesCount?.n ?? 0,
        people: peopleCount?.n ?? 0
      },
      failedEvents: failedEvents.length,
      recentRuns: runs,
      subscriptions: subs
    });
  })
);

systemRouter.post(
  '/init-rules',
  firebaseAuth,
  requireCapability('MANAGE_INFRASTRUCTURE'),
  asyncRoute(async (_q, r) => {
    const result = await ensureSystemRules();
    r.json(result);
  })
);
