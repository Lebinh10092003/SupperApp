# Job script chạy qua cron (không qua HTTP)

Các file trong thư mục này (`full-sync.ts`, `renew-subscriptions.ts`,
`refresh-metrics.ts`) là script CLI độc lập — build ra `dist/jobs/*.js`,
chạy trực tiếp bằng `node`, không qua route HTTP/auth. Kiến trúc cũ
(Firestore/Cloud Run) gọi các script này qua Cloud Scheduler → Cloud Run
Job; trên VPS hiện tại (`103.142.27.202`) phải tự đăng ký cron tương
đương — **không có gì tự động gọi các script này nếu không có dòng cron
thật trong `crontab -l`**.

## Cron đang chạy thật trên VPS (xem `crontab -l` để đối chiếu, cập nhật 2026-09-17)

```cron
# Tổng hợp dashboard + quét cảnh báo — thuần Postgres, KHÔNG cần Google
# OAuth credentials, an toàn chạy ngay cả khi chưa có Google Workspace.
*/15 * * * * cd /opt/supperapp/apps/api && /opt/node22/bin/node dist/jobs/refresh-metrics.js >> /var/log/supperapp-refresh-metrics.log 2>&1

# Đồng bộ Directory + Classroom thật từ Google (Domain-Wide Delegation,
# credentials đã cấu hình xong 2026-09-17, xem /opt/supperapp/secrets/).
# Chạy 1h sáng — trước giờ backup DB (2h) để bản backup có dữ liệu mới nhất,
# ngoài giờ hành chính để không ảnh hưởng tải hệ thống.
0 1 * * * cd /opt/supperapp/apps/api && /opt/node22/bin/node dist/jobs/full-sync.js >> /var/log/supperapp-full-sync.log 2>&1

# Quét đồng hồ SLA (ack/assign) module An toàn đã quá hạn, đẩy chuông cho
# chỉ huy/người được giao + lãnh đạo/trực ban đúng cơ sở (S10) — bổ sung
# 2026-09-21, Sin phát hiện quá hạn trước đây KHÔNG có hậu quả gì (isOverdue()
# có sẵn từ trước nhưng không job/route nào gọi tới). Idempotent qua cột
# sla_clocks.escalated_at — không spam lại mỗi 15 phút cho cùng 1 đồng hồ.
*/15 * * * * cd /opt/supperapp/apps/api && /opt/node22/bin/node dist/jobs/check-sla-overdue.js >> /var/log/supperapp-sla-overdue.log 2>&1
```

Log: `/var/log/supperapp-full-sync.log` trên VPS. Kiểm tra kết quả từng lần
chạy qua bảng `sync_runs` (Postgres) — mỗi lần chạy ghi 1 dòng
`type=FULL_SYNC`, `status=COMPLETED`/`FAILED`.

## `renew-subscriptions.ts` — KHÔNG đặt cron (hiện là placeholder, chưa làm gì thật)

Đọc code (`renew-subscriptions.ts`) xác nhận: script hiện tại chỉ ghi 1
dòng log vào `sync_runs` với nội dung "Cấu hình Classroom Push/Meet
subscriptions sau OAuth consent theo docs/DEPLOYMENT.md" — **không thực sự
gọi Google API nào để gia hạn subscription cả**. Đặt cron cho job này lúc
này sẽ chỉ tạo cảm giác sai rằng subscription đang được gia hạn tự động
trong khi thực chất không có gì xảy ra. Cần triển khai logic gia hạn thật
(gọi Classroom Push API / Meet API để renew channel trước khi hết hạn)
trước khi đặt cron — chưa làm vì chưa rõ ưu tiên, cần Sin quyết định có
cần tính năng Push/Meet realtime này trước khi bàn giao hay không.
