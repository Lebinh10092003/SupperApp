# Phân hệ Lịch công tác & Giao việc

Code: `apps/api/src/modules/work-schedule/` · `apps/web/src/features/work-schedule/`
Bảng DB: `ltc_events`, `ltc_tasks`, `ltc_exam_shifts`, `ltc_weekly_sheet_rows`, `ltc_weekly_sheet_connection`, `ltc_audit_logs`

## 1. Mục tiêu

Quản lý **lịch họp/sự kiện/công tác** của giáo viên, tổ chuyên môn, Ban giám hiệu theo **cơ sở** hoặc **toàn trường**; **giao việc** (có việc lớn – việc nhỏ); **lịch trông thi**; bảng **lịch công tác tuần**; và các màn nhắc việc.

## 2. Năm màn hình

| Màn hình | Đường dẫn | Chức năng |
|---|---|---|
| **Tổng quan** | `/work-schedule/dashboard` | KPI lịch & việc, phân bố theo loại (Lịch họp / Lịch kiểm tra / Công việc chuyên môn), việc quá hạn, lịch hôm nay |
| **Lịch công tác** | `/work-schedule` | Lịch dạng **danh sách / tuần / tháng / bảng tuần**; tạo/sửa/hủy/khôi phục lịch; lọc theo cơ sở, người tham gia; công tắc "hiện lịch toàn trường"; xem lịch đã hủy; Import |
| **Giao việc** | `/work-schedule/tasks` | Tạo việc, người phụ trách + người phối hợp, hạn, việc nhỏ, đánh dấu hoàn thành |
| **Lịch trông thi** | `/work-schedule/exam-schedule` | Danh sách ca thi theo ngày/buổi/môn/phòng/giám thị; import; chỉ lãnh đạo sửa |
| **Nhắc nhở** | `/work-schedule/reminders` | "Cần bạn xử lý" (lịch nháp, bị yêu cầu sửa, đang chờ duyệt, việc mới chưa nhận…), "Lịch trùng", "Công việc quá hạn" — tính ở client từ `useEvents`/`useTasks` |

Hai route cũ `/work-schedule/overview` và `/work-schedule/approvals` đã chuyển hướng về `/work-schedule/dashboard` (Trung tâm phê duyệt không còn dùng — xem §4).

## 3. Lịch công tác (Event)

**Trường dữ liệu chính**: tiêu đề, mô tả, loại (hiện chủ yếu `MEETING`; UI còn nhãn `EXAM`, `PROFESSIONAL`), mức ưu tiên, **cơ sở**, **phạm vi** (`CAMPUS` = trong cơ sở / `SCHOOL_WIDE` = toàn trường), giờ bắt đầu, giờ kết thúc *(không bắt buộc từ 05/10/2026)*, địa điểm, **người chủ trì**, **thành phần tham dự**, trạng thái.

**Trạng thái**: `DRAFT` (Dự thảo) · `PENDING_APPROVAL` (Chờ duyệt) · `PUBLISHED` (Đã ban hành) · `REVISION_REQUIRED` (Cần sửa lại) · `CANCELLED` (Đã hủy). Có thể khôi phục lịch đã hủy về `PUBLISHED`.

**Quy tắc quyền (V3 – thay luồng phê duyệt cũ)**
- Người dùng tạo/sửa **lịch của chính mình**.
- **Lịch toàn trường** (`SCHOOL_WIDE`): chỉ Hiệu trưởng / Phó HT được tạo và sửa; người khác chỉ xem (Sin, 29/09/2026).
- **Tạo/sửa lịch thay người khác** và quản lý lịch trường: Hiệu trưởng, Phó HT, **Văn phòng** (`canManageSchoolCalendar`). Quản trị hệ thống *không* mặc nhiên có quyền nghiệp vụ.
- Module đã **bỏ bước duyệt** khi tạo (code `evaluateEventApproval` vẫn còn nhưng route `/events/:id/approve` không còn là luồng chính). Quy tắc duyệt còn tồn tại trong code để tham chiếu: lịch cơ sở – Tổ trưởng cùng tổ, Phó HT cùng cơ sở hoặc Hiệu trưởng; lịch toàn trường – Hiệu trưởng hoặc Phó HT điểm trường chính, **một bước là đủ** (05/10/2026).

