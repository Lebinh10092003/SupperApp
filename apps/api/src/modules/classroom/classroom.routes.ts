import { Router } from 'express';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col, resolveServiceAccount } from '../../core/firebase.js';
import { env } from '../../config/env.js';
import { syncAllCourses } from './classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';

export const classroomRouter = Router();

// Kiểm tra trạng thái kết nối và số lượng khóa học Google Classroom
classroomRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const [coursesSnap, syncDoc, connDoc] = await Promise.all([
      col('courses').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
      col('system').doc('syncStatus').get().catch(() => null),
      col('googleConnections').doc('current').get().catch(() => null)
    ]);
    const courseCount = coursesSnap.data().count;
    const isConnected = !!(connDoc?.exists && connDoc.data()?.accessToken);
    const lastSync = syncDoc?.exists ? syncDoc.data()?.lastSyncAt : null;
    r.json({
      connected: isConnected,
      courseCount,
      lastSync,
      isSynced: courseCount > 0
    });
  })
);

// Lấy danh sách khóa học Google Classroom đã đồng bộ vào Database (100% SSOT không cắt xén)
classroomRouter.get(
  '/',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const s = await col('courses').get();
    const items = s.docs.map(d => ({ id: d.id, ...d.data() }));
    r.json({ total: items.length, items });
  })
);

// Đồng bộ dữ liệu thật từ Google Classroom (chạy qua OAuth User hoặc Service Account DWD)
classroomRouter.post(
  '/sync',
  firebaseAuth,
  requireCapability('RUN_SYNC'),
  asyncRoute(async (req, res) => {
    // 1. Kiểm tra Mode A (Tài khoản Google OAuth đã liên kết)
    const [userConnDoc, currentConnDoc] = await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).get(),
      col('googleConnections').doc('current').get()
    ]);
    const conn = userConnDoc.exists && userConnDoc.data()?.accessToken
      ? userConnDoc.data()
      : (currentConnDoc.exists && currentConnDoc.data()?.accessToken ? currentConnDoc.data() : null);

    if (conn && conn.accessToken) {
      let activeToken = conn.accessToken;
      const isExpired = conn.expiresAt && Date.now() > Number(conn.expiresAt) - 60000;
      if (isExpired && conn.refreshToken) {
        try {
          const cfgDoc = await col('system').doc('oauthConfig').get();
          const cfg = cfgDoc.exists ? cfgDoc.data() : null;
          const clientId = cfg?.clientId || env.GOOGLE_OAUTH_CLIENT_ID;
          const clientSecret = cfg?.clientSecret || env.GOOGLE_OAUTH_CLIENT_SECRET;
          if (clientId && clientSecret && !clientId.includes('your-client-id')) {
            const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                refresh_token: conn.refreshToken,
                grant_type: 'refresh_token'
              })
            });
            if (refreshRes.ok) {
              const refreshData = (await refreshRes.json()) as any;
              activeToken = refreshData.access_token;
              const updateData = {
                accessToken: activeToken,
                expiresAt: Date.now() + (refreshData.expires_in || 3600) * 1000,
                tokenExpiresAt: Date.now() + (refreshData.expires_in || 3600) * 1000
              };
              await Promise.all([
                col('googleConnections').doc(req.appUser!.uid).set(updateData, { merge: true }),
                col('googleConnections').doc('current').set(updateData, { merge: true })
              ]);
            }
          }
        } catch (e: any) {
          console.warn('Auto token refresh notice:', e.message);
        }
      }

      const syncResult = await syncAllCourses([], activeToken, conn.email || req.appUser!.email);
      await rebuildDashboard().catch(() => null);
      return res.json({
        ok: true,
        mode: 'MODE_A_OAUTH',
        message: `Đã đồng bộ thành công ${syncResult.success} khóa học từ Google Classroom tài khoản: ${conn.email}`,
        ...syncResult
      });
    }

    // 2. Kiểm tra Mode B (DWD Service Account cho toàn trường)
    const sa = resolveServiceAccount();
    const dwdEmail = sa?.data?.client_email || env.DWD_SERVICE_ACCOUNT_EMAIL;
    if (dwdEmail && env.WORKSPACE_ADMIN_SUBJECT) {
      const syncResult = await syncAllCourses([env.WORKSPACE_ADMIN_SUBJECT], undefined, 'DWD_SERVICE_ACCOUNT');
      await rebuildDashboard().catch(() => null);
      return res.json({
        ok: true,
        mode: 'MODE_B_DWD',
        message: `Đã đồng bộ thành công ${syncResult.success} khóa học toàn trường qua Google Workspace DWD (${env.WORKSPACE_ADMIN_SUBJECT})`,
        ...syncResult
      });
    }

    // 3. Chưa có kết nối Google Classroom
    return res.status(400).json({
      ok: false,
      error: {
        code: 'NOT_CONNECTED',
        message:
          'Chưa thiết lập kết nối với Google Classroom. Vui lòng vào mục "Quản Lý Kết Nối Google Classroom" để bấm "Kết nối tài khoản Google" (hoặc cấu hình file service-account.json cho trường).'
      }
    });
  })
);

// Cập nhật ánh xạ lớp hành chính
classroomRouter.patch(
  '/:id/map',
  firebaseAuth,
  requireCapability('MANAGE_SCHEDULES'),
  asyncRoute(async (q, r) => {
    const b = z
      .object({
        classId: z.string().min(1),
        className: z.string().min(1)
      })
      .parse(q.body);
    await col('courses').doc(String(q.params.id)).set(
      { ...b, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );
    await col('classes').doc(b.classId).set(
      {
        ...b,
        classroomCourseIds: FieldValue.arrayUnion(String(q.params.id)),
        updatedAt: FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    r.json({ ok: true });
  })
);

