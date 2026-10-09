# Tổng quan chức năng — SuperApp THCS Giảng Võ

> Tài liệu review chức năng, lập từ source code nhánh `staging` (10/2026).
> Các tài liệu chi tiết: [`FEATURES_SAFETY.md`](FEATURES_SAFETY.md) · [`FEATURES_WORK_SCHEDULE.md`](FEATURES_WORK_SCHEDULE.md) · [`FEATURES_CLASSROOM.md`](FEATURES_CLASSROOM.md) · [`FEATURES_ADMIN_AND_AUTH.md`](FEATURES_ADMIN_AND_AUTH.md) · [`REVIEW_NOTES.md`](REVIEW_NOTES.md)

## 1. App là gì?

SuperApp là ứng dụng web nội bộ của **Trường THCS Giảng Võ (Ba Đình, Hà Nội)**, gồm 3 mảng nghiệp vụ trên cùng một hệ thống đăng nhập, danh bạ người dùng và phân quyền:

| # | Phân hệ | Mục đích | Mức độ hoàn thiện (theo code) |
|---|---------|----------|-------------------------------|
| 1 | **Cảnh báo an toàn & xử lý sự cố** (`/safety`) | Tiếp nhận tin báo sự cố (công khai, không cần đăng nhập), tạo hồ sơ, giao chỉ huy, theo dõi SLA, leo thang, đóng hồ sơ | Là module chính, đầy đủ nhất |
| 2 | **Lịch công tác & Giao việc** (`/work-schedule`) | Lịch họp/sự kiện theo cơ sở hoặc toàn trường, giao việc nhỏ, lịch trông thi, bảng lịch tuần, nhắc nhở | Đầy đủ, đang phát triển tích cực |
| 3 | **Điều hành lớp học số** (Google Classroom, Meet) | Đồng bộ lớp/khóa học/học sinh/giáo viên từ Google Workspace, điểm danh, thời khóa biểu, báo cáo, cảnh báo sớm | Có đầy đủ trang nhưng **mới chỉ FermatTech admin thấy mặc định ở trang chủ**; một số trang phân tích (Hồ sơ 360°, so sánh môn…) mới ở mức "xem trước" |
| 4 | **Quản trị hệ thống** | Quản lý tài khoản, phân quyền, danh bạ, kết nối Google, chất lượng dữ liệu, tình trạng hệ thống | Đầy đủ |

> Lưu ý: `README.md` ở thư mục gốc mô tả app như một nền tảng *thuần Google Classroom* (kiến trúc Firestore/Cloud Run, demo 6 vai trò). **Mô tả đó đã lỗi thời** — hiện app dùng PostgreSQL + Drizzle ORM, đăng nhập Firebase Auth, và trọng tâm là 2 module An toàn + Lịch công tác. Xem [`REVIEW_NOTES.md`](REVIEW_NOTES.md).

## 2. Kiến trúc tóm tắt

```
apps/
├─ web/   React 19 + Vite 6 + React Router 7 + Tailwind 4 + shadcn/ui + Recharts
│         features/<tên>/  → mỗi trang/chức năng
└─ api/   Express 5 + TypeScript + Drizzle ORM (PostgreSQL, driver pg)
          modules/<tên>/   → routes + schema + service từng chức năng
          jobs/            → script cron (refresh-metrics, full-sync, check-sla-overdue, check-unclaimed-incidents)
```

- **Xác thực**: Firebase Auth (email/mật khẩu hoặc Google) → backend xác minh ID token (`firebase-admin`) rồi `POST /api/session/bootstrap` để tạo/đối chiếu hồ sơ người dùng.
- **Dữ liệu**: PostgreSQL, ~60 bảng (xem `apps/api/drizzle/0000_canonical_baseline.sql`). Nhóm bảng: `safety` (incidents, reports, evidence, sla_clocks, notify_requests…), `ltc_*` (Lịch công tác), classroom (courses, course_*…), identity (people, accounts, assignments, homeroom_assignments…), hệ thống (users, access_allowlist, sync_runs…).
- **Thông báo**: chuông trong app (`in_app`), Web Push (VAPID), email (SMTP). SMS/gọi thoại đã **chủ động bỏ** ở giai đoạn 1.
- **Lưu minh chứng**: ảnh/âm thanh/video tải lên, quét virus qua ClamAV (`CLAMD_*`) khi cấu hình.
- **PWA**: có `manifest.json` + `sw.js` (nhận Web Push).
- **Cron** (VPS): `refresh-metrics` 15', `full-sync` 01:00, `check-sla-overdue` 15', `check-unclaimed-incidents` 15'. Xem `apps/api/src/jobs/README-cron.md`.

## 3. Bản đồ màn hình (sidebar)

