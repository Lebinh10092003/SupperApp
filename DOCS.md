# Tài liệu kỹ thuật: tích hợp Google Workspace & phân hệ Lớp học số

> Tài liệu này chỉ nói về **phân hệ Điều hành lớp học số** và phần **tích hợp Google** (Directory, Classroom, Meet) của SuperApp THCS Giảng Võ. Phần còn lại của app:
> - Tổng quan, cách chạy, cấu hình: [`README.md`](README.md)
> - Chức năng từng phân hệ: [`docs/FEATURES_OVERVIEW.md`](docs/FEATURES_OVERVIEW.md) và các file `docs/FEATURES_*.md`
> - Dữ liệu, triển khai, cấu trúc: [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), [`docs/PROJECT_STRUCTURE.md`](docs/PROJECT_STRUCTURE.md)
>
> Bản trước của file này là "sách trắng" cho kiến trúc Firestore/Cloud Run. Các mục mô tả chức năng chưa được hiện thực đã được bỏ hoặc ghi rõ ở §7.

## 1. Dữ liệu Google cung cấp được và không cung cấp được

Nguyên tắc: **chỉ hiển thị dữ liệu thật đã đồng bộ**, không tự suy diễn dữ liệu Google không cung cấp.

| Thực thể | Nguồn | Hiện trạng trong app |
|---|---|---|
| Khóa học | Classroom `courses.list` | Đồng bộ vào `courses` |
| Giáo viên, học sinh | Classroom `teachers/students.list`; Directory API | `course_members`, `people` |
| Bài tập | `courseWork.list` | `course_coursework` |
| Bài nộp (đúng hạn, muộn, đã chấm) | `studentSubmissions.list` | `course_submissions` |
| Tài liệu, thông báo, chủ đề | `courseWorkMaterials`, `announcements`, `topics` | `course_materials`, `course_announcements`, `course_topics` |
| Phiên Meet, thời lượng tham gia | Meet REST API v2 (`meetings.space.readonly`) | `meet_sessions`, `meet_attendance` |
| Thời gian đọc bài, clickstream | Google không cung cấp | Không có |
| Tâm lý, cảm xúc học sinh | Không suy đoán | Không có |

## 2. Hai chế độ kết nối

Quản lý ở trang `/connections` (Hiệu trưởng trở lên). Mã: `modules/connections/`, `integrations/dwd.ts`.

### Chế độ A: OAuth người dùng
- Quản trị mở `/connections`, bấm kết nối, đăng nhập Google và cấp quyền (`/oauth/url` → `/oauth/callback`).
- Scope: `classroom.courses.readonly`, `classroom.rosters.readonly`, `classroom.profile.emails`, `classroom.coursework.students.readonly`, `classroom.announcements.readonly`, `classroom.topics.readonly`, `classroom.courseworkmaterials.readonly` (+ `openid`, `userinfo.email`, `userinfo.profile`).
- Token lưu ở bảng `google_connections`; làm mới qua `POST /api/connections/refresh`. Có thể nhập token thủ công qua `/token`.
- Chỉ thấy các lớp mà tài khoản kết nối có quyền xem.

### Chế độ B: Domain-Wide Delegation (khuyến nghị cho toàn trường)
- Dùng Service Account có DWD, đóng vai (`subject`) quản trị Workspace (`WORKSPACE_ADMIN_SUBJECT`) để đọc toàn bộ Directory, Classroom, Meet.
- `dwdToken(subject, scopes)` ký JWT cục bộ khi có file service account (`GOOGLE_SERVICE_ACCOUNT_KEY_PATH`), hoặc dùng IAM `signJwt` khi chạy trên môi trường có ADC. Token được cache gần 1 giờ.
- Scope DWD cần cấp ở Admin Console (danh sách đầy đủ: [`docs/DWD_SCOPES.md`](docs/DWD_SCOPES.md)):
  ```text
  admin.directory.user.readonly
  classroom.courses.readonly, classroom.rosters.readonly, classroom.profile.emails
  classroom.coursework.students.readonly, classroom.announcements.readonly
  classroom.topics.readonly, classroom.courseworkmaterials.readonly
  meetings.space.readonly
  ```
