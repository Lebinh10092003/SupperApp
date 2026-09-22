import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';

export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncRoute(async (_q, r) => {
    let database = 'ok';
    try {
      await db.execute(sql`select 1`);
    } catch {
      database = 'error';
    }
    r.json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  })
);
