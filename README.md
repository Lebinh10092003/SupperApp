# SuperApp — THCS Giảng Võ

Ứng dụng web nội bộ của Trường THCS Giảng Võ (Ba Đình, Hà Nội), gồm các phân hệ dùng chung một hệ thống đăng nhập, danh bạ người dùng và phân quyền:

| Phân hệ | Đường dẫn | Mô tả |
|---|---|---|
| **Cảnh báo an toàn & xử lý sự cố** | `/safety` | Tiếp nhận tin báo (công khai, không cần đăng nhập), tạo hồ sơ, giao chỉ huy, SLA, leo thang, đóng hồ sơ |
| **Lịch công tác & Giao việc** | `/work-schedule` | Lịch theo cơ sở/toàn trường, giao việc, lịch trông thi, lịch tuần, nhắc nhở |
| **Điều hành lớp học số** | `/classes`, `/classroom`, … | Đồng bộ Google Classroom/Meet, điểm danh, thời khóa biểu, cảnh báo sớm, báo cáo |
| **Quản trị hệ thống** | `/admin`, `/connections`, … | Tài khoản, phân quyền, danh bạ, kết nối Google, chất lượng dữ liệu |

> Mô tả chi tiết từng chức năng: [`docs/FEATURES_OVERVIEW.md`](docs/FEATURES_OVERVIEW.md) và các file `docs/FEATURES_*.md`. Ghi chú review: [`docs/REVIEW_NOTES.md`](docs/REVIEW_NOTES.md).

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend (`apps/web`) | React 19, TypeScript, Vite 6, React Router 7, Tailwind CSS 4 + shadcn/ui, Recharts, PWA (Web Push) |
| Backend (`apps/api`) | Node.js 22+, Express 5, TypeScript, Drizzle ORM, `pg` |
| Cơ sở dữ liệu | **PostgreSQL** (một database cho một trường, không multi-tenant) |
| Xác thực | Firebase Auth (email/mật khẩu, Google) + danh sách cấp quyền trong DB |
| Tích hợp | Google Workspace (Directory, Classroom, Meet) qua OAuth hoặc Domain-Wide Delegation; SMTP; Web Push (VAPID); ClamAV quét minh chứng |
| Triển khai | VPS: pm2 + nginx + cron (xem `deploy/`) |

## Yêu cầu môi trường

- Node.js `>=22 <25`, npm 10+ (npm workspaces)
- PostgreSQL (cục bộ hoặc từ xa)
- Một project Firebase (Auth) để đăng nhập

## Chạy trên máy cá nhân

```powershell
# 1. Cài thư viện cho cả monorepo
npm install

# 2. Tạo file cấu hình từ mẫu rồi điền giá trị thật
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Tạo schema database (đặt DATABASE_URL trong apps/api/.env trước)
npm --workspace apps/api run db:migrate

# 4. Chạy API (8080) và Web (5173) trong cùng một terminal
npm run dev
```

| Dịch vụ | URL |
|---|---|
| Web | http://localhost:5173 |
| API | http://localhost:8080 |
| Health check | http://localhost:8080/health |

**Đăng nhập**: không có tài khoản demo. Email phải nằm trong `BOOTSTRAP_SUPER_ADMIN_EMAILS` / `BOOTSTRAP_ADMIN_EMAILS` (tự tạo quản trị lần đầu), hoặc đã được cấp quyền qua trang `/admin`. Email chưa được cấp quyền sẽ nhận lỗi 403 "Tài khoản chưa được cấp quyền".

Tạo quản trị đầu tiên bằng script: `apps/api/scripts/create-bootstrap-admin.ts`. Dữ liệu mẫu cho môi trường review: `npm --workspace apps/api run seed:staging-review` (chỉ dùng trên staging/dev, có guard chống chạy nhầm).

> `ALLOW_DEV_AUTH_BYPASS` cho phép bỏ qua xác thực khi phát triển. **Không bật ở production.**

## Vai trò & phân quyền

Có **hai hệ vai trò** tách biệt:

