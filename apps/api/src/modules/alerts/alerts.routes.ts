import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col } from '../../core/firebase.js';
import {
  getAlertRules,
  updateAlertRule,
  evaluateAlertRules
} from './alert-engine.service.js';

export const alertsRouter = Router();

// Lấy danh sách cảnh báo (hỗ trợ lọc open=true, severity, status)
alertsRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    let query: any = col('alerts');

    if (req.query.open === 'true') {
      query = query.where('resolved', '==', false);
    }
    if (req.query.severity) {
      query = query.where('severity', '==', String(req.query.severity));
    }
    if (req.query.status) {
      query = query.where('status', '==', String(req.query.status));
    }

    const snap = await query.get();
    res.json({
      total: snap.size,
      items: snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
    });
  })
);

// Lấy danh mục dynamic alert rules
alertsRouter.get(
  '/rules',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const rules = await getAlertRules();
    res.json({ rules });
  })
);

// Cập nhật cấu hình rule (ngưỡng threshold, trạng thái bật/tắt)
alertsRouter.patch(
  '/rules/:id',
  firebaseAuth,
  requireCapability('RESOLVE_ALERTS'),
  asyncRoute(async (req, res) => {
    const ruleId = String(req.params.id);
    const body = z
      .object({
        threshold: z.number().optional(),
        enabled: z.boolean().optional(),
        severity: z.enum(['INFO', 'WARNING', 'HIGH', 'CRITICAL']).optional()
      })
      .parse(req.body);

    const result = await updateAlertRule(ruleId, body);
    res.json(result);
  })
);

// Kích hoạt quét rule cảnh báo
alertsRouter.post(
  '/evaluate',
  firebaseAuth,
  requireCapability('RESOLVE_ALERTS'),
  asyncRoute(async (_req, res) => {
    const result = await evaluateAlertRules();
    res.json({ ok: true, ...result });
  })
);

// Xử lý và đóng cảnh báo (Resolve) kèm ghi chú Ban Giám hiệu
alertsRouter.patch(
  '/:id/resolve',
  firebaseAuth,
  requireCapability('RESOLVE_ALERTS'),
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        resolution: z.string().default(''),
        notes: z.string().optional(),
        assigneeEmail: z.string().optional()
      })
      .parse(req.body);

    await col('alerts').doc(String(req.params.id)).set(
      {
        resolved: true,
        status: 'RESOLVED',
        resolution: body.resolution,
        principalNotes: body.notes || null,
        assigneeEmail: body.assigneeEmail || null,
        resolvedBy: req.appUser!.email,
        resolvedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true });
  })
);

// Cập nhật tiến độ xử lý (In progress / Thêm ghi chú)
alertsRouter.patch(
  '/:id/status',
  firebaseAuth,
  requireCapability('RESOLVE_ALERTS'),
  asyncRoute(async (req, res) => {
    const body = z
      .object({
        status: z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED']),
        principalNotes: z.string().optional(),
        assigneeEmail: z.string().optional()
      })
      .parse(req.body);

    await col('alerts').doc(String(req.params.id)).set(
      {
        status: body.status,
        resolved: body.status === 'RESOLVED',
        principalNotes: body.principalNotes || null,
        assigneeEmail: body.assigneeEmail || null,
        updatedBy: req.appUser!.email,
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );

    res.json({ ok: true });
  })
);