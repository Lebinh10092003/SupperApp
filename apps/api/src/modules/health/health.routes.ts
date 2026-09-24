import { Router } from 'express';
import { sql, desc } from 'drizzle-orm';
import { asyncRoute } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { env } from '../../config/env.js';
import { syncRuns } from '../classroom/classroom.schema.js';
import { getClamInstance } from '../safety/evidence.js';

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

    // Đồng bộ Google Classroom (DWD) — trước đây SystemPage.tsx hiển thị
    // CỨNG "Chưa cấu hình / dữ liệu mẫu" bất kể trạng thái thật, viết từ lúc
    // DWD chưa cấu hình và không được cập nhật lại (Sin phát hiện 2026-09-25
    // khi rà soát lại hệ thống trước bàn giao — đối chiếu thấy .env đã có
    // đủ GOOGLE_SERVICE_ACCOUNT_KEY_PATH/WORKSPACE_ADMIN_SUBJECT/
    // DWD_SERVICE_ACCOUNT_EMAIL và sync_runs thật đã COMPLETED nhiều lần).
    // Giờ kiểm tra THẬT: có đủ cấu hình + lần đồng bộ gần nhất có thành
    // công trong 48 giờ qua không (đồng bộ chạy 1 lần/ngày qua cron).
    let classroomSync: 'ok' | 'not_configured' | 'stale' | 'error' = 'not_configured';
    try {
      const hasConfig = !!(env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH && env.WORKSPACE_ADMIN_SUBJECT && env.DWD_SERVICE_ACCOUNT_EMAIL);
      if (hasConfig) {
        const [lastRun] = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(1);
        if (!lastRun) {
          classroomSync = 'not_configured';
        } else if (lastRun.status !== 'COMPLETED') {
          classroomSync = 'error';
        } else {
          const ageMs = Date.now() - new Date(lastRun.startedAt).getTime();
          classroomSync = ageMs <= 48 * 60 * 60 * 1000 ? 'ok' : 'stale';
        }
      }
    } catch {
      classroomSync = 'error';
    }

    // ClamAV — cùng lý do trên, trước đây hiển thị cứng "Chưa cấu hình" dù
    // clamav-daemon đã thật sự được cài + chạy trên VPS. Thử init instance
    // thật (bắt tay với clamd) — lỗi = thật sự chưa sẵn sàng.
    let clamav: 'ok' | 'not_configured' = 'not_configured';
    try {
      await getClamInstance();
      clamav = 'ok';
    } catch {
      clamav = 'not_configured';
    }

    r.json({
      status: database === 'ok' ? 'ok' : 'degraded',
      database,
      classroomSync,
      clamav,
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  })
);