Thứ tự nhóm trên sidebar: **Cảnh báo an toàn → Lịch công tác → Điều hành lớp học số → Quản trị hệ thống → Tổng quan → Phân tích & báo cáo**.

### Nhóm CẢNH BÁO AN TOÀN VÀ XỬ LÝ SỰ CỐ
| Đường dẫn | Màn hình | Ai thấy (gate giao diện) |
|---|---|---|
| `/safety/report` | Gửi tin báo sự cố (công khai) | Mọi người, không đăng nhập |
| `/safety/lookup` | Tra cứu tin báo bằng mã công khai (công khai) | Mọi người, không đăng nhập |
| `/safety` | Tổng quan An toàn | Nhân sự (xem bảng role ở §4) |
| `/safety/cases` | Sự vụ (danh sách + lọc) | Nhân sự |
| `/safety/incidents/:id` | Hồ sơ sự cố chi tiết | Nhân sự |
| `/safety/cockpit` | "Cần xử lý ngay" (P0/P1) | Nhân sự |
| `/safety/audit-logs` | Nhật ký kiểm toán | Từ Tổ trưởng trở lên |
| `/safety/analytics` | Phân tích & thống kê | Từ Tổ trưởng trở lên |

### Nhóm LỊCH CÔNG TÁC
| Đường dẫn | Màn hình |
|---|---|
| `/work-schedule/dashboard` | Tổng quan (KPI lịch & việc) |
| `/work-schedule` | Lịch công tác (danh sách/tuần/tháng/bảng tuần) |
| `/work-schedule/tasks` | Giao việc |
| `/work-schedule/exam-schedule` | Lịch trông thi |
| `/work-schedule/reminders` | Nhắc nhở |

### Nhóm ĐIỀU HÀNH LỚP HỌC SỐ
`/classes` (Lớp học & sĩ số) · `/classroom` (Khóa học bộ môn) · `/classes/compare` (Đối sánh 1-vs-1) · `/students` (Học sinh & hồ sơ) · `/students/360` (BETA, chỉ FermatTech admin) · `/teachers` · `/attendance` · `/schedules` (Thời khóa biểu) · `/classroom/sync-runs`.

### Nhóm TỔNG QUAN / PHÂN TÍCH & BÁO CÁO
`/` (Bảng điều hành toàn trường — chỉ FermatTech admin, người khác bị chuyển sang `/safety`) · `/today` (Hoạt động hôm nay, LIVE) · `/alerts` (Cảnh báo sớm) · `/executive` (BI & Heatmap) · `/reports` (Báo cáo & xuất số liệu).

### Nhóm QUẢN TRỊ HỆ THỐNG
`/admin` (Phân quyền) · `/connections` (Kết nối Google) · `/catalog/mapping` (Chuẩn hóa dữ liệu) · `/audit/classroom` · `/data-quality` · `/system`.

### Khác
`/login` · `/settings` (modal Cài đặt: Giao diện, Sổ danh bạ) · Command Palette (tìm nhanh trang) · chuông thông báo · banner sự cố khẩn.

## 4. Hai hệ vai trò (điểm dễ nhầm)

App có **hai hệ vai trò tách biệt hoàn toàn**:

1. **Vai trò cấp ứng dụng (app-level)** — dùng để ẩn/hiện menu và route, và gate API cơ bản (`apps/api/src/auth/roles.ts`):
   `SYSTEM_SUPER_ADMIN, SYSTEM_ADMIN, SCHOOL_ADMIN, PRINCIPAL, VICE_PRINCIPAL, DEPARTMENT_HEAD, HOMEROOM, TEACHER, DATA_VIEWER/VIEWER`.
2. **Vai trò nghiệp vụ `R.*` (16 vai trò)** — hệ phân quyền *thật* của module An toàn và Lịch công tác, gán theo cơ sở (campus) và lĩnh vực (`assignments`): Hiệu trưởng, Phó HT, Trực ban, Tổ trưởng, Văn phòng, Giáo viên, GVCN, Y tế, Tư vấn tâm lý, Bảo vệ, CSVC, Chỉ huy sự cố, Quản trị HT, Kiểm toán, Bên ngoài, Người báo tin.

Gate ở frontend (`ROLES_SAFETY_STAFF`…) **chỉ mang tính gợi ý** (ẩn/hiện nav); quyền thật luôn được kiểm tra ở server.

## 5. Ba cơ sở (campus)

Dùng chung toàn app: `MAIN_CAMPUS` (Điểm trường chính), `CAMPUS_1`, `CAMPUS_2`. Phó Hiệu trưởng chỉ có quyền trong cơ sở mình phụ trách; Hiệu trưởng có quyền mọi cơ sở.