1. **Vai trò cấp ứng dụng** — ẩn/hiện menu, gate API cơ bản: `SYSTEM_SUPER_ADMIN, SYSTEM_ADMIN, SCHOOL_ADMIN, PRINCIPAL, VICE_PRINCIPAL, DEPARTMENT_HEAD, HOMEROOM, TEACHER, DATA_VIEWER/VIEWER` (`apps/api/src/auth/roles.ts`).
2. **16 vai trò nghiệp vụ `R.*`** gán theo cơ sở/lĩnh vực (Hiệu trưởng, Phó HT, Trực ban, Tổ trưởng, Văn phòng, GV, GVCN, Y tế, Tư vấn tâm lý, Bảo vệ, CSVC, Chỉ huy sự cố, Quản trị HT, Kiểm toán, Bên ngoài, Người báo tin) — là hệ quyền thật của module An toàn và Lịch công tác (`modules/safety/authz.ts`, `modules/work-schedule/work-schedule.authz.ts`).

Gate ở frontend chỉ mang tính gợi ý; quyền thật luôn được kiểm tra ở server. Ba cơ sở dùng chung: `MAIN_CAMPUS`, `CAMPUS_1`, `CAMPUS_2`.

## Cấu trúc thư mục

```text
SupperApp/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ modules/     # mỗi chức năng: *.routes.ts, *.schema.ts, service
│  │  │  │               #   safety, work-schedule, identity, admin, session,
│  │  │  │               #   classroom, classes, connections, catalog, people,
│  │  │  │               #   meet, attendance, schedules, dashboard, alerts,
│  │  │  │               #   reports, analytics, audit, data-quality, system
│  │  │  ├─ jobs/        # script cron (xem jobs/README-cron.md)
│  │  │  ├─ auth/ core/ config/ integrations/
│  │  │  └─ server.ts    # ghép router
│  │  ├─ drizzle/        # chuỗi migration chính thức (baseline 0000)
│  │  ├─ drizzle-legacy/ # migration cũ, chỉ để tham khảo
│  │  ├─ schema/         # canonical-schema.json
│  │  └─ scripts/        # migrate, seed, import nhân sự, guard...
│  └─ web/
│     └─ src/
│        ├─ app/App.tsx  # toàn bộ route
│        ├─ features/    # mỗi trang/chức năng
│        ├─ layout/      # sidebar, topbar, command palette, banner khẩn
│        ├─ auth/ components/ services/ theme/
├─ deploy/               # pm2, nginx, backup Postgres
├─ scripts/              # dev.mjs, verify-source.mjs, script PowerShell triển khai GCP (cũ)
├─ docs/                 # tài liệu
├─ DOCS.md               # tài liệu kiến trúc Classroom (một phần đã cũ)
└─ package.json
```

## Cấu hình môi trường

Mẫu đầy đủ ở `apps/api/.env.example` và `apps/web/.env.example`. Các nhóm chính:

| Nhóm | Biến (API) |
|---|---|
| Cơ bản | `PORT, WEB_ORIGIN, API_BASE_URL, SCHOOL_ID, SCHOOL_NAME` |
| Database | `DATABASE_URL, DATABASE_POOL_MIN, DATABASE_POOL_MAX` |
| Quản trị khởi tạo | `BOOTSTRAP_SUPER_ADMIN_EMAILS, BOOTSTRAP_SUPER_ADMIN_DOMAINS, BOOTSTRAP_ADMIN_EMAILS` |
| Google | `GOOGLE_OAUTH_*, CLASSROOM_OAUTH_*, WORKSPACE_DOMAIN, WORKSPACE_ADMIN_SUBJECT, DWD_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY_PATH, TEACHER_OU_PREFIXES, STUDENT_OU_PREFIXES` |
| Lịch công tác tuần | `WEEKLY_SHEET_EDITOR_EMAILS` (email được sửa lịch tuần) |
| Minh chứng | `CLAMD_HOST, CLAMD_PORT, CLAMD_SOCKET` |
| Thông báo | `VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT`, `SMTP_*` |
| An toàn test | `ALLOW_DESTRUCTIVE_DATABASE_TESTS`, `ALLOW_DEV_AUTH_BYPASS` |

Web (`apps/web/.env.local`): `VITE_FIREBASE_*`, `VITE_API_BASE_URL`, `VITE_SCHOOL_ID`, `VITE_SCHOOL_NAME`, `VITE_VAPID_PUBLIC_KEY`.

## Lệnh thường dùng