**Tiện ích**
- **Dò trùng lịch** (`findOverlappingPartners`): cảnh báo khi cùng người tham gia bị trùng khung giờ (bỏ qua lịch không có giờ kết thúc).
- **Lịch sử thay đổi** (`ltc_audit_logs`) hiển thị ở phần "Lịch sử" trong chi tiết lịch (`AuditTrailPanel`).
- **Ngày lễ**: `GET /holidays`.
- **Xuất lịch `.ics`**: `GET /calendar.ics` — đăng ký vào Google Calendar/Outlook.
- **Import lịch** từ file/Google Sheet (`POST /imports/preview` rồi `/imports/apply`) — có xem trước trước khi áp dụng (`WorkScheduleImportDialogV4`).
- Hiển thị người luôn kèm **tên + chức vụ** (không hiện mã `PER_xxx`).

## 4. Giao việc (Task)

- **Trường**: tiêu đề, mô tả, ưu tiên, cơ sở, **người phụ trách** (`assignee`), **người phối hợp**, địa điểm, **ngày bắt đầu (tuỳ chọn)**, **hạn hoàn thành**, liên kết lịch (`eventId`, tuỳ chọn), minh chứng.
- **Việc lớn – việc nhỏ**: quan hệ Task→Task, **chỉ 2 cấp**; mỗi việc nhỏ có người phụ trách riêng; xoá việc lớn thì xoá cả việc nhỏ.
- **Trạng thái chỉ còn 2** (05/10/2026, theo `huong_dan_lich_cong_tac_giao_viec.md` §12.4): `ASSIGNED` (Đã giao) → `COMPLETED` (Đã hoàn thành). Luồng nhận–nghiệm thu–trả lại cũ đã bỏ; dữ liệu cũ đã được chuyển về `ASSIGNED`.
- Tạo việc ngay từ chi tiết một lịch (khối "Giao việc" trong dialog lịch).

## 5. Lịch công tác tuần (bảng tuần)

- Dạng **bảng** theo tuần (`WeeklyTableView`), tách khỏi `ltc_events`.
- **Ai xem**: mọi tài khoản đã đăng nhập. **Ai sửa**: chỉ email nằm trong biến môi trường `WEEKLY_SHEET_EDITOR_EMAILS`.
- Thao tác: thêm/sửa/xoá dòng, **sao chép tuần**, **nhập từ Google Sheet** (`import-google-sheet`), lưu/xoá **kết nối sheet** (`sheet-connection`) để lần sau chỉ bấm đồng bộ.

## 6. Lịch trông thi

- Mỗi **ca thi** (`ltc_exam_shifts`): ngày thi, buổi, tiết, giờ, môn, phòng, cơ sở… (xem `exam-schedule.schema.ts`).
- Chức năng: xem/lọc theo ngày–cơ sở–từ khoá, **tạo ca thi** (dialog), **import hàng loạt** (`ExamImportDialog`), sửa, xoá. Chỉ lãnh đạo (`isLeadership`) được sửa; mọi thay đổi ghi nhật ký (`entityType = exam_shift`).

## 7. Tổng quan (Dashboard)

`GET /dashboard-summary` trả về số liệu cho trang Tổng quan: số lịch theo trạng thái/loại, lịch sắp tới, việc quá hạn/đang giao. Trang có bản "Overview" cũ (`OverviewPage.tsx`) không còn gắn route.

## 8. Điểm cần nhớ khi vận hành

- Thành phần tham dự & phụ trách lấy từ **danh bạ người** (`people`) và **sổ danh bạ nhóm** (Cài đặt → Quản lý sổ danh bạ).
- Giờ hiển thị theo định dạng **Ngày trước – Giờ sau** (riêng module này).
- Nhiều comment trong code ghi các giả định "chưa kiểm chứng với Mr Tiến" (VD tổ trưởng ↔ trường `domain`, tên giá trị `SCHOOL_WIDE`) — xem [`REVIEW_NOTES.md`](REVIEW_NOTES.md).
