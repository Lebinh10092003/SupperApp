import { Router } from 'express';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';

export const catalogRouter = Router();

catalogRouter.get(
  '/',
  firebaseAuth,
  requireCapability('MANAGE_CATALOG'),
  asyncRoute(async (_req, res) => {
    const snap = await col('catalogMappings').limit(500).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ items });
  })
);

catalogRouter.post(
  '/map',
  firebaseAuth,
  requireCapability('MANAGE_CATALOG'),
  asyncRoute(async (req, res) => {
    const { rawName, normalizedName, type, grade, subject } = req.body;
    const docRef = col('catalogMappings').doc();
    const entry = {
      rawName,
      normalizedName,
      type: type || 'CLASS',
      grade: grade || null,
      subject: subject || null,
      updatedAt: new Date().toISOString()
    };
    await docRef.set(entry);
    res.json({ ok: true, id: docRef.id, item: entry });
  })
);