- Tải service account: `/api/connections/service-account`.

### Thiết lập trên Google (một lần)
1. Google Cloud Console: tạo project, bật **Classroom API, Admin SDK, Google Meet API** (thêm Secret Manager / Pub/Sub nếu dùng Push).
2. Chế độ A: tạo OAuth Client ID (Web). Redirect URI: `https://<domain>/api/connections/oauth/callback` (và bản localhost khi dev). Điền `GOOGLE_OAUTH_CLIENT_ID/SECRET/REDIRECT_URI`.
3. Chế độ B: tạo Service Account, tải khóa JSON, lấy **Client ID** của service account.
4. Admin Console (`admin.google.com`) → Security → API controls → **Manage Domain-Wide Delegation** → thêm Client ID cùng danh sách scope ở trên.
5. Điền `WORKSPACE_DOMAIN`, `WORKSPACE_ADMIN_SUBJECT`, `DWD_SERVICE_ACCOUNT_EMAIL`, `TEACHER_OU_PREFIXES`, `STUDENT_OU_PREFIXES` trong `apps/api/.env`.
6. Đừng commit file service account. Đặt ngoài git (VD `/opt/supperapp/secrets/`).

Token chỉ được lưu và dùng ở backend; frontend không bao giờ nhận access/refresh token.

## 3. Đồng bộ dữ liệu

| Cách chạy | Chi tiết |
|---|---|
| Tự động | Cron `full-sync` lúc 01:00: Directory + Classroom |
| Thủ công | `POST /api/admin/full-sync` (nút trong `/admin`), `POST /api/classroom/sync` |
| Theo dõi | Bảng `sync_runs`, trang `/classroom/sync-runs` (xem phiên, khóa học trong phiên, rollback) |
| Độ bền | `fetchWithRetry` thử lại tối đa 3 lần với exponential backoff khi gặp lỗi 429/503 |

Trạng thái dữ liệu tổng hợp: số liệu `courses.*` (`submissions_total`, `completion_rate`, `on_time_rate`, `average_score`…) được tính lúc đồng bộ. Cron `refresh-metrics` (15 phút) dựng `dashboard_snapshot`, `metrics_daily` và chạy engine cảnh báo.

## 4. Chuẩn hóa tên lớp và môn

Tên khóa học Classroom do giáo viên tự đặt ("Toán Thầy Nam 6A1", "6A1 - Đại số"). `modules/catalog/catalog.service.ts` dùng **regex nhận diện lớp** (`6A1`, "lớp 8A2"…) và từ khóa môn để **gợi ý** ánh xạ; quản trị duyệt ở `/catalog/mapping` (`class_mappings`, `subject_mappings`, trường `confirmed`). Số liệu theo lớp/môn chỉ đáng tin sau khi đã xác nhận ánh xạ.

Trang `/data-quality` liệt kê dữ liệu thiếu hoặc chưa ánh xạ.

## 5. Số liệu và phân tích có trong app

| Chức năng | Đã làm | Ghi chú |
|---|---|---|
| Bảng điều hành (`/`) | KPI toàn trường, lọc theo khối, Executive Heatmap lớp × môn | `analytics/overview`, chỉ FermatTech admin thấy trang này mặc định |
| Đối sánh lớp 1-vs-1 và xếp hạng khối | Radar, chênh lệch, khuyến nghị | `/classes/compare`, `/classes/duel` |
| Điểm danh từ Meet | Gộp khoảng thời gian tham gia (`mergeIntervals`), tính có mặt/muộn/vắng theo thời khóa biểu | `modules/meet`, `modules/attendance` |
| Cảnh báo sớm | 4 quy tắc mặc định, chỉnh ngưỡng được | `modules/alerts`, xem `docs/FEATURES_CLASSROOM.md` §4 |
| Báo cáo, xuất số liệu | Từ `metrics_daily` | `/reports` |
| Bảng điểm học sinh | `/people/students/:id/grades` | |

## 6. Phân quyền

Vai trò cấp ứng dụng (`apps/api/src/auth/roles.ts`) quy ra capability; bảng đầy đủ ở `docs/FEATURES_CLASSROOM.md` §6. Khác với tài liệu cũ:
- Tập vai trò hiện có thêm `SYSTEM_ADMIN` và `HOMEROOM`.
- Phó Hiệu trưởng có `MANAGE_USERS` nhưng chỉ trong phân hiệu mình phụ trách.
- `UserScope` (khối, lớp, môn, khóa học) giới hạn dữ liệu học sinh theo giáo viên.
- Bootstrap quản trị đầu tiên: `BOOTSTRAP_SUPER_ADMIN_EMAILS`, `BOOTSTRAP_SUPER_ADMIN_DOMAINS`, `BOOTSTRAP_ADMIN_EMAILS`. Email chưa được cấp quyền không đăng nhập được.

## 7. Mô tả trong bản cũ nhưng chưa có trong code

Đã đối chiếu code ở nhánh `staging`. Các mục dưới đây không còn được mô tả như tính năng sẵn có:

| Mục | Tình trạng |
|---|---|
| Student Learning Health Score (công thức trọng số) | Chưa có phép tính. Trang `/students/360` (BETA) chỉ tái dùng danh sách học sinh |
| Drill-down 6 cấp, so sánh WoW/MoM | Chưa thấy trong code |
| Kiểm toán Classroom qua Admin SDK Reports API | Chưa tích hợp. Trang `/audit/classroom` hiển thị `general_audit_logs` (nhật ký thao tác trong app, 100 dòng gần nhất) |
| Trạng thái `LIMITED_ACCESS` khi thiếu quyền | Không tìm thấy trong code |
| Chế độ Demo trong trình duyệt | Không còn. Dữ liệu mẫu chỉ qua `seed-demo`/`purge-demo` ở `/connections` (quản trị) |
| Push realtime Classroom/Meet | Có cấu hình và bảng `subscriptions` nhưng `renew-subscriptions` chỉ là placeholder |
| Cảnh báo "N bài liên tiếp chưa nộp", "điểm giảm Y%", "bài chưa chấm dồn ứ" | Chưa có trong 4 quy tắc mặc định |
| Phân tích môn học, hoạt động giáo viên | Route còn nhưng ẩn khỏi menu, chưa có phép tính riêng |

## 8. Sự cố thường gặp

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| `invalid_grant` khi đồng bộ (chế độ A) | Refresh token hết hạn (app OAuth ở chế độ Testing hết sau 7 ngày) hoặc đổi mật khẩu | Kết nối lại ở `/connections` |
| DWD báo thiếu quyền / 403 | Scope chưa được cấp trong Admin Console hoặc sai `WORKSPACE_ADMIN_SUBJECT` | Đối chiếu `docs/DWD_SCOPES.md` |
| Lớp hiện nhưng chưa có lớp/môn chuẩn | Chưa duyệt ánh xạ | `/catalog/mapping` |
| Quá hạn mức Google API | Trường nhiều lớp, đồng bộ lần đầu | Có retry/backoff; chạy full sync ngoài giờ cao điểm (cron 01:00) |
| Đồng bộ lỗi / dữ liệu sai | | Xem `sync_runs`, rollback ở `/classroom/sync-runs` |
| Ô điểm hiển thị "Chưa có" | Giáo viên chưa chấm hoặc Classroom chưa có điểm | Đúng thiết kế: app không điền số giả |
| Cổng 8080 bị chiếm khi dev | Tiến trình API cũ | `netstat -ano \| findstr :8080` rồi `taskkill /PID <PID> /F` |

---

Múi giờ vận hành: `Asia/Ho_Chi_Minh` (GMT+7). Ngôn ngữ giao diện: tiếng Việt.
