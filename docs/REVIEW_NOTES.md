# Ghi chú review chức năng

> Phạm vi: đọc source nhánh `staging` (commit `3f2d01e`). **Chưa chạy app, chưa chạy test** — mọi nhận xét dưới đây suy ra từ code và comment. Chi tiết chức năng: [`FEATURES_OVERVIEW.md`](FEATURES_OVERVIEW.md).

## 1. Tài liệu hiện có đã lỗi thời

| File | Vấn đề |
|---|---|
| `README.md` | Mô tả app là nền tảng thuần Google Classroom, kiến trúc Firestore/Cloud Run, 6 tài khoản demo đăng nhập 1 click, "17 test passing", Node `>= 20.18`. Thực tế: PostgreSQL + Drizzle, Firebase Auth bắt buộc cấp quyền trước, `engines` yêu cầu Node `>=22 <25`, module chính là An toàn + Lịch công tác. Không thấy README nhắc 2 module này. |
| `docs/DATA_MODEL.md` | Mô tả cây Firestore `siSchools/{schoolId}/…`; DB thật là Postgres (~60 bảng, xem `apps/api/drizzle/0000_canonical_baseline.sql`). Không có bảng safety / `ltc_*` / identity. |
| `docs/DEPLOYMENT.md` | Quy trình Cloud Run + Firebase Hosting + Firestore rules; `jobs/README-cron.md` lại nói app chạy trên VPS với cron thủ công. Hai tài liệu mâu thuẫn về cách deploy. |
| `docs/PROJECT_STRUCTURE.md` | Chỉ liệt kê Dashboard/Classroom/Meet/Schedules; thiếu safety, work-schedule, admin, identity. |

Đề xuất: cập nhật README + DATA_MODEL + DEPLOYMENT theo hiện trạng Postgres/VPS; dùng bộ `FEATURES_*.md` này làm tài liệu chức năng.

## 2. Mã chết / chưa dùng

- `features/work-schedule/OverviewPage.tsx` và `ApprovalCenterPage.tsx`: không còn được import trong `App.tsx` (route đã redirect sang `/work-schedule/dashboard`).
- `jobs/renew-subscriptions.ts`: placeholder, **không gia hạn Google Push/Meet subscription thật** (README-cron nêu rõ, không nên đặt cron). Nghĩa là tính năng realtime Push/Meet chưa hoạt động thật dù có cấu hình `PUBSUB_*`, bảng `subscriptions`.
- Route `POST /api/work-schedule/events/:id/approve` và `evaluateEventApproval` còn trong code, nhưng luồng phê duyệt đã bị bỏ (V3). Dễ gây hiểu nhầm cho người mới; nên xóa hoặc đánh dấu rõ.
- Cài đặt có nhiều lớp cùng tồn tại (`SettingsPage` ở route `/settings`, `SettingsDialog` mở từ `AppShell`, `layout/SettingsPanel` dùng ở `Topbar` và được `SettingsContent` import lại) — đều đang được import, nhưng nên rà xem có trùng chức năng không.
- File build được commit: `*.tsbuildinfo`, `vite.config.js`, `vite.config.d.ts` trong `apps/web`.

## 3. Điểm cần cân nhắc về thiết kế

1. **Hai hệ vai trò song song** (app-level và `R.*`). Gate ở frontend (`ROLES_SAFETY_STAFF`, `nav-data.tsx`) lặp lại danh sách vai trò thủ công ở nhiều nơi (≈12 chỗ trong `nav-data.tsx`) — dễ lệch khi thêm vai trò. Quyền thật nằm ở server nên không phải lỗ hổng, nhưng người dùng có `R.*` mà app-level role là `VIEWER` có thể không thấy menu dù có quyền.
2. **Hằng số trùng lặp**: bảng `ROLE` (16 vai trò) tồn tại ở cả `modules/safety/catalog.ts` và `modules/identity/roles.ts`; comment tự nhắc "sửa cả 2 nơi".
3. **Email quản trị hard-code ở frontend**: `config/adminAccess.ts` (`admin@badinhedu.vn`) quyết định ai thấy trang chủ và nhóm "ẩn". Nếu đổi tài khoản cần sửa code; nên chuyển sang capability từ server.
4. **Quyền sửa Lịch công tác tuần** phụ thuộc biến môi trường `WEEKLY_SHEET_EDITOR_EMAILS` — không quản lý được qua giao diện `/admin`.
5. **Phân biệt "loại lịch"**: UI có nhãn `MEETING/EXAM/PROFESSIONAL`, nhưng service luôn mặc định `MEETING` (comment trong `DashboardPage.tsx` xác nhận production chỉ có `MEETING`) — các biểu đồ theo loại hầu như chỉ có một cột.
6. **Giả định chưa kiểm chứng** ghi ngay trong code `work-schedule.authz.ts`: tổ trưởng khớp theo trường `domain` (vốn dùng cho "lĩnh vực" của module An toàn), và tên giá trị `SCHOOL_WIDE` — cần chủ nghiệp vụ xác nhận.
7. **Bốn trang phân tích BETA** (Hồ sơ 360°, so sánh/phân tích môn, hoạt động GV) chỉ tái dùng API danh sách; route còn nhưng ẩn khỏi sidebar. Tên trang hứa hẹn hơn chức năng thực.
8. **Thông tin cá nhân trong comment**: nhiều comment ghi tên người ra quyết định và đường dẫn tuyệt đối máy cá nhân (VD `/Users/macbook/Projects/…` trong `catalog.ts`). Không ảnh hưởng chạy nhưng không nên để trong repo dài hạn.
9. **Biến `ALLOW_DEV_AUTH_BYPASS`**: có cảnh báo trong `env.ts`; nên có kiểm tra tự động chặn khởi động nếu `NODE_ENV=production` mà biến này bật.
10. **SMS/gọi thoại đã bỏ** khỏi bậc thang thông báo giai đoạn 1: P0 chỉ dựa vào chuông + Web Push. Cần chắc người trực luôn bật thông báo trình duyệt/PWA; nếu thiết bị tắt push thì sự cố khẩn chỉ còn chuông trong app và cron leo thang 15 phút.

## 4. Điểm mạnh

- Phân quyền An toàn tách bạch, có ma trận rõ, có test (`authz.test.ts`, `incident-lifecycle.test.ts`, các smoke test với Postgres thật).
- Thông báo tối thiểu hóa dữ liệu nhạy cảm; nhật ký kiểm toán bất biến; idempotency key cho các thao tác ghi quan trọng.
- Có guard chống chạy seed/test phá hủy nhầm database (`database-test-guard`, `staging-review-data-guard`).
- Có `canonical-schema.json` và script so sánh/fingerprint để kiểm soát lệch schema giữa các môi trường.

## 5. Việc nên làm tiếp (đề xuất, theo thứ tự)

1. Cập nhật README/DEPLOYMENT/DATA_MODEL theo hiện trạng (§1).
2. Dọn mã chết (§2) và rà lại các lớp Cài đặt trùng nhau.
3. Gom danh sách vai trò gate menu vào một nguồn duy nhất, lý tưởng lấy từ `GET /api/safety/me`/`session/me`.
4. Chuyển quyền "FermatTech admin" và "người sửa lịch tuần" sang cấu hình trong DB/UI quản trị.
5. Quyết định số phận Push/Meet realtime (hoàn thiện `renew-subscriptions` hoặc gỡ cấu hình).
6. Chạy `npm run check` (verify + typecheck + test + build) để xác nhận trạng thái thực tế — chưa thực hiện trong lần review này.
