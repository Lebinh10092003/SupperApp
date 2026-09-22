/**
 * refresh-metrics.ts — job định kỳ (chạy qua cron trên VPS, xem
 * /opt/supperapp/apps/api/README-cron.md hoặc crontab thật trên VPS) tổng
 * hợp lại dashboard (metrics_daily) + quét luật cảnh báo (alerts). Tách
 * riêng khỏi jobs/full-sync.ts vì 2 bước này KHÔNG cần Google Workspace
 * OAuth credentials (thuần đọc/ghi Postgres) — trong khi full-sync.ts bị
 * chặn ngay bước đầu (syncDirectory/syncAllCourses) khi chưa có credentials
 * thật, khiến rebuildDashboard()/evaluateAlertRules() không bao giờ chạy
 * tới dù bản thân chúng không phụ thuộc Google gì cả (phát hiện thật khi
 * audit — báo cáo CSV "Chuyên cần" từng tải ra rỗng hoàn toàn vì lý do
 * này). Khi có Google credentials thật, full-sync.ts vẫn là nguồn dữ liệu
 * chính xác nhất (đọc thẳng Classroom/Directory) — job này chỉ đảm bảo
 * dashboard/alerts không bị "đứng yên" vô thời hạn nếu full-sync chưa chạy
 * được hoặc chạy cách xa nhau.
 */
import 'dotenv/config';
import { rebuildDashboard } from '../modules/dashboard/dashboard.service.js';
import { evaluateAlertRules } from '../modules/alerts/alert-engine.service.js';

try {
  const dashboard = await rebuildDashboard();
  const alerts = await evaluateAlertRules();
  console.log('[refresh-metrics] OK', JSON.stringify({ date: dashboard.date, alertsEvaluated: alerts.evaluated, alertsGenerated: alerts.generated }));
} catch (e) {
  console.error('[refresh-metrics] FAILED', e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
