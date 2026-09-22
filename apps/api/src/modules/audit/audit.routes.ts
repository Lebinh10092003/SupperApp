import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { generalAuditLogs } from './audit.schema.js';

export const auditRouter = Router();

auditRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_AUDIT_LOGS'),
  asyncRoute(async (_req, res) => {
    const items = await db
      .select()
      .from(generalAuditLogs)
      .orderBy(desc(generalAuditLogs.timestamp))
      .limit(100);
    res.json({ items });
  })
);
