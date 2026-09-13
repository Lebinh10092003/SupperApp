import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { classes } from './classes.schema.js';

export const classesRouter = Router();

classesRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const items = await db.select().from(classes);
    items.sort((a, b) => String(a.className || a.classId).localeCompare(String(b.className || b.classId), 'vi'));
    res.json({ total: items.length, items });
  })
);