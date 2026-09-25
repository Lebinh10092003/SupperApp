import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { systemConfig } from '../system/system.schema.js';
import { syncRuns } from './classroom.schema.js';
import { syncAllCourses } from './classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';
import { evaluateAlertRules } from '../alerts/alert-engine.service.js';
import { resolveServiceAccount } from '../../core/firebase.js';
import { googleConnections } from '../connections/connections.schema.js';
import { env } from '../../config/env.js';

export interface AutoSyncConfig {
  enabled: boolean;
  frequency: 'HOURLY' | 'EVERY_6_HOURS' | 'EVERY_12_HOURS' | 'DAILY_NIGHT' | 'CUSTOM_HOURS';
  hour: number; // 0-23
  minute: number; // 0-59
  lastRunAt?: string | null;
  lastRunStatus?: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | null;
  lastRunSummary?: string | null;
  nextRunAt?: string | null;
}

const DEFAULT_CONFIG: AutoSyncConfig = {
  enabled: false,
  frequency: 'DAILY_NIGHT',
  hour: 23,
  minute: 0,
  lastRunAt: null,
  lastRunStatus: null,
  lastRunSummary: null,
  nextRunAt: null
};

const CONFIG_KEY = 'classroom_auto_sync_config';

export function calculateNextRun(config: AutoSyncConfig, fromDate = new Date()): Date {
  const next = new Date(fromDate);
  next.setSeconds(0, 0);

  if (config.frequency === 'HOURLY') {
    next.setHours(next.getHours() + 1);
    next.setMinutes(config.minute || 0);
    return next;
  }

  if (config.frequency === 'EVERY_6_HOURS') {
    const curHour = next.getHours();
    const nextHourBlock = (Math.floor(curHour / 6) + 1) * 6;
    next.setHours(nextHourBlock, config.minute || 0);
    return next;
  }

  if (config.frequency === 'EVERY_12_HOURS') {
    const curHour = next.getHours();
    const nextHourBlock = curHour < 12 ? 12 : 24;
    next.setHours(nextHourBlock, config.minute || 0);
    return next;
  }

  // DAILY_NIGHT or CUSTOM_HOURS
  next.setHours(config.hour ?? 23, config.minute ?? 0);
  if (next.getTime() <= fromDate.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export async function getAutoSyncConfig(): Promise<AutoSyncConfig> {
  const row = await db
    .select()
    .from(systemConfig)
    .where(eq(systemConfig.key, CONFIG_KEY))
    .then((r) => r[0] ?? null);

  if (!row || !row.value) {
    const next = calculateNextRun(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG, nextRunAt: next.toISOString() };
  }

  const cfg = { ...DEFAULT_CONFIG, ...(row.value as AutoSyncConfig) };
  if (cfg.enabled && (!cfg.nextRunAt || new Date(cfg.nextRunAt).getTime() < Date.now() - 3600000)) {
    cfg.nextRunAt = calculateNextRun(cfg).toISOString();
  }
  return cfg;
}

export async function saveAutoSyncConfig(updates: Partial<AutoSyncConfig>): Promise<AutoSyncConfig> {
  const current = await getAutoSyncConfig();
  const merged: AutoSyncConfig = { ...current, ...updates };

  if (merged.enabled) {
    merged.nextRunAt = calculateNextRun(merged).toISOString();
  } else {
    merged.nextRunAt = null;
  }

  await db
    .insert(systemConfig)
    .values({ key: CONFIG_KEY, value: merged })
    .onConflictDoUpdate({
      target: systemConfig.key,
      set: { value: merged, updatedAt: new Date() }
    });

  return merged;
}

/** Tự động tìm kiếm nguồn xác thực Google hợp lệ (DWD Mode B hoặc Mode A token) */
async function resolveSchedulerGoogleAuth(): Promise<{ token?: string; email?: string; isDwd?: boolean }> {
  // 1. Thử Mode B: Service Account DWD
  const sa = resolveServiceAccount();
  if (sa?.data?.private_key) {
    const dwdRow = await db
      .select()
      .from(systemConfig)
      .where(eq(systemConfig.key, 'dwdConfig'))
      .then((r) => r[0] ?? null);
    const dwdCfg = (dwdRow?.value as any) ?? {};
    const subject = dwdCfg.adminSubject || env.WORKSPACE_ADMIN_SUBJECT || 'admin@badinhedu.vn';

    try {
      const { dwdToken } = await import('../../integrations/dwd.js');
      const scopes = [
        'https://www.googleapis.com/auth/classroom.courses.readonly',
        'https://www.googleapis.com/auth/classroom.rosters.readonly',
        'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
        'https://www.googleapis.com/auth/classroom.announcements.readonly',
        'https://www.googleapis.com/auth/classroom.topics.readonly',
        'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
        'https://www.googleapis.com/auth/classroom.profile.emails'
      ];
      const token = await dwdToken(subject, scopes);
      return { token, email: subject, isDwd: true };
    } catch (e: any) {
      console.warn('[AutoSyncScheduler] Không thể lấy DWD token:', e.message);
    }
  }

  // 2. Thử Mode A: Connection hiện tại
  const currentConn = await db
    .select()
    .from(googleConnections)
    .where(eq(googleConnections.id, 'current'))
    .then((r) => r[0] ?? null);

  if (currentConn?.accessToken) {
    return { token: currentConn.accessToken, email: currentConn.email || undefined, isDwd: false };
  }

  return {};
}

let isSyncRunning = false;

export async function runScheduledSync(triggerType: 'AUTO_SCHEDULED' | 'MANUAL_TRIGGER' = 'AUTO_SCHEDULED'): Promise<{
  ok: boolean;
  runId: string;
  summary?: any;
  error?: string;
}> {
  if (isSyncRunning) {
    return { ok: false, runId: '', error: 'Một phiên đồng bộ khác đang được thực thi.' };
  }

  isSyncRunning = true;
  const runId = `autosync_${Date.now()}`;
  const now = new Date();

  try {
    console.log(`[AutoSyncScheduler] Bắt đầu phiên đồng bộ tự động (${triggerType}) [${runId}]...`);

    await db.insert(syncRuns).values({
      id: runId,
      type: triggerType,
      status: 'IN_PROGRESS',
      startedAt: now
    });

    const auth = await resolveSchedulerGoogleAuth();
    if (!auth.token && !auth.isDwd) {
      throw new Error(
        'Chưa có kết nối Google Classroom khả dụng. Vui lòng cấu hình Service Account DWD (Mode B) hoặc kết nối Google OAuth (Mode A).'
      );
    }

    const result = await syncAllCourses([], auth.token, auth.email);
    await rebuildDashboard().catch(() => null);
    await evaluateAlertRules().catch(() => null);

    const summaryText = `Đã đồng bộ thành công ${result.success}/${result.courses} khóa học Google Classroom.`;

    await db
      .update(syncRuns)
      .set({
        status: 'COMPLETED',
        note: summaryText,
        finishedAt: new Date()
      })
      .where(eq(syncRuns.id, runId));

    const currentCfg = await getAutoSyncConfig();
    const nextRun = calculateNextRun(currentCfg);

    await saveAutoSyncConfig({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'SUCCESS',
      lastRunSummary: summaryText,
      nextRunAt: currentCfg.enabled ? nextRun.toISOString() : null
    });

    console.log(`[AutoSyncScheduler] Hoàn tất phiên [${runId}]: ${summaryText}`);
    return { ok: true, runId, summary: result };
  } catch (err: any) {
    console.error(`[AutoSyncScheduler] Lỗi phiên đồng bộ [${runId}]:`, err.message);

    await db
      .update(syncRuns)
      .set({
        status: 'FAILED',
        note: err.message,
        finishedAt: new Date()
      })
      .where(eq(syncRuns.id, runId));

    const currentCfg = await getAutoSyncConfig();
    const nextRun = calculateNextRun(currentCfg);

    await saveAutoSyncConfig({
      lastRunAt: new Date().toISOString(),
      lastRunStatus: 'FAILED',
      lastRunSummary: `Lỗi: ${err.message}`,
      nextRunAt: currentCfg.enabled ? nextRun.toISOString() : null
    });

    return { ok: false, runId, error: err.message };
  } finally {
    isSyncRunning = false;
  }
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function initAutoSyncScheduler() {
  if (schedulerTimer) return;

  console.log('[AutoSyncScheduler] Đã khởi chạy trình lập lịch đồng bộ tự động School Intelligence.');

  schedulerTimer = setInterval(async () => {
    try {
      const cfg = await getAutoSyncConfig();
      if (!cfg.enabled) return;

      const now = new Date();
      // Kiểm tra xem đã đến giờ chạy chưa
      const curHour = now.getHours();
      const curMin = now.getMinutes();

      let shouldRun = false;

      if (cfg.frequency === 'HOURLY') {
        if (curMin === (cfg.minute || 0)) shouldRun = true;
      } else if (cfg.frequency === 'EVERY_6_HOURS') {
        if (curHour % 6 === 0 && curMin === (cfg.minute || 0)) shouldRun = true;
      } else if (cfg.frequency === 'EVERY_12_HOURS') {
        if (curHour % 12 === 0 && curMin === (cfg.minute || 0)) shouldRun = true;
      } else {
        // DAILY_NIGHT or CUSTOM_HOURS
        if (curHour === (cfg.hour ?? 23) && curMin === (cfg.minute ?? 0)) shouldRun = true;
      }

      if (shouldRun) {
        // Ngăn chặn chạy lặp lại trong cùng 1 phút
        if (cfg.lastRunAt) {
          const diffMs = now.getTime() - new Date(cfg.lastRunAt).getTime();
          if (diffMs < 120000) return; // Đã chạy trong 2 phút qua -> bỏ qua
        }

        console.log(`[AutoSyncScheduler] Đã đến giờ đồng bộ tự động theo lịch (${curHour}:${curMin})!`);
        await runScheduledSync('AUTO_SCHEDULED');
      }
    } catch (e: any) {
      console.warn('[AutoSyncScheduler] Lỗi vòng lặp kiểm tra lịch:', e.message);
    }
  }, 45000); // Kiểm tra mỗi 45 giây
}
