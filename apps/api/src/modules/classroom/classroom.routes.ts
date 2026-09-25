import { Router } from 'express';
import { z } from 'zod';
import { eq, count, sql, desc, inArray } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { resolveServiceAccount } from '../../core/firebase.js';
import { env } from '../../config/env.js';
import { syncAllCourses, deleteSyncRun, rebuildClassesFromCourses } from './classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';
import { courses, syncRuns, classMappings } from './classroom.schema.js';
import { classes } from '../classes/classes.schema.js';
import { googleConnections } from '../connections/connections.schema.js';
import { systemConfig } from '../system/system.schema.js';

export const classroomRouter = Router();

async function getConnection(id: string) {
  return db.select().from(googleConnections).where(eq(googleConnections.id, id)).then((r) => r[0] ?? null);
}

async function getSystemConfig<T = any>(key: string): Promise<T | null> {
  const row = await db.select().from(systemConfig).where(eq(systemConfig.key, key)).then((r) => r[0] ?? null);
  return (row?.value as T) ?? null;
}

// Kiểm tra trạng thái kết nối và số lượng khóa học Google Classroom
classroomRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_q, r) => {
    const [[courseCountRow], syncStatus, conn] = await Promise.all([
      db.select({ n: count() }).from(courses),
      getSystemConfig<{ lastSyncAt?: string }>('syncStatus'),
      getConnection('current')
    ]);
    const courseCount = courseCountRow?.n ?? 0;
    const isConnected = Boolean(conn?.accessToken);
    r.json({
      connected: isConnected,
      courseCount,
      lastSync: syncStatus?.lastSyncAt ?? null,
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
    const items = await db.select().from(courses);
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
    const [userConn, currentConn] = await Promise.all([
      getConnection(req.appUser!.uid),
      getConnection('current')
    ]);
    const conn = userConn?.accessToken ? userConn : currentConn?.accessToken ? currentConn : null;

    if (conn && conn.accessToken) {
      let activeToken = conn.accessToken;
      const isExpired = conn.expiresAt && Date.now() > conn.expiresAt.getTime() - 60000;
      if (isExpired && conn.refreshToken) {
        try {
          const cfg = await getSystemConfig<{ clientId?: string; clientSecret?: string }>('oauthConfig');
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
              const newExpiresAt = new Date(Date.now() + (refreshData.expires_in || 3600) * 1000);
              await Promise.all(
                [req.appUser!.uid, 'current'].map((id) =>
                  db
                    .update(googleConnections)
                    .set({ accessToken: activeToken, expiresAt: newExpiresAt, tokenExpiresAt: newExpiresAt, updatedAt: new Date() })
                    .where(eq(googleConnections.id, id))
                )
              );
            }
          }
        } catch (e: any) {
          console.warn('Auto token refresh notice:', e.message);
        }
      }

      const email = conn.email || req.appUser!.email || 'admin@badinhedu.vn';

      const syncResult = await syncAllCourses([], activeToken, email);
      await rebuildDashboard().catch(() => null);
      return res.json({
        ok: true,
        mode: 'MODE_A_OAUTH',
        message: `Đã đồng bộ thành công ${syncResult.success} khóa học từ Google Classroom tài khoản: ${email}`,
        ...syncResult
      });
    }

    // 2. Kiểm tra Mode B (DWD Service Account cho toàn trường có file private key)
    const sa = resolveServiceAccount();
    if (sa?.data?.private_key && env.WORKSPACE_ADMIN_SUBJECT) {
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
    const courseId = String(q.params.id);
    const grade = Number(b.classId.match(/^(?:1[0-2]|[1-9])/)?.[0]) || null;

    // 1. Cập nhật khoá học courses
    await db
      .update(courses)
      .set({
        classId: b.classId,
        className: b.className,
        grade,
        updatedAt: new Date()
      })
      .where(eq(courses.id, courseId));

    // 2. Cập nhật hoặc lưu mới bảng ánh xạ classMappings (confirmed)
    await db
      .insert(classMappings)
      .values({
        courseId,
        courseName: b.className,
        classId: b.classId,
        className: b.className,
        grade,
        confidence: '1.00',
        confirmed: true
      })
      .onConflictDoUpdate({
        target: classMappings.courseId,
        set: {
          classId: b.classId,
          className: b.className,
          grade,
          confidence: '1.00',
          confirmed: true,
          updatedAt: new Date()
        }
      });

    // 3. Tự động tính toán lại 100% dữ liệu lớp học và dashboard từ các khoá học
    await rebuildClassesFromCourses();
    await rebuildDashboard().catch(() => null);

    r.json({ ok: true, message: `Đã ánh xạ thành công khóa học vào ${b.className}` });
  })
);

// Danh sách các phiên đồng bộ kèm số lượng khoá học thực tế
classroomRouter.get(
  '/sync-runs',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (_req, res) => {
    const allRuns = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt));
    const courseCounts = await db
      .select({
        syncRunId: courses.syncRunId,
        count: count()
      })
      .from(courses)
      .groupBy(courses.syncRunId);
    const countMap = new Map(courseCounts.filter((c) => c.syncRunId).map((c) => [c.syncRunId!, c.count]));
    const items = allRuns.map((r) => ({
      ...r,
      coursesCount: countMap.get(r.id) ?? r.coursesTotal ?? 0
    }));
    res.json({ total: items.length, items });
  })
);

// Danh sách khoá học thuộc phiên đồng bộ
classroomRouter.get(
  '/sync-runs/:id/courses',
  firebaseAuth,
  requireCapability('VIEW_DASHBOARD'),
  asyncRoute(async (req, res) => {
    const runId = String(req.params.id);
    const items = await db.select().from(courses).where(eq(courses.syncRunId, runId));
    res.json({ total: items.length, items });
  })
);

// Rollback toàn bộ khoá học của một phiên đồng bộ
classroomRouter.delete(
  '/sync-runs/:id',
  firebaseAuth,
  requireCapability('RUN_SYNC'),
  asyncRoute(async (req, res) => {
    const runId = String(req.params.id);
    const result = await deleteSyncRun(runId);
    res.json({
      ok: true,
      message: `Đã rollback phiên đồng bộ ${runId}. Đã xoá ${result.coursesDeleted} khoá học liên kết.`,
      ...result
    });
  })
);

