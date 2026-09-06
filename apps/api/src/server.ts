import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler, asyncRoute } from './core/http.js';
import { verifyPubSub } from './auth/pubsub.js';
import { healthRouter } from './modules/health/health.routes.js';
import { sessionRouter } from './modules/session/session.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { classroomRouter } from './modules/classroom/classroom.routes.js';
import { meetRouter } from './modules/meet/meet.routes.js';
import { schedulesRouter } from './modules/schedules/schedules.routes.js';
import { peopleRouter } from './modules/people/people.routes.js';
import { classesRouter } from './modules/classes/classes.routes.js';
import { attendanceRouter } from './modules/attendance/attendance.routes.js';
import { alertsRouter } from './modules/alerts/alerts.routes.js';
import { dataQualityRouter } from './modules/data-quality/data-quality.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';
import { systemRouter } from './modules/system/system.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { connectionsRouter } from './modules/connections/connections.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { handleMeetEvent } from './modules/meet/meet.events.js';

const app = express();

const allowedOrigins = env.WEB_ORIGIN.split(',').map(x => x.trim()).filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      if (
        origin.endsWith('.web.app') ||
        origin.endsWith('.firebaseapp.com') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:')
      ) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true
  })
);
app.use(express.json({ limit: '3mb' }));

app.use('/health', healthRouter);
app.use('/api/session', sessionRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/classroom', classroomRouter);
app.use('/api/meet', meetRouter);
app.use('/api/schedules', schedulesRouter);
app.use('/api/people', peopleRouter);
app.use('/api/classes', classesRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/data-quality', dataQualityRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/system', systemRouter);
app.use('/api/admin', adminRouter);

// Routers mở rộng chuyên sâu cho School Intelligence
app.use('/api/connections', connectionsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/audit', auditRouter);

app.post(
  '/events/meet',
  verifyPubSub,
  asyncRoute(async (q, r) => r.json(await handleMeetEvent(q)))
);
app.post(
  '/events/classroom',
  verifyPubSub,
  asyncRoute(async (q, r) => r.json({ ok: true, messageId: q.body?.message?.messageId || null }))
);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`School Intelligence API listening on port ${env.PORT}`);
});

