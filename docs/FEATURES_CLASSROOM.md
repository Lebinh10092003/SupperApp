# Phân hệ Điều hành lớp học số (Google Classroom / Meet)

Code: `apps/api/src/modules/{classroom,classes,connections,catalog,people,meet,attendance,schedules,dashboard,alerts,reports,analytics,audit,data-quality}/` · `apps/web/src/features/{dashboard,today,classes,classroom,students,teachers,attendance,schedules,alerts,reports,executive,connections,catalog,audit,data-quality}/`

## 1. Vị trí của phân hệ trong app

Đây là phân hệ **ra đời đầu tiên** (README gốc mô tả toàn bộ app theo hướng này). Từ 09/2026, trọng tâm sản phẩm chuyển sang An toàn + Lịch công tác, nên:
- Trang chủ `/` ("Bảng điều hành toàn trường") **chỉ hiện với tài khoản FermatTech** (`admin@badinhedu.vn`); mọi người khác vào `/` bị chuyển sang `/safety`.
- Từ 25/09/2026 nhóm "Điều hành lớp học số" trên sidebar đã **mở lại cho mọi vai trò** (theo `roles` từng mục); các trang cấu hình nhạy cảm (kết nối, chuẩn hóa) nằm ở nhóm Quản trị hệ thống.
- 4 trang phân tích (Hồ sơ 360°, So sánh môn, Phân tích GV…) **ẩn khỏi sidebar** vì mới chỉ tái dùng API danh sách, chưa có phép tính phân tích thật (xem `REVIEW_NOTES.md`).

## 2. Nguồn dữ liệu & kết nối Google

| Thành phần | Mô tả |
|---|---|
| **Kết nối Google** (`/connections`) | OAuth (người dùng cấp quyền) hoặc **Domain-Wide Delegation** (service account) để đọc Workspace Directory + Classroom + Meet. API: `/api/connections/{status,oauth-config,oauth/url,oauth/callback,token,service-account,refresh,disconnect}` |
| **Đồng bộ** | Cron `full-sync` 01:00 hàng ngày + nút "Chạy Full Sync" (Quản trị) + `POST /api/classroom/sync`. Mỗi lần ghi 1 dòng `sync_runs` |
| **Lịch sử đồng bộ** (`/classroom/sync-runs`) | Xem từng phiên, khóa học trong phiên, **rollback an toàn** (`DELETE /sync-runs/:id`) |
| **Dữ liệu mẫu** | `purge-demo` (dọn), `seed-demo` (tạo), `reset-classroom-data` (xem trước rồi xóa sạch dữ liệu Classroom) — thao tác nguy hiểm, chỉ quản trị |
| **Chuẩn hóa** (`/catalog/mapping`) | Ánh xạ khóa học Classroom → **lớp hành chính chuẩn** (6A1…) và **môn học chuẩn** (`class_mappings`, `subject_mappings`) |
| **Khóa học bỏ qua** | Danh sách `ignored-courses` để không đồng bộ lại các khóa học không liên quan |

Chế độ dữ liệu: "zero-mock" — trang chỉ hiển thị dữ liệu thật đã đồng bộ.

## 3. Các màn hình

| Màn hình | Đường dẫn | Chức năng |
|---|---|---|
| Bảng điều hành toàn trường | `/` | KPI: số lớp, sĩ số, khóa học hoạt động, tỷ lệ hoàn thành, đúng hạn; lọc theo khối; biểu đồ nộp bài; nút đồng bộ nhanh |
| Hoạt động hôm nay | `/today` | Phiên Meet/hoạt động trong ngày (badge LIVE) |
| Lớp học & Sĩ số | `/classes` | Lớp từ Classroom + lớp tạo tay; gán GVCN; **tự phân công GV** (`auto-assign-teachers`); **chuẩn hóa danh sách** (`standardize-roster`); đồng bộ chỉ số (`sync-metrics`) |
| Khóa học bộ môn | `/classroom` | Danh sách khóa học Classroom, ánh xạ lớp/môn, xóa/bỏ qua hàng loạt |
| Đối sánh lớp 1-vs-1 | `/classes/compare` | Tab **Đối đầu** (radar 5 chiều: hoàn thành, đúng hạn, điểm TB, chuyên cần, khối lượng bài + chênh lệch + khuyến nghị) và tab **Xếp hạng toàn khối** (so với chuẩn trường). API `/classes/compare`, `/classes/duel` |
| Học sinh | `/students` | Danh sách HS, bảng điểm điện tử (ĐGTX 1–4, giữa kỳ, cuối kỳ, ĐTBm) qua `/people/students/:id/grades`, lịch sử bài tập |
| Hồ sơ 360° (BETA) | `/students/360` | Chỉ FermatTech admin; mới tái dùng API danh sách HS |
| Đội ngũ giáo viên | `/teachers` | Danh bạ GV, lớp/môn phụ trách (từ Tổ trưởng trở lên) |
| Điểm danh & chuyên cần | `/attendance` | Điểm danh tự động từ **Google Meet** (`meet_sessions`, `meet_attendance`), giới hạn theo lớp/khối GV phụ trách |
| Thời khóa biểu | `/schedules` | Xem/tạo/sửa/xóa TKB; **import** có xem trước (`/schedules/import/preview` → `/import`), gỡ import |
| Cảnh báo sớm | `/alerts` | Engine quy tắc, xem bên dưới |
| Báo cáo & xuất số liệu | `/reports` | Báo cáo tổng hợp từ `metrics_daily`, xuất số liệu |
| Executive Analytics & Heatmap | `/executive` | BI cho lãnh đạo (HT, PHT, QT hệ thống), API `/api/analytics/*` |
| Nhật ký kiểm toán Classroom | `/audit/classroom` | Sự kiện kiểm toán từ Admin SDK Reports API |
| Chất lượng dữ liệu | `/data-quality` | Phát hiện dữ liệu thiếu/lệch (lớp chưa ánh xạ, GV chưa gán…) |

