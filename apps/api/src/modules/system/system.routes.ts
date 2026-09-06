import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col, serviceAccountInfo } from '../../core/firebase.js';
import { ensureSystemRules } from '../../core/rules-initializer.js';
import { env } from '../../config/env.js';

export const systemRouter = Router();

systemRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const [runs, subs, events, coursesCount, peopleCount] = await Promise.all([
      col('syncRuns').orderBy('startedAt', 'desc').limit(10).get(),
      col('subscriptions').get(),
      col('events').where('status', '==', 'ERROR').limit(100).get(),
      col('courses').get(),
      col('people').get()
    ]);

    r.json({
      services: {
        firestore: 'CONNECTED',
        classroom: subs.docs.some(d => d.data().provider === 'CLASSROOM') ? 'CONNECTED' : 'NOT_CONFIGURED',
        meet: subs.docs.some(d => d.data().provider === 'MEET') ? 'CONNECTED' : 'NOT_CONFIGURED'
      },
      serviceAccount: {
        configured: Boolean(serviceAccountInfo || env.DWD_SERVICE_ACCOUNT_EMAIL),
        type: serviceAccountInfo ? 'FILE_JSON' : (env.DWD_SERVICE_ACCOUNT_EMAIL ? 'APPLICATION_DEFAULT_CREDENTIALS' : 'UNCONFIGURED'),
        clientEmail: serviceAccountInfo?.clientEmail || env.DWD_SERVICE_ACCOUNT_EMAIL || null,
        projectId: serviceAccountInfo?.projectId || env.PROJECT_ID
      },
      stats: {
        courses: coursesCount.size,
        people: peopleCount.size
      },
      failedEvents: events.size,
      recentRuns: runs.docs.map(d => ({ id: d.id, ...d.data() })),
      subscriptions: subs.docs.map(d => ({ id: d.id, ...d.data() }))
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