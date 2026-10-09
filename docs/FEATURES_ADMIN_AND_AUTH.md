# Đăng nhập, Quản trị người dùng & Tiện ích chung

Code: `apps/web/src/{auth,features/login,features/admin,features/settings,features/contacts,layout}/` · `apps/api/src/{auth,modules/session,modules/admin,modules/identity,modules/system,modules/health}/`

## 1. Đăng nhập

- **Trang** `/login`: đăng nhập bằng **email + mật khẩu** hoặc **Google**; có đăng ký tạo tài khoản và hiển thị mật khẩu. Thông báo lỗi Firebase được dịch sang tiếng Việt (sai mật khẩu, quá nhiều lần thử, tài khoản bị vô hiệu hóa…).
- **Cơ chế**: Firebase Auth cấp ID token → frontend gọi `POST /api/session/bootstrap` (header `Authorization: Bearer <token>`):
  1. Email nằm trong `BOOTSTRAP_SUPER_ADMIN_EMAILS` / `BOOTSTRAP_ADMIN_EMAILS` → tự tạo user với vai trò quản trị.
  2. Không thì phải có trong **danh sách cấp quyền** (`access_allowlist`) và đang `active`, nếu không trả **403 "Tài khoản chưa được cấp quyền"** — nghĩa là *không ai tự đăng ký vào được nếu chưa được quản trị cấp*.
  3. Lần đăng nhập sau chỉ cập nhật `lastLogin`.
- `GET /api/session/me` trả hồ sơ; `PATCH /api/session/me` cho **tự sửa tên hiển thị** (không tự đổi email/vai trò).
- **Chế độ dev**: token bắt đầu `dev:` chỉ dùng khi `ALLOW_DEV_AUTH_BYPASS=true` — **tuyệt đối không bật ở production**.
- Frontend: `ProtectedRoute` (bắt đăng nhập) + `RoleRoute` (kiểm tra vai trò app-level) bọc từng route.

## 2. Quản trị & phân quyền (`/admin`)

Truy cập: Super/System Admin, School Admin, Hiệu trưởng, Phó Hiệu trưởng (capability `MANAGE_USERS`). Phó HT **chỉ quản lý người trong đúng phân hiệu mình phụ trách** (giới hạn ở backend `admin.routes.ts`).

**Quản lý tài khoản nghiệp vụ (`SafetyUsersSection`)**
- Danh sách người dùng: họ tên, vai trò, **cơ sở/tổ**, trạng thái, hành động.
- Thêm người dùng, sửa vai trò–cơ sở–lĩnh vực (`assignments`), **gán trước** cho người chưa đăng nhập (`safety-users/pending/:email`), **đặt lại mật khẩu**, **vô hiệu/kích hoạt** tài khoản.
- Vai trò gán qua giao diện: các vai trò nghiệp vụ `R.*` (trừ GVCN, Chỉ huy sự cố, Người báo tin – nhóm này được suy ra, không gán tay).
- **Phân công GVCN theo lớp** và **GV phụ trách khối** (`homeroom-assignments`, `grade-supervisor-assignments`).
- Danh sách **cấp quyền truy cập** theo email (`/api/admin/access`: xem/thêm/xóa).
- Nút **Chạy Full Sync Google Workspace** (`POST /api/admin/full-sync`).
- Mọi thay đổi ghi `general_audit_logs`.

## 3. Danh bạ nhóm (Cài đặt → Quản lý sổ danh bạ)

- `/api/contacts/groups`: tạo/sửa/xóa **nhóm danh bạ** và thành viên.
- Dùng làm bộ chọn nhanh ở Lịch công tác (chọn cả nhóm làm thành phần tham dự) — `ContactGroupPickerDialog`.
- Có nhóm cá nhân và **nhóm toàn trường** (chỉ Super/School Admin/Hiệu trưởng/Phó HT quản lý nhóm toàn trường — `assertCanManageGroup`).

## 4. Cài đặt (`/settings`, hiển thị dạng modal)

| Mục | Nội dung |
|---|---|
| Giao diện | Sáng/tối (ThemeProvider), tùy chọn hiển thị |
| Quản lý sổ danh bạ | Xem §3 |

## 5. Khung giao diện chung (`layout/`)

- **Sidebar** thu gọn được (270 px ↔ 68 px), nhóm menu theo vai trò (`nav-data.tsx`), badge (LIVE, P0/P1, BI, MỚI, BETA).
- **Topbar** + breadcrumb theo route, chuông thông báo, menu người dùng.
- **Command Palette**: tìm nhanh trang theo quyền.
- **UrgentIncidentBanner**: banner sự cố khẩn P0/P1 xuyên suốt app.
- **MobileSheet**: menu trên điện thoại. App là PWA (`manifest.json`, `sw.js`) nên cài được lên màn hình chính và nhận Web Push.

## 6. Tình trạng hệ thống & chất lượng dữ liệu

- `/system` (chỉ Super/System Admin): độ trễ API, kết nối DB, trạng thái Google/Service Account, số bản ghi.
- `/data-quality` (HT trở lên): phát hiện dữ liệu thiếu/lệch.
- `GET /health`: endpoint kiểm tra sống (không cần đăng nhập).

## 7. Biến môi trường chính (`apps/api/.env.example`)

| Nhóm | Biến |
|---|---|
| Cơ bản | `PROJECT_ID, REGION, SCHOOL_ID, SCHOOL_NAME, PORT, WEB_ORIGIN, API_BASE_URL` |
| Quản trị khởi tạo | `BOOTSTRAP_SUPER_ADMIN_EMAILS, BOOTSTRAP_SUPER_ADMIN_DOMAINS, BOOTSTRAP_ADMIN_EMAILS` |
| Google OAuth / Classroom | `GOOGLE_OAUTH_*, CLASSROOM_OAUTH_*` |
| Workspace / DWD | `WORKSPACE_DOMAIN, WORKSPACE_ADMIN_SUBJECT, DWD_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY_PATH, TEACHER_OU_PREFIXES, STUDENT_OU_PREFIXES` |
| Pub/Sub | `CLASSROOM_TOPIC, MEET_TOPIC, PUBSUB_PUSH_*` |
| CSDL | `DATABASE_URL, DATABASE_POOL_MIN/MAX, ALLOW_DESTRUCTIVE_DATABASE_TESTS` |
| Lịch tuần | `WEEKLY_SHEET_EDITOR_EMAILS` |
| Quét virus | `CLAMD_HOST, CLAMD_PORT, CLAMD_SOCKET` |
| Dev | `ALLOW_DEV_AUTH_BYPASS` |
| Web Push | `VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT` |
| Email | `SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM` |

## 8. Công cụ vận hành (`apps/api/scripts/`)

`migrate.mjs` (chạy migration), `create-bootstrap-admin.ts`, `import-safety-people-*.ts` (nhập danh sách nhân sự thật), `reset-safety-people-default-password.ts`, `seed-*` (dữ liệu demo/staging, có guard chống chạy nhầm production — `staging-review-data-guard.mjs`, `database-test-guard.mjs`), `generate-canonical-schema.mjs` + `compare-schema-manifest.mjs` (đối chiếu schema).