## 4. Engine cảnh báo sớm

Quy tắc mặc định (chỉnh được ngưỡng/bật tắt qua `PATCH /api/alerts/rules/:id`):

| Mã | Tên | Ngưỡng | Mức |
|---|---|---|---|
| `RULE_ABSENCE_HIGH` | Nghỉ học liên tiếp | 3 buổi | HIGH |
| `RULE_SUBMISSION_LATE` | Tỷ lệ nộp bài muộn | 25 % | WARNING |
| `RULE_MEET_SHORT` | Thời lượng học Meet thấp | 50 % | WARNING |
| `RULE_INACTIVE_CLASS` | Lớp học không hoạt động | 14 ngày | CRITICAL |

Cảnh báo sinh ra có **bằng chứng** (course, số liệu) và có thể xử lý (`resolve`). Cron `refresh-metrics` (15') tổng hợp dashboard + quét cảnh báo, chỉ cần Postgres (không cần Google).

## 5. Can thiệp sư phạm (trên trang Lớp học)

Các API gửi nhắc: `POST /classes/nudge` (nhắc nộp bài), `/classes/parent-nudge` (nhắc phụ huynh), `/classes/grade-pending` (bài chờ chấm).

## 6. Phân quyền

Vai trò app-level → capability (`apps/api/src/auth/roles.ts`):

| Capability | Super/SysAdmin | School Admin / Hiệu trưởng | Phó HT | Tổ trưởng | GVCN | Giáo viên | Viewer |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| VIEW_DASHBOARD | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| VIEW_STUDENT_DATA | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| MANAGE_SCHEDULES | ✓ | ✓ | ✓ | – | – | – | – |
| RESOLVE_ALERTS | ✓ | ✓ | ✓ | ✓ | ✓ | – | – |
| MANAGE_USERS | ✓ | ✓ | ✓ (chỉ phân hiệu mình) | – | – | – | – |
| RUN_SYNC | ✓ | ✓ | ✓ | – | – | – | – |
| MANAGE_CONNECTIONS / MANAGE_CATALOG | ✓ | ✓ | – | – | – | – | – |
| VIEW_EXECUTIVE_BI | ✓ | ✓ | ✓ | ✓ | – | – | – |
| VIEW_AUDIT_LOGS | ✓ | ✓ | ✓ | – | – | – | – |
| MANAGE_INFRASTRUCTURE | ✓ (chỉ Super/SysAdmin) | – | – | – | – | – | – |

Dữ liệu học sinh còn bị giới hạn theo **phạm vi** (`UserScope`: khối, lớp, môn, khóa học) — GV chỉ thấy lớp/khối mình phụ trách.

## 7. Cấu trúc dữ liệu chính

`courses` → `course_members | course_coursework | course_submissions | course_materials | course_announcements | course_topics`; `classes`; `class_mappings`/`subject_mappings`; `meet_sessions` → `meet_attendance`; `schedules`/`schedule_imports`; `alert_rules`/`alerts`; `metrics_daily`/`dashboard_snapshot`; `sync_runs`; `google_connections`. Xem `docs/DATA_MODEL.md` (mô tả Firestore cũ) và `apps/api/drizzle/0000_canonical_baseline.sql` (Postgres hiện hành).
