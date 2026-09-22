/**
 * migrate-pending-reports-2026-09-22.ts — script CHẠY 1 LẦN DUY NHẤT khi
 * deploy tính năng "gộp Tin báo + Hồ sơ sự cố" (2026-09-22). Từ nay
 * `submitReport()` tự tạo `incidents` row ngay lúc gửi tin — nhưng các tin
 * báo GỬI TRƯỚC ngày deploy này vẫn còn ở trạng thái "chờ chuyển thành hồ
 * sơ" cũ (`reports.merged_into_incident_id IS NULL`). Script này chuyển
 * NỐT các tin báo còn tồn đọng đó thành hồ sơ, dùng ĐÚNG logic tính
 * priority mà submitReport() dùng, để không còn tin báo nào bị kẹt ở
 * trạng thái lấp lửng sau khi đổi luồng.
 *
 * KHÔNG đặt cron cho file này — chạy tay đúng 1 lần lúc deploy:
 *   node --import tsx src/jobs/migrate-pending-reports-2026-09-22.ts
 * (hoặc bản build: node dist/jobs/migrate-pending-reports-2026-09-22.js)
 */
import 'dotenv/config';
import { isNull } from 'drizzle-orm';
import { db } from '../core/db/client.js';
import { reports } from '../modules/safety/reports.schema.js';
import { createIncidentFromReport } from '../modules/safety/report-flow.js';
import { PRIORITY, suggestedPriorityForCategory } from '../modules/safety/catalog.js';
import { makeDispatchHook, makeBellHook, makeNotifyReporterHook } from '../modules/safety/notify-hooks.js';

const dispatch = makeDispatchHook();
const pushBell = makeBellHook();
const notifyReporter = makeNotifyReporterHook();

async function run() {
  const now = new Date();
  const pending = await db.select().from(reports).where(isNull(reports.mergedIntoIncidentId));

  console.log(`[migrate-pending-reports] Tìm thấy ${pending.length} tin báo còn tồn đọng (chưa chuyển thành hồ sơ).`);

  let ok = 0;
  let failed = 0;
  for (const report of pending) {
    const priority = report.stillDangerous ? PRIORITY.P0 : suggestedPriorityForCategory(report.categoryCode);
    try {
      const result = await createIncidentFromReport(db, { reportId: report.reportId, priority }, { now, dispatch, pushBell, notifyReporter });
      console.log(`[migrate-pending-reports] OK  ${report.reportId} -> ${result.incidentId} (priority=${priority})`);
      ok += 1;
    } catch (e) {
      console.error(`[migrate-pending-reports] FAIL ${report.reportId}:`, e instanceof Error ? e.message : e);
      failed += 1;
    }
  }

  console.log('[migrate-pending-reports] XONG', JSON.stringify({ total: pending.length, ok, failed }));
}

try {
  await run();
} catch (e) {
  console.error('[migrate-pending-reports] FAILED', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
