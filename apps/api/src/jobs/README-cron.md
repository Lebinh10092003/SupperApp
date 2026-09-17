# Job script chạy qua cron (không qua HTTP)

Các file trong thư mục này (`full-sync.ts`, `renew-subscriptions.ts`,
`refresh-metrics.ts`) là script CLI độc lập — build ra `dist/jobs/*.js`,
chạy trực tiếp bằng `node`, không qua route HTTP/auth. Kiến trúc cũ
(Firestore/Cloud Run) gọi các script này qua Cloud Scheduler → Cloud Run
Job; trên VPS hiện tại (`103.142.27.202`) phải tự đăng ký cron tương
đương — **không có gì tự động gọi các script này nếu không có dòng cron
thật trong `crontab -l`**.

## Cron đang chạy thật trên VPS (xem `crontab -l` để đối chiếu)

```cron
# Tổng hợp dashboard + quét cảnh báo — thuần Postgres, KHÔNG cần Google
# OAuth credentials, an toàn chạy ngay cả khi chưa có Google Workspace.
*/15 * * * * cd /opt/supperapp/apps/api && /opt/node22/bin/node dist/jobs/refresh-metrics.js >> /var/log/supperapp-refresh-metrics.log 2>&1
```

## Job CHƯA có cron (cần Google OAuth credentials trước, xem mục "Việc
còn tồn đọng" ở AGENT_COORDINATION/KILLSHOT_REPORTS.md)

- `full-sync.ts` — đồng bộ Directory + Classroom thật từ Google, sẽ luôn
  FAILED tới khi có credentials.
- `renew-subscriptions.ts` — gia hạn Classroom Push/Meet subscriptions,
  cùng lý do.

Khi có credentials thật, cân nhắc đăng ký thêm cron cho 2 job trên (tần
suất tuỳ Sin quyết — sync toàn trường không cần chạy dày như
refresh-metrics).
