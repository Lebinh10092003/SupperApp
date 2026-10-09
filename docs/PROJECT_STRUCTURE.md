# Cấu trúc theo chức năng

Quy tắc: UI chức năng ở `apps/web/src/features/<feature>`, logic nghiệp vụ và route ở `apps/api/src/modules/<feature>`. `server.ts` chỉ ghép router; toàn bộ route frontend khai báo ở `apps/web/src/app/App.tsx`, menu ở `apps/web/src/layout/nav-data.tsx`.

## Phân hệ → thư mục

```text
Cảnh báo an toàn & xử lý sự cố
├─ Web: features/safety/        (trang, dialogs/, components/, hooks/)
├─ API: modules/safety/         (≈68 file: routes, authz, SLA, lifecycle, notify, evidence…)
└─ Cron: jobs/check-sla-overdue.ts, jobs/check-unclaimed-incidents.ts

Lịch công tác & giao việc
├─ Web: features/work-schedule/ (trang, components/, hooks/)
└─ API: modules/work-schedule/  (events/tasks, weekly-sheet, exam-schedule, ics, import)

Định danh & phân quyền (dùng chung)
├─ Web: auth/, features/login/, features/admin/, features/contacts/, features/settings/
└─ API: auth/, modules/session/, modules/admin/, modules/identity/

Điều hành lớp học số
├─ Dashboard / Hôm nay    : features/dashboard, features/today          ↔ modules/dashboard
├─ Lớp, khóa học, đồng bộ : features/classes, classroom, connections,   ↔ modules/classes, classroom,
│                           catalog                                       connections, catalog
├─ Học sinh, giáo viên    : features/people, students, teachers          ↔ modules/people, directory
├─ Meet, điểm danh, TKB   : features/meet, attendance, schedules         ↔ modules/meet, attendance, schedules
├─ Cảnh báo sớm, báo cáo  : features/alerts, reports, executive          ↔ modules/alerts, reports, analytics
└─ Kiểm toán, chất lượng  : features/audit, data-quality, system         ↔ modules/audit, data-quality, system, health
```

## Cây thư mục

```text
SupperApp/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ server.ts            ghép router, CORS, error handler
│  │  │  ├─ auth/                firebaseAuth, requireCapability, roles, scope
│  │  │  ├─ core/                db (pool, client), firebase, http, ids, lưu minh chứng
│  │  │  ├─ config/env.ts        đọc và kiểm tra biến môi trường (zod)
│  │  │  ├─ integrations/        DWD, secrets
│  │  │  ├─ modules/<feature>/   *.routes.ts, *.schema.ts (Drizzle), *.service.ts, test
│  │  │  └─ jobs/                script cron chạy bằng node
│  │  ├─ drizzle/                migration chính thức (baseline 0000)
│  │  ├─ drizzle-legacy/         migration cũ, không dùng
│  │  ├─ schema/                 canonical-schema.json
│  │  └─ scripts/                migrate, seed, import nhân sự, guard, fingerprint
│  └─ web/
│     └─ src/
│        ├─ app/App.tsx          bảng route + gate vai trò (chỉ gợi ý)
│        ├─ features/<feature>/  trang và component theo chức năng
│        ├─ layout/              AppShell, Sidebar, Topbar, CommandPalette, banner khẩn
│        ├─ components/ui/       shadcn/ui
│        ├─ auth/                AuthProvider, ProtectedRoute, RoleRoute
│        ├─ services/api.ts      wrapper gọi API
│        └─ theme/               sáng/tối
├─ deploy/                       pm2, nginx mẫu, backup Postgres
├─ scripts/                      dev.mjs, verify-source.mjs; 0*.ps1 là script GCP cũ
├─ docs/                         tài liệu (xem README.md)
├─ reference/                    tài liệu phân tích thiết kế gốc
├─ firestore/, firebase.json     cấu hình Firebase/Firestore cũ
└─ README.md, DOCS.md
```

## Quy ước thêm chức năng mới

1. API: tạo `modules/<feature>/` gồm `*.schema.ts` (bảng Drizzle), `*.routes.ts`, service; đăng ký router trong `server.ts`.
2. Sinh migration mới trong `apps/api/drizzle/` (forward-only), cập nhật manifest schema.
3. Web: tạo `features/<feature>/`, thêm route vào `app/App.tsx` và mục menu vào `layout/nav-data.tsx`.
4. Phân quyền: gate ở frontend chỉ để ẩn/hiện; luôn kiểm tra quyền thật ở server (`requireCapability` hoặc authz của module).
5. Ghi quyết định nghiệp vụ quan trọng vào comment tại chỗ code áp dụng kèm ngày chốt, theo thông lệ hiện có.
