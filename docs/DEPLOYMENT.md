# Triển khai (VPS)

Hiện trạng: một VPS chạy **nginx** (phục vụ web tĩnh và proxy `/api`), **pm2** (giữ API sống), **PostgreSQL**, **ClamAV** (quét minh chứng) và **cron**. Các script `scripts/0*.ps1` và `firebase.json` (Cloud Run / Firebase Hosting / Firestore) thuộc kiến trúc cũ và **không còn là quy trình hiện hành**.

## 1. Yêu cầu trên VPS

- Node.js 22 (`>=22 <25`), npm, pm2 (`npm i -g pm2`)
- PostgreSQL, tạo một database và một user ứng dụng riêng (không dùng superuser)
- nginx
- `clamav-daemon` (tùy chọn nhưng nên có; không có thì minh chứng không được quét)
- Có thể truy cập Firebase Auth (đăng nhập) và, nếu dùng Classroom, Google APIs

## 2. Cấu hình

```bash
cp apps/api/.env.example apps/api/.env       # điền giá trị thật
cp apps/web/.env.example apps/web/.env       # file build của web
```

Biến bắt buộc/quan trọng (đầy đủ ở `.env.example`):

| Nhóm | Biến |
|---|---|
| API | `PORT, WEB_ORIGIN, API_BASE_URL, DATABASE_URL, BOOTSTRAP_SUPER_ADMIN_EMAILS` |
| Firebase Admin | thông tin service account Firebase dùng xác minh ID token |
| Google | `GOOGLE_OAUTH_*`, `WORKSPACE_DOMAIN`, `WORKSPACE_ADMIN_SUBJECT`, `DWD_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` (scope DWD: xem `docs/DWD_SCOPES.md`) |
| Thông báo | `VAPID_*`, `SMTP_*` |
| Lịch tuần | `WEEKLY_SHEET_EDITOR_EMAILS` |
| Quét virus | `CLAMD_HOST/PORT` hoặc `CLAMD_SOCKET` |

**Không bật** `ALLOW_DEV_AUTH_BYPASS` và `ALLOW_DESTRUCTIVE_DATABASE_TESTS` trên production.

Web (`VITE_*`) được **nhúng vào bundle lúc build**. Đặt `VITE_API_BASE_URL` để trống khi dùng nginx cùng origin.

## 3. Lần đầu

```bash
npm ci
npm --workspace apps/api run build
npm --workspace apps/api run db:migrate      # database mới, chạy chuỗi migration từ 0
npm --workspace apps/web run build
```

Tạo quản trị đầu tiên bằng `apps/api/scripts/create-bootstrap-admin.ts` hoặc đặt email vào `BOOTSTRAP_SUPER_ADMIN_EMAILS`.

**Database production đã có sẵn**: không chạy `db:migrate` từ đầu. Chạy kiểm tra `db:fingerprint` (chỉ đọc), rồi `db:adopt-baseline` (chỉ ghi metadata). Xem `apps/api/drizzle/README.md`.

## 4. Chạy API bằng pm2

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup          # chạy đúng lệnh nó in ra, một lần
```

Xem log: `pm2 logs superapp-api`. Deploy bản mới: build lại rồi `pm2 reload superapp-api` (không downtime).

## 5. nginx

Mẫu: `deploy/nginx.conf.example`. Ý chính:
- `root` trỏ thư mục `apps/web/dist`, `try_files … /index.html` cho SPA
- `/assets/` cache dài hạn
- `/api/` và `/health` proxy tới `127.0.0.1:8080`; `client_max_body_size 55m` (video minh chứng tối đa 50 MB)
- Thêm HTTPS (certbot) và header bảo mật; mẫu mới chỉ có cổng 80

## 6. Cron

Đăng ký thủ công (`crontab -e`). Nội dung đầy đủ và lý do: `apps/api/src/jobs/README-cron.md`.

| Job | Lịch | Việc |
|---|---|---|
| `refresh-metrics.js` | mỗi 15 phút | Tổng hợp dashboard, quét cảnh báo sớm |
| `full-sync.js` | 01:00 | Đồng bộ Directory + Classroom |
| `check-sla-overdue.js` | mỗi 15 phút | Leo thang SLA quá hạn |
| `check-unclaimed-incidents.js` | mỗi 15 phút | Nhắc hồ sơ chưa ai tiếp nhận |

Không đặt cron cho `renew-subscriptions.js` (chưa làm gì thật).

## 7. Backup

`deploy/backup-postgres.sh`: `pg_dump | gzip` hằng ngày (cron 02:00), giữ 14 ngày. Phải tự đẩy bản sao ra ngoài VPS và **thử khôi phục ít nhất một lần**.

## 8. Quy tắc khi deploy frontend

**Luôn build `apps/web` trên VPS**, không build trên máy cá nhân rồi chép `dist/` lên. Vite nhúng `VITE_*` lúc build; build local mang `VITE_API_BASE_URL=http://localhost:8080` lên production làm mọi người không đăng nhập được (sự cố 17/09/2026, xem `docs/mistakes.md`). Sau mỗi lần deploy:

```bash
curl -s https://<domain>/ | grep -o 'assets/[^"]*\.js' | head -1   # lấy tên bundle
curl -s https://<domain>/assets/<bundle>.js | grep -c localhost      # phải = 0 cho luồng gọi API
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<domain>/api/session/bootstrap   # mong đợi 401
curl -s https://<domain>/health
```

## 9. Kiểm tra sau triển khai

- `/health` trả OK, `pm2 status` ổn định
- Đăng nhập được bằng tài khoản thật; `/safety/report` mở được khi chưa đăng nhập
- Gửi thử một tin báo kèm ảnh, kiểm tra trạng thái quét (`clear`)
- Log cron không báo lỗi (`/var/log/supperapp-*.log`)
- Bảng `sync_runs` có dòng `FULL_SYNC` thành công sau 01:00