| Lệnh | Chức năng |
|---|---|
| `npm run dev` | Chạy đồng thời API và Web |
| `npm run dev:api` / `npm run dev:web` | Chạy riêng từng phần |
| `npm run check` | verify + typecheck + test + build |
| `npm run typecheck` | Kiểm tra kiểu TypeScript toàn monorepo |
| `npm test` | Chạy test của API (`apps/api/scripts/run-tests.mjs`) |
| `npm run build` | Build API (`dist/`) và Web |
| `npm --workspace apps/api run db:migrate` | Chạy migration |
| `npm --workspace apps/api run db:fingerprint` | Kiểm tra dấu vân tay schema |
| `npm --workspace apps/api run seed:staging-review` | Nạp dữ liệu review cho staging |

### Test

Test của API có phần chạy với **Postgres thật** và có thể xóa dữ liệu. Chỉ chạy trên database dùng một lần có chữ `test` trong tên và đặt `ALLOW_DESTRUCTIVE_DATABASE_TESTS=true`; nếu không, `database-test-guard` sẽ chặn.

## Database & migration

- Chuỗi migration chính thức nằm ở `apps/api/drizzle/` (baseline `0000`, chốt từ schema production ngày 06/10/2026). Thay đổi schema mới phải sinh thành migration tiến (forward-only) trong thư mục này.
- Database production đã có sẵn phải qua kiểm tra fingerprint rồi "adopt" baseline (`db:adopt-baseline`), **không** chạy lại DDL baseline.
- Chi tiết: `apps/api/drizzle/README.md`, `apps/api/src/core/db/README.md`.

## Triển khai (VPS)

- API: build `npm --workspace apps/api run build`, chạy bằng pm2 theo `deploy/ecosystem.config.cjs`; nginx mẫu ở `deploy/nginx.conf.example`.
- Web: build `npm --workspace apps/web run build`, phục vụ file tĩnh qua nginx.
- Cron (đăng ký thủ công trên VPS, xem `apps/api/src/jobs/README-cron.md`):
  - `refresh-metrics` mỗi 15 phút — tổng hợp dashboard, quét cảnh báo sớm
  - `full-sync` 01:00 hàng ngày — đồng bộ Directory + Classroom
  - `check-sla-overdue` mỗi 15 phút — leo thang SLA quá hạn
  - `check-unclaimed-incidents` mỗi 15 phút — nhắc hồ sơ chưa ai tiếp nhận
- Backup: `deploy/backup-postgres.sh` (cần tự đẩy bản sao ra ngoài VPS và thử khôi phục).
- Các script `scripts/0*.ps1` và `docs/DEPLOYMENT.md` thuộc kiến trúc Cloud Run/Firestore cũ, **không còn là quy trình hiện hành**.

## Tài liệu

| File | Nội dung |
|---|---|
| [`docs/FEATURES_OVERVIEW.md`](docs/FEATURES_OVERVIEW.md) | Tổng quan chức năng, kiến trúc, bản đồ màn hình |
| [`docs/FEATURES_SAFETY.md`](docs/FEATURES_SAFETY.md) | Cảnh báo an toàn & xử lý sự cố |
| [`docs/FEATURES_WORK_SCHEDULE.md`](docs/FEATURES_WORK_SCHEDULE.md) | Lịch công tác & giao việc |
| [`docs/FEATURES_CLASSROOM.md`](docs/FEATURES_CLASSROOM.md) | Điều hành lớp học số |
| [`docs/FEATURES_ADMIN_AND_AUTH.md`](docs/FEATURES_ADMIN_AND_AUTH.md) | Đăng nhập, quản trị, cài đặt |
| [`docs/REVIEW_NOTES.md`](docs/REVIEW_NOTES.md) | Vấn đề tồn đọng, đề xuất |
| [`docs/DWD_SCOPES.md`](docs/DWD_SCOPES.md) | Scope Domain-Wide Delegation |
| [`docs/mistakes.md`](docs/mistakes.md) | Nhật ký lỗi do Claude gây ra trong quá trình làm việc, kèm cách phòng tránh |

`docs/DATA_MODEL.md`, `docs/DEPLOYMENT.md`, `docs/PROJECT_STRUCTURE.md` và `DOCS.md` mô tả kiến trúc Firestore/Cloud Run trước đây, chưa được cập nhật.

---

Trường THCS Giảng Võ — Ba Đình, Hà Nội
