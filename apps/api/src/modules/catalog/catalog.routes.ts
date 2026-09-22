import { Router } from 'express';
import { desc } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { catalogMappings } from './catalog.schema.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/',
  firebaseAuth,
  requireCapability('MANAGE_CATALOG'),
  asyncRoute(async (_req, res) => {
    const items = await db
      .select()
      .from(catalogMappings)
      .orderBy(desc(catalogMappings.updatedAt))
      .limit(500);
    res.json({ items });
  })
);

catalogRouter.post(
  '/map',
  firebaseAuth,
  requireCapability('MANAGE_CATALOG'),
  asyncRoute(async (req, res) => {
    const { rawName, normalizedName, type, grade, subject } = req.body;
    const [item] = await db
      .insert(catalogMappings)
      .values({
        rawName,
        normalizedName,
        type: type || 'CLASS',
        grade: grade || null,
        subject: subject || null
      })
      .returning();
    if (!item) throw new Error('Không tạo được catalog mapping.');
    res.json({ ok: true, id: item.id, item });
  })
);
