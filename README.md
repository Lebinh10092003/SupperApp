# THCS Giảng Võ — School Classroom Intelligence Platform
### Hệ Thống Quản Trị Lớp Học Số Dành Cho Hiệu Trưởng & Ban Giám Hiệu

Hệ thống điều hành thông minh, tự động chuyển hóa toàn bộ dữ liệu từ **Google Classroom**, **Google Meet** và **Google Workspace for Education** thành hệ thống quản trị, so sánh, cảnh báo sớm và hỗ trợ ra quyết định chiến lược cho Ban Giám hiệu nhà trường.

Hệ thống được thiết kế theo tiêu chuẩn phần mềm quy mô lớn (Enterprise-grade), có khả năng triển khai thực tế ngay lập tức, hỗ trợ multi-tenant, bảo mật nghiêm ngặt và không sử dụng dữ liệu giả lập trong môi trường Production.

---

## MỤC LỤC
- [⚡ Bảng Tra Cứu Nhanh Các Câu Lệnh Chạy Dự Án (Quick Cheat Sheet)](#-bảng-tra-cứu-nhanh-các-câu-lệnh-chạy-dự-án-quick-cheat-sheet)
1. [Ma Trận Khả Năng Cung Cấp Dữ Liệu Của Google API](#1-ma-trận-khả-năng-cung-cấp-dữ-liệu-của-google-api)
2. [Kiến Trúc Tổng Thể Hệ Thống](#2-kiến-trúc-tổng-thể-hệ-thống)
3. [Phân Quyền RBAC & Quản Trị Tài Khoản](#3-phân-quyền-rbac--quản-trị-tài-khoản)
4. [Hai Chế Độ Kết Nối Google Classroom](#4-hai-chế-độ-kết-nối-google-classroom)
5. [Chuẩn Hóa Dữ Liệu Trường Học](#5-chuẩn-hóa-dữ-liệu-trường-học)
6. [Bộ Phân Hệ Điều Hành Của Ban Giám Hiệu](#6-bộ-phân-hệ-điều-hành-của-ban-giám-hiệu)
7. [Hướng Dẫn Cấu Hình Google Cloud Console & Workspace Admin](#7-hướng-dẫn-cấu-hình-google-cloud-console--workspace-admin)
8. [Hướng Dẫn Cài Đặt & Các Câu Lệnh Chạy Dự Án Chi Tiết](#8-hướng-dẫn-cài-đặt--các-câu-lệnh-chạy-dự-án-chi-tiết)
9. [Hướng Dẫn Triển Khai Production (Firebase & Cloud Run)](#9-hướng-dẫn-triển-khai-production-firebase--cloud-run)
10. [Xử Lý Sự Cố & Câu Hỏi Thường Gặp (Troubleshooting)](#10-xử-lý-sự-cố--câu-hỏi-thường-gặp-troubleshooting)

---

## ⚡ BẢNG TRA CỨU NHANH CÁC CÂU LỆNH CHẠY DỰ ÁN (QUICK CHEAT SHEET)

Dành cho lập trình viên và quản trị viên cần khởi chạy nhanh dự án mà không cần đọc hết tài liệu:

### 🚀 Khởi Chạy Nhanh Bằng 1 Câu Lệnh (Quick Start)
```powershell
# Bước 1: Cài đặt tất cả dependencies
npm install

# Bước 2: Chuẩn bị file môi trường từ các file mẫu
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Bước 3: Khởi chạy TOÀN BỘ HỆ THỐNG bằng 1 CÂU LỆNH DUY NHẤT (cả Web & API)
npm run dev
```

> **Sau khi chạy lệnh trên:**
> - 🌐 **Frontend Web**: [http://localhost:5173](http://localhost:5173) (Giao diện Quản trị Ban Giám hiệu)
> - 🔌 **Backend API**: [http://localhost:8080](http://localhost:8080) (Kiểm tra sức khỏe: [http://localhost:8080/health](http://localhost:8080/health))
> - *(Tùy chọn) Nếu muốn chạy riêng ở 2 cửa sổ terminal độc lập: `npm run dev:api` và `npm run dev:web`.*

### 📋 Bảng Tra Cứu Toàn Bộ Câu Lệnh Dự Án

| Nhóm | Câu lệnh (Terminal / PowerShell) | Mục đích & Mô tả chi tiết |
| :--- | :--- | :--- |
| **Chạy 1 Lệnh Duy Nhất** | `npm run dev` | **[KHUYẾN NGHỊ SỐ 1]** Khởi chạy đồng thời cả Backend API (port 8080) và Frontend Web (port 5173) trong **1 terminal duy nhất**, tự động phân luồng log `[API]` và `[WEB]`. |
| **Cài đặt** | `npm install` | Cài đặt toàn bộ thư viện dependencies cho cả root và 2 workspaces (`apps/web`, `apps/api`). |
| **Chạy Dev (API)** | `npm run dev:api` | Khởi chạy riêng Backend Express với cơ chế Hot-Reload (`tsx watch`) trên cổng `8080`. |
| **Chạy Dev (Web)** | `npm run dev:web` | Khởi chạy riêng máy chủ phát triển Vite React trên cổng `5173`. |
| **Chạy trực tiếp** | `cd apps/api; npm run dev`<br>`cd apps/web; npm run dev` | Di chuyển vào từng thư mục phân hệ để chạy độc lập. |
| **Kiểm tra tổng hợp** | `npm run check` | Chạy 1 lượt kiểm tra toàn diện: verify cấu trúc ➔ typecheck TypeScript ➔ unit tests ➔ build. |
| **Xác thực cấu trúc** | `npm run verify` | Chạy script `scripts/verify-source.mjs` kiểm tra các file hệ thống và tính hợp lệ của JSON. |
| **Kiểm tra kiểu dữ liệu** | `npm run typecheck` | Quét và kiểm tra lỗi TypeScript (`tsc`) trên toàn bộ các workspace. |
| **Typecheck Web** | `npm --workspace apps/web run typecheck` | Chỉ quét lỗi kiểu dữ liệu TypeScript cho ứng dụng Frontend Web. |
| **Typecheck API** | `npm --workspace apps/api run typecheck` | Chỉ quét lỗi kiểu dữ liệu TypeScript cho Backend API. |
| **Chạy Unit Test** | `npm run test` | Chạy toàn bộ các bài Unit Test của Backend (`apps/api/src/**/*.test.ts`). |
| **Đóng gói toàn bộ** | `npm run build` | Biên dịch bundle Production cho cả Web (`apps/web/dist`) và API (`apps/api/dist`). |
| **Đóng gói riêng Web** | `npm --workspace apps/web run build` | Biên dịch và tối ưu hóa tài nguyên tĩnh (HTML/JS/CSS) cho Web. |
| **Đóng gói riêng API** | `npm --workspace apps/api run build` | Biên dịch mã nguồn TypeScript của API sang JavaScript trong thư mục `dist/`. |
| **Xem trước bản build Web**| `npm --workspace apps/web run preview` | Mở máy chủ preview nội bộ để thử nghiệm bản build Production của Web. |
| **Chạy API Production** | `npm --workspace apps/api run start` | Khởi động máy chủ Node.js từ file đã build sẵn `dist/server.js`. |
| **Triển khai Rules/Indexes**| `firebase deploy --only firestore:rules,firestore:indexes` | Cập nhật Firestore Security Rules và Composite Indexes lên Firebase Console. |
| **Triển khai Web Hosting** | `firebase deploy --only hosting` | Đẩy thư mục `apps/web/dist` lên Firebase Hosting CDN. |
| **Kiểm tra môi trường** | `powershell .\scripts\00-check-prerequisites.ps1` | Kiểm tra sự sẵn sàng của Node.js, npm, Firebase CLI, Google Cloud SDK. |
| **Deploy Cloud Run API** | `powershell .\scripts\05-deploy-api.ps1` | Tự động build image container và deploy Backend API lên Google Cloud Run. |
| **Kiểm tra sức khỏe dịch vụ**| `powershell .\scripts\09-health-check.ps1` | Gửi request kiểm tra trạng thái hoạt động của Cloud Run và Firebase Hosting. |
| **Kích hoạt đồng bộ đầu** | `powershell .\scripts\10-first-sync.ps1` | Gọi endpoint kích hoạt tiến trình đồng bộ dữ liệu Classroom lần đầu tiên. |

---

## 1. MA TRẬN KHẢ NĂNG CUNG CẤP DỮ LIỆU CỦA GOOGLE API

Trước khi triển khai, hệ thống phân định rõ các dữ liệu mà Google API chính thức thực sự cung cấp, nhằm đảm bảo **tính trung thực 100%**, tuyệt đối không tự suy diễn hoặc dùng dữ liệu giả để bù vào các giới hạn kỹ thuật của nền tảng:

| Thực thể / Chỉ số | Nguồn Google API | Trạng thái | Ghi chú & Ràng buộc kỹ thuật |
| :--- | :--- | :---: | :--- |
| **Danh sách lớp học (Courses)** | Classroom API `courses.list` | `SUPPORTED` | Tên lớp, phòng, mô tả, trạng thái (ACTIVE, ARCHIVED, PROVISIONED), link lớp, Calendar ID. |
| **Giáo viên & Học sinh** | Classroom API `teachers.list`, `students.list` | `SUPPORTED` | Profile, email, tên hiển thị, mã định danh học sinh trong Classroom. |
| **Bài tập & Câu hỏi (CourseWork)** | Classroom API `courseWork.list` | `SUPPORTED` | Tiêu đề, hướng dẫn, ngày giao, hạn nộp, điểm tối đa, chủ đề (topics), file đính kèm. |
| **Tài liệu học tập (Materials)** | Classroom API `courseWorkMaterials.list` | `SUPPORTED` | Tài liệu không chấm điểm, giáo trình, video đính kèm. |
| **Thông báo (Announcements)** | Classroom API `announcements.list` | `SUPPORTED` | Bản tin trao đổi của giáo viên và học sinh trên luồng lớp học. |
| **Bài nộp học sinh (Submissions)** | Classroom API `studentSubmissions.list` | `SUPPORTED` | Trạng thái (NEW, CREATED, TURNED_IN, RETURNED, RECLAIMED_BY_STUDENT), cờ nộp muộn (`late: true`), điểm nháp (`draftGrade`), điểm chính thức (`assignedGrade`), thời điểm nộp. |
| **Sự kiện Meet & Thời lượng học** | Workspace Events API & Meet API | `SUPPORTED` | Nhật ký tham gia Meet, giờ vào/ra của học sinh để tính chuyên cần số. |
| **Nhật ký thao tác (Audit Logs)** | Admin SDK Reports API (`activities.list`) | `PARTIAL` | **Chỉ hỗ trợ** khi kết nối tài khoản Google Workspace for Education có quyền Admin. Không áp dụng cho Gmail cá nhân. |
| **Thời gian học sinh đọc bài / Xem trang** | N/A | `NOT_AVAILABLE` | Google Classroom không cung cấp API đo thời gian dwell-time hay clickstream của học sinh. Hệ thống ghi nhận trạng thái này và không bịa đặt số liệu. |
| **Tâm lý / Cảm xúc học sinh** | N/A | `NOT_AVAILABLE` | Tuyệt đối không dùng AI suy đoán tình trạng tâm lý/sức khỏe cá nhân học sinh. Chỉ số Health Score được tính toán hoàn toàn bằng công thức toán học minh bạch dựa trên bài nộp, tiến độ và chuyên cần. |

---

## 2. KIẾN TRÚC TỔNG THỂ HỆ THỐNG

Hệ thống được thiết kế phân tầng theo mô hình bảo mật chuẩn Google Cloud & Firebase:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRÌNH DUYỆT BAN GIÁM HIỆU                        │
│             (React 19 + TypeScript + Vite + MUI v7 + Chart.js)          │
│        • Executive Dashboard   • Student 360     • Class Comparison     │
│        • Executive Analytics   • Subject BI      • Early Warning Center │
│        • Catalog Normalizer    • Google Connect  • Reports & Exports    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS / JWT Auth Token (Client)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICE LAYER                           │
│                      (Node.js / Express / TypeScript)                   │
│             Triển khai trên Google Cloud Run / Cloud Functions v2       │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Security & RBAC  │  │ Google Connect   │  │ Analytics & Health   │  │
│  │ UserScope Filter │  │ Token Encryption │  │ Engine (Weighted)    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐  │
│  │ Classroom Ingest │  │ Catalog Mapping  │  │ Dynamic Alert Engine │  │
│  │ Backoff & Paging │  │ Regex Auto-Detect│  │ Rule-driven Warning  │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────────┘  │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
     Service-to-API │                                 │ Database Read/Write
                    ▼                                 ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────┐
│       GOOGLE WORKSPACE APIs          │  │       CLOUD FIRESTORE         │
│ • Google Classroom API               │  │ • multi-tenant `siSchools`    │
│ • Admin SDK Reports API (Audit)      │  │ • Separation of Raw & BI Data │
│ • Admin SDK Directory API            │  │ • Lock down direct client write│
│ • Google Meet REST API               │  │ • Audit & Snapshot Logs       │
└──────────────────────────────────────┘  └───────────────────────────────┘
```

---

## 3. PHÂN QUYỀN RBAC & QUẢN TRỊ TÀI KHOẢN

### 3.1. Phân Cấp Vai Trò (Roles)
1. **`SYSTEM_SUPER_ADMIN`**: Quản trị ứng dụng cao nhất. Có toàn quyền trên toàn hệ thống: thêm/xóa/khóa quản trị cấp dưới, cấu hình kết nối Google tập trung, thiết lập quy tắc cảnh báo, chỉnh sửa danh mục chuẩn và cấu hình hệ số Student Health Score.
2. **`SCHOOL_ADMIN` / `PRINCIPAL` (Hiệu Trưởng)**: Toàn quyền xem báo cáo điều hành, phân tích trường, khối, lớp, giáo viên, nhận cảnh báo sớm và ghi chú chỉ đạo xử lý.
3. **`VICE_PRINCIPAL` (Phó Hiệu Trưởng)**: Phụ trách mảng chuyên môn hoặc khối được phân công; xem phân tích môn học, lớp học và cảnh báo.
4. **`DEPARTMENT_HEAD` (Tổ Trưởng Chuyên Môn)**: Xem phân tích chuyên sâu cho các môn và các lớp thuộc tổ phụ trách.
5. **`TEACHER` (Giáo Viên)**: Xem thống kê các lớp và môn học mà mình trực tiếp giảng dạy.
6. **`DATA_VIEWER`**: Quyền chỉ đọc báo cáo cấp cao, không được cấu hình hệ thống.

### 3.2. Phạm Vi Truy Cập Dữ Liệu (`UserScope`)
Mỗi tài khoản cấp dưới có thể được gán phạm vi cụ thể:
- `grades`: Danh sách khối phụ trách (ví dụ `["6", "7"]`).
- `classes`: Danh sách lớp hành chính phụ trách (ví dụ `["6A1", "6A2"]`).
- `subjects`: Danh sách môn học phụ trách (ví dụ `["Toán", "Ngữ văn"]`).
- `courseIds`: Danh sách ID Classroom cụ thể được phép xem.

### 3.3. Tự Động Bootstrap Super Admin Đầu Tiên
Khi triển khai lần đầu, hệ thống tự động nhận diện và gán quyền `SYSTEM_SUPER_ADMIN` cho các tài khoản được khai báo trong biến môi trường:
- `BOOTSTRAP_SUPER_ADMIN_EMAILS=09.levanbinh2003@gmail.com,admin@thcsgiangvo.edu.vn`
- `BOOTSTRAP_SUPER_ADMIN_DOMAINS=thcsgiangvo.edu.vn`

---

## 4. HAI CHẾ ĐỘ KẾT NỐI GOOGLE CLASSROOM

Hệ thống hỗ trợ đồng thời hai mô hình kết nối tùy theo hạ tầng thực tế của trường:

### Chế Độ A — OAuth 2.0 Từng Tài Khoản (Personal Gmail / Workspace Account)
- Phù hợp khi giáo viên hoặc quản trị viên dùng tài khoản cá nhân hoặc trường chưa cấp quyền Domain-Wide Delegation.
- Người dùng đăng nhập bằng Google và cấp quyền Classroom Scopes.
- **Tính năng phát hiện quyền hạn (`LIMITED_ACCESS`)**: Nếu tài khoản chỉ là học sinh hoặc trợ giảng trong một số lớp, hoặc không có quyền xem điểm số đầy đủ của toàn trường, hệ thống sẽ tự động gắn cờ `LIMITED_ACCESS` và hiển thị cảnh báo minh bạch trên giao diện, tuyệt đối không báo sai rằng đã đồng bộ đủ dữ liệu.

### Chế Độ B — Google Workspace for Education (Domain-Wide Delegation - DWD)
- Dành cho tài khoản Super Admin của tên miền Google Workspace nhà trường (ví dụ `@thcsgiangvo.edu.vn`).
- Sử dụng Google Cloud Service Account kết hợp với Domain-Wide Delegation tại Google Workspace Admin Console (`admin.google.com`).
- **Ưu điểm vượt trội**: Hệ thống tự động truy xuất toàn bộ Classroom, giáo viên, học sinh, bài tập của toàn trường mà **không bắt buộc** Hiệu trưởng phải tham gia thủ công vào từng lớp học.

> **Bảo Mật Token Tuyệt Đối**: Access Token và Refresh Token **chỉ được lưu trữ và giải mã tại Backend / Google Secret Manager**. Tuyệt đối không truyền hoặc lưu token tại trình duyệt (Frontend).

---

## 5. CHUẨN HÓA DỮ LIỆU TRƯỜNG HỌC

Tên lớp trên Google Classroom thường do giáo viên tự đặt và không đồng nhất (ví dụ: *"Toán Thầy Nam 6A1"*, *"6A1 - Đại số"*, *"English 6A1 2025-2026"*). Hệ thống cung cấp công cụ chuẩn hóa chuyên nghiệp:

1. **Bộ Danh Mục Chuẩn**:
   - **Năm học & Học kỳ**: Khởi tạo năm học (ví dụ `2025-2026`) và các kỳ học (HK1, HK2).
   - **Khối & Lớp Hành Chính**: Khối 6, 7, 8, 9; Các lớp 6A1, 6A2, 7A1, 7A2...
   - **Môn Học Chuẩn**: Toán, Ngữ văn, Tiếng Anh, KHTN, Lịch sử & Địa lí, GDCD, Tin học, Công nghệ...
2. **Bộ Nhận Diện Tự Động Thông Minh (Auto-Detection Engine)**:
   - Tích hợp biểu thức chính quy (Regex) và từ khóa sư phạm tiếng Việt để phân tích tên Classroom, tự động gợi ý lớp hành chính và môn học chuẩn với độ chính xác trên 95%.
3. **Cơ Chế Xác Nhận & Điều Chỉnh Của Quản Trị Viên (Admin Review)**:
   - Quản trị viên duyệt danh sách ánh xạ (`subjectMappings`, `classMappings`), xác nhận hoặc điều chỉnh thủ công để đảm bảo số liệu so sánh chéo hoàn toàn chính xác.

---

## 6. BỘ PHÂN HỆ ĐIỀU HÀNH CỦA BAN GIÁM HIỆU

### 6.1. Executive Dashboard (Bàn Làm Việc Của Hiệu Trưởng)
- **11 Chỉ số cốt lõi (KPIs)**: Tổng Classroom đang chạy, Tổng giáo viên, Tổng học sinh, Bài tập mới giao, Tỷ lệ hoàn thành (%), Tỷ lệ đúng hạn (%), Bài quá hạn/chưa nộp, Bài đã chấm vs chờ chấm, Điểm trung bình toàn trường (GPA), Số lượng cảnh báo cần xử lý, Số Classroom không hoạt động (Dormant).
- **So sánh biến động chu kỳ (Delta vs Prior Period)**: Tự động so sánh Tuần này vs Tuần trước (WoW) và Tháng này vs Tháng trước (MoM) với chỉ báo màu sắc trực quan (Xanh tăng trưởng / Đỏ sụt giảm).
- **Bộ lọc linh hoạt**: Hôm nay, 7 ngày qua, Tuần này, Tháng này, Học kỳ, Năm học, Khoảng ngày tùy chọn; Lọc theo Khối, Lớp, Môn học.

### 6.2. Executive Analytics & Drill-Down 6 Cấp
- **Ma trận Heatmap Lớp × Môn**: Trực quan hóa toàn bộ lớp học trên trục ngang và môn học trên trục dọc với 2 chế độ hiển thị: **Tỷ Lệ Hoàn Thành** và **Điểm Trung Bình (GPA)**. Giúp Hiệu trưởng nhìn thấy ngay "điểm nghẽn" của trường trong 3 giây.
- **Drill-Down 6 Cấp Độ Chi Tiết**:
  `TOÀN TRƯỜNG` ➔ `KHỐI` ➔ `LỚP` ➔ `MÔN HỌC` ➔ `HỌC SINH` ➔ `BÀI TẬP CỤ THỂ`.
  Bấm vào bất kỳ ô heatmap hoặc KPI nào sẽ mở ngăn kéo chi tiết hiển thị dữ liệu gốc kiểm chứng.

### 6.3. Student 360 & Student Learning Health Score
- **Hồ sơ 360 độ**: Danh sách các Classroom tham gia, tiến độ nộp bài, điểm GPA, điểm cao nhất, điểm thấp nhất, biểu đồ xu hướng học tập và dòng thời gian hoạt động (Activity Timeline).
- **Chỉ Số Sức Khỏe Học Tập (Health Score 0-100)**:
  $$HealthScore = (GPA \times 10 \times w_{score}) + (Rate_{complete} \times w_{comp}) + (Rate_{ontime} \times w_{ontime}) + (Trend \times w_{trend})$$
  *(Trọng số mặc định: Điểm số 40%, Hoàn thành 30%, Đúng hạn 20%, Xu hướng 10% — Có thể cấu hình trực tiếp trên giao diện Admin).*
- **Giải thích định lượng minh bạch (Explainability)**: Hiển thị chi tiết nguyên nhân học sinh bị đưa vào diện chú ý (ví dụ: *Tỷ lệ đúng hạn chỉ đạt 45%, thiếu 3 bài tập liên tiếp*).

### 6.4. So Sánh Đối Đầu Lớp Học (Class Comparison)
- Cho phép chọn 2 hoặc nhiều lớp (ví dụ `6A1 vs 6A2` hoặc `7A1 vs 7A2`) để so sánh đối đầu trên cùng khung thời gian và môn học.
- Biểu đồ **Dual-Overlay Line Chart** thể hiện chênh lệch điểm và tỷ lệ hoàn thành qua các tuần học.
- Bảng so sánh 8 chỉ số định lượng: Sĩ số, Số bài tập đã giao, Tỷ lệ hoàn thành, Nộp muộn, Chưa nộp, Điểm trung bình, Mức độ hoạt động, Số môn đang học.

### 6.5. Phân Tích Chuyên Sâu Bộ Môn & Giáo Viên
- **Subject Analytics**: Thống kê số lớp triển khai, phân bố phổ điểm, xếp hạng lớp tiến bộ tốt nhất và lớp có xu hướng giảm; so sánh cùng môn giữa các lớp và giữa các khối.
- **Teacher Workload Analytics**: Thống kê số Classroom phụ trách, tần suất giao bài/tuần, số tài liệu đăng tải, số lượng bài nộp đang chờ chấm/xử lý và tiến độ của các lớp giáo viên giảng dạy. Không đưa ra kết luận định kiến mà cung cấp chỉ báo hỗ trợ phân bổ nhân sự hợp lý.

### 6.6. Trung Tâm Cảnh Báo Sớm (Early Warning Center)
- Hỗ trợ tạo **Quy tắc cảnh báo động (Dynamic Alert Rules)**:
  - Học sinh có từ N bài tập liên tiếp chưa hoàn thành.
  - Tỷ lệ nộp bài đúng hạn dưới ngưỡng X%.
  - Điểm trung bình môn giảm trên Y% so với kỳ trước.
  - Classroom không có hoạt động mới trong 14 ngày.
  - Số lượng bài tập chưa chấm dồn ứ bất thường.
- Phân cấp mức độ nghiêm trọng: `INFO`, `WARNING`, `HIGH`, `CRITICAL`.
- Quy trình xử lý: Gán người phụ trách, chuyển trạng thái (*Mới phát hiện ➔ Đang xử lý ➔ Đã xử lý*) và ghi chú chỉ đạo của Hiệu trưởng.

### 6.7. Kiểm Toán Hoạt Động Google Classroom (Audit Log)
- Tích hợp với **Admin SDK Reports API** để ghi nhận nhật ký thao tác (thêm/xóa học sinh, tạo bài tập, đổi trạng thái lớp).
- Hiển thị rõ ràng cảnh báo: `Không có quyền truy cập Classroom Audit` nếu tài khoản không có quyền Workspace Admin, không tạo số liệu giả.

---

## 7. HƯỚNG DẪN CẤU HÌNH GOOGLE CLOUD CONSOLE & WORKSPACE ADMIN

### Bước 1: Tạo Google Cloud Project & Kích Hoạt APIs
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Tạo dự án mới: `thcs-giangvo-intelligence`.
3. Vào **APIs & Services > Library**, tìm kiếm và nhấn **ENABLE** các API sau:
   - **Google Classroom API**
   - **Admin SDK API** (cho Reports và Directory)
   - **Google Meet API**
   - **Cloud Secret Manager API**
   - **Cloud Pub/Sub API**

### Bước 2: Cấu Hình OAuth Consent Screen
1. Vào **APIs & Services > OAuth consent screen**.
2. Chọn **Internal** (nếu chỉ dùng cho trường có Google Workspace) hoặc **External** (nếu hỗ trợ cả tài khoản cá nhân `@gmail.com`).
3. Điền thông tin ứng dụng:
   - App name: `THCS Giang Vo School Intelligence`
   - User support email: `09.levanbinh2003@gmail.com`
4. Khai báo danh sách Scopes bắt buộc:
   - `https://www.googleapis.com/auth/classroom.courses.readonly`
   - `https://www.googleapis.com/auth/classroom.rosters.readonly`
   - `https://www.googleapis.com/auth/classroom.profile.emails`
   - `https://www.googleapis.com/auth/classroom.coursework.students.readonly`
   - `https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly`
   - `https://www.googleapis.com/auth/classroom.announcements.readonly`
   - `https://www.googleapis.com/auth/classroom.topics.readonly`
   - `https://www.googleapis.com/auth/admin.reports.audit.readonly` *(chỉ cần cho Chế độ B)*
5. Thêm Test Users nếu chọn chế độ External (bao gồm `09.levanbinh2003@gmail.com`).

### Bước 3: Tạo OAuth 2.0 Client ID (Chế Độ A)
1. Vào **APIs & Services > Credentials > Create Credentials > OAuth client ID**.
2. Chọn Application type: **Web application**.
3. Name: `Classroom Web Client`.
4. Authorized JavaScript origins:
   - `http://localhost:5173`
   - `https://thcs-giangvo.web.app`
5. Authorized redirect URIs:
   - `http://localhost:8080/api/connections/oauth/callback`
   - `https://<YOUR_CLOUD_RUN_URL>/api/connections/oauth/callback`
6. Lưu lại `Client ID` và `Client Secret`.

### Bước 4: Tạo Service Account & Cấu Hình Domain-Wide Delegation (Chế Độ B)
1. Vào **IAM & Admin > Service Accounts > Create Service Account**:
   - Tên: `si-workspace-dwd`.
   - Quyền: Viewer.
2. Nhấn vào Service Account vừa tạo, chuyển sang tab **Keys > Add Key > Create new key (JSON)**. Tải file JSON về máy.
   - **Đổi tên & vị trí**: Khuyến nghị đổi tên thành `service-account.json` và lưu vào thư mục `apps/api/service-account.json` (hoặc thư mục gốc dự án). File này đã được thêm vào `.gitignore` để bảo vệ an toàn.
   - **Tác dụng 2 trong 1**:
     - *Cho Firebase Admin SDK*: Tự động cấp quyền Đọc/Ghi dữ liệu Firestore database (`siSchools`).
     - *Cho Google Workspace DWD*: Ký RSA Token cục bộ để truy xuất Google Classroom và Reports API toàn trường mà không phụ thuộc vào hạ tầng GCP.
3. Trong tab **Details**, mở rộng phần **Advanced settings** và sao chép **Client ID** (dãy số dạng `102938475612345678901`).
4. Đăng nhập trang quản trị trường học: [admin.google.com](https://admin.google.com/) bằng tài khoản Super Admin Workspace.
5. Vào **Security > Access and data control > API controls > Manage Domain-Wide Delegation**.
6. Nhấn **Add new**, dán **Client ID** của Service Account và nhập danh sách Scopes (ngăn cách bằng dấu phẩy):
   ```text
   https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/classroom.courses.readonly,https://www.googleapis.com/auth/classroom.rosters.readonly,https://www.googleapis.com/auth/classroom.profile.emails,https://www.googleapis.com/auth/classroom.coursework.students.readonly,https://www.googleapis.com/auth/classroom.announcements.readonly,https://www.googleapis.com/auth/classroom.topics.readonly,https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly,https://www.googleapis.com/auth/admin.reports.audit.readonly
   ```
7. Nhấn **Authorize**.


---

## 8. HƯỚNG DẪN CÀI ĐẶT & CÁC CÂU LỆNH CHẠY DỰ ÁN CHI TIẾT

### 8.1. Yêu cầu môi trường:
- **Node.js**: Phiên bản `>= 20.0.0` (khuyến nghị phiên bản LTS `22.x`).
- **npm**: Phiên bản `>= 10.0.0`.
- **Firebase CLI** (tùy chọn cho deploy): `npm install -g firebase-tools`
- **Google Cloud SDK** (tùy chọn cho Cloud Run): `gcloud components install`

### 8.2. Bước 1: Cài Đặt Dependencies Toàn Bộ Dự Án
Dự án sử dụng mô hình **npm workspaces** (`apps/web`, `apps/api`), do đó bạn chỉ cần chạy `npm install` tại thư mục gốc là toàn bộ dependencies của cả 2 phân hệ sẽ được cài đặt tự động:
```powershell
git clone <REPOSITORY_URL>
cd thcs-giang-vo-school-intelligence

# Cài đặt tất cả dependencies (hoạt động cho cả root, web và api)
npm install
```

### 8.3. Bước 2: Thiết Lập File Biến Môi Trường (.env)

#### 1. Cấu hình Backend API (`apps/api/.env`)
Tạo file `apps/api/.env` (sao chép từ `apps/api/.env.example`):
```powershell
cp apps/api/.env.example apps/api/.env
```
Nội dung cơ bản:
```env
PROJECT_ID=thcs-giangvo
REGION=asia-southeast1
SCHOOL_ID=giang-vo
SCHOOL_NAME=Trường THCS Giảng Võ

# Super Admin Tự Động Bootstrap
BOOTSTRAP_SUPER_ADMIN_EMAILS=09.levanbinh2003@gmail.com,admin@thcsgiangvo.edu.vn
BOOTSTRAP_SUPER_ADMIN_DOMAINS=thcsgiangvo.edu.vn
BOOTSTRAP_ADMIN_EMAILS=admin@thcsgiangvo.edu.vn

# Google OAuth Credentials (Chế độ A)
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/connections/oauth/callback

# Google Workspace Domain-Wide Delegation (Chế độ B)
WORKSPACE_DOMAIN=thcsgiangvo.edu.vn
WORKSPACE_ADMIN_SUBJECT=admin@thcsgiangvo.edu.vn
DWD_SERVICE_ACCOUNT_EMAIL=si-workspace-dwd@thcs-giangvo.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=

# Cổng Mạng & Origin kết nối
WEB_ORIGIN=http://localhost:5173
API_BASE_URL=http://localhost:8080
PORT=8080
```

#### 2. Cấu hình Frontend Web (`apps/web/.env.local`)
Tạo file `apps/web/.env.local` (sao chép từ `apps/web/.env.example`):
```powershell
cp apps/web/.env.example apps/web/.env.local
```
Nội dung cơ bản:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=thcs-giangvo.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=thcs-giangvo
VITE_FIREBASE_APP_ID=1:123456789:web:...
VITE_API_BASE_URL=http://localhost:8080
VITE_SCHOOL_ID=giang-vo
VITE_SCHOOL_NAME=Trường THCS Giảng Võ
```

---

### 8.4. Các Câu Lệnh Khởi Chạy Môi Trường Phát Triển (Development Mode)

#### Cách 1: Khởi chạy TOÀN BỘ hệ thống bằng 1 CÂU LỆNH DUY NHẤT (Khuyến nghị số 1)
Chỉ cần mở **1 cửa sổ terminal duy nhất** tại thư mục gốc và gõ:
```powershell
npm run dev
```
- Lệnh này sẽ tự động khởi chạy song song cả Backend API (`tsx watch` trên port `8080`) và Frontend Web (`vite` trên port `5173`).
- Toàn bộ log trên màn hình được gắn nhãn màu trực quan: `[API]` (màu xanh ngọc) và `[WEB]` (màu tím hồng).
- Khi nhấn `Ctrl + C`, hệ thống sẽ tự động dọn dẹp và kết thúc tất cả tiến trình con một cách an toàn.

#### Cách 2: Khởi chạy riêng biệt từng phân hệ (2 cửa sổ terminal riêng)
Nếu bạn muốn theo dõi log tách biệt trong từng cửa sổ terminal:
```powershell
# Cửa sổ Terminal 1: Khởi chạy Backend API (Port 8080, hot-reload với tsx watch)
npm run dev:api

# Cửa sổ Terminal 2: Khởi chạy Frontend Web (Port 5173, Vite HMR)
npm run dev:web
```

#### Cách 3: Khởi chạy trực tiếp từ thư mục phân hệ
```powershell
# Chạy riêng Backend API:
cd apps/api
npm run dev

# Chạy riêng Frontend Web:
cd apps/web
npm run dev
```

#### Các địa chỉ truy cập & Kiểm tra kết nối:
- 🌐 **Giao diện Quản trị Ban Giám hiệu**: [http://localhost:5173](http://localhost:5173)
- 🩺 **Kiểm tra sức khỏe Backend API**: [http://localhost:8080/health](http://localhost:8080/health)
- 🔌 **API Base URL**: `http://localhost:8080/api`
- 🔑 **Tài khoản Super Admin mặc định**: Đăng nhập tài khoản Google có email `09.levanbinh2003@gmail.com` hoặc đuôi `@thcsgiangvo.edu.vn` để hệ thống tự động gán vai trò **SYSTEM_SUPER_ADMIN**.

---

### 8.5. Các Câu Lệnh Kiểm Tra, Typecheck & Unit Tests (QA & Verification)

Hệ thống cung cấp đầy đủ bộ công cụ kiểm thử tự động từ cấp độ file, kiểu dữ liệu đến logic nghiệp vụ:

#### 1. Kiểm tra toàn diện 1 câu lệnh (`check`)
Chạy chuỗi liên hoàn: `verify` ➔ `typecheck` ➔ `test` ➔ `build`:
```powershell
npm run check
```

#### 2. Kiểm tra tính toàn vẹn cấu trúc dự án (`verify`)
Chạy script `scripts/verify-source.mjs` để đảm bảo không thiếu file bắt buộc và các file JSON cấu hình chuẩn xác:
```powershell
npm run verify
```

#### 3. Kiểm tra kiểu dữ liệu TypeScript (`typecheck`)
Quét lỗi TypeScript cho toàn bộ dự án:
```powershell
# Quét toàn bộ workspaces:
npm run typecheck

# Hoặc chỉ quét riêng cho Web:
npm --workspace apps/web run typecheck

# Hoặc chỉ quét riêng cho Backend API:
npm --workspace apps/api run typecheck
```

#### 4. Chạy các bài Unit Tests của Backend (`test`)
Chạy bộ test kiểm thử các module Classroom, Meet, Seeder, Token mã hóa bằng Node.js Test Runner:
```powershell
npm run test
```

---

### 8.6. Các Câu Lệnh Đóng Gói (Build) & Chạy Thử Nghiệm Production (Preview)

#### 1. Đóng gói toàn bộ dự án (Production Build)
```powershell
# Build đồng thời cả Frontend Web và Backend API:
npm run build

# Hoặc build riêng Frontend Web:
npm --workspace apps/web run build
# (Kết quả: thư mục `apps/web/dist`)

# Hoặc build riêng Backend API:
npm --workspace apps/api run build
# (Kết quả: thư mục `apps/api/dist`)
```

#### 2. Chạy thử nghiệm bản build Web (Preview)
Khởi chạy web server nội bộ phục vụ thư mục `apps/web/dist` để kiểm tra độ mượt mà và giao diện trước khi triển khai:
```powershell
npm --workspace apps/web run preview
```

#### 3. Khởi động Backend API ở chế độ Production
Chạy trực tiếp bằng Node.js từ file đã biên dịch (không qua tsx):
```powershell
npm --workspace apps/api run start
```

---

## 9. HƯỚNG DẪN TRIỂN KHAI PRODUCTION (FIREBASE & CLOUD RUN)

### Bước 1: Đăng Nhập Firebase & Google Cloud
```powershell
firebase login
gcloud auth login
gcloud config set project thcs-giangvo
```

### Bước 2: Lưu Trữ Thông Tin Bảo Mật Vào Secret Manager
```powershell
echo -n "your-client-id" | gcloud secrets create si-classroom-oauth-client-id --data-file=-
echo -n "your-client-secret" | gcloud secrets create si-classroom-oauth-client-secret --data-file=-
```

### Bước 3: Triển Khai Backend API Lên Google Cloud Run
Sử dụng script tự động hóa chuẩn:
```powershell
.\scripts\05-deploy-api.ps1 `
  -WorkspaceDomain "thcsgiangvo.edu.vn" `
  -AdminSubject "admin@thcsgiangvo.edu.vn" `
  -BootstrapAdminEmails "09.levanbinh2003@gmail.com,admin@thcsgiangvo.edu.vn" `
  -TeacherOuPrefixes "/GiaoVien,/Teachers" `
  -StudentOuPrefixes "/HocSinh,/Students"
```

### Bước 4: Triển Khai Firestore Rules & Indexes
```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

### Bước 5: Build & Deploy Frontend Lên Firebase Hosting
```powershell
npm run build --workspaces
firebase deploy --only hosting
```

---

## 10. XỬ LÝ SỰ CỐ & CÂU HỎI THƯỜNG GẶP (TROUBLESHOOTING)

#### 1. Tại sao hệ thống hiển thị trạng thái `LIMITED_ACCESS`?
- **Nguyên nhân**: Tài khoản kết nối Google chỉ là học sinh hoặc trợ giảng trong một số Classroom nhất định, hoặc thiếu scope đọc điểm số `classroom.coursework.students.readonly`.
- **Khắc phục**: Nâng quyền cho tài khoản trong Google Workspace hoặc cấu hình Chế độ B (Domain-Wide Delegation) của trường.

#### 2. Tại sao Classroom Audit Log báo `Không có quyền truy cập Classroom Audit`?
- **Nguyên nhân**: Tài khoản kết nối là tài khoản cá nhân `@gmail.com` hoặc tài khoản Workspace không có quyền Administrator trong Admin Console.
- **Khắc phục**: Đây là thiết kế bảo vệ an toàn của Google. Chỉ tài khoản Super Admin/Report Admin của trường mới có quyền xem nhật ký hoạt động này.

#### 3. Quá tải hạn mức Google API (Rate Limit / Quota Exceeded)?
- Hệ thống đã tích hợp thuật toán **Exponential Backoff** tự động thử lại khi gặp mã lỗi HTTP 429 hoặc 503. Nếu trường có quy mô lớn trên 100 Classroom, khuyến nghị thực hiện Full Sync lần đầu ngoài giờ cao điểm hoặc yêu cầu nâng quota tại Google Cloud Console.

#### 4. Dữ liệu Demo có bị lẫn vào Production không?
- **Hoàn toàn không**. Demo Mode được cô lập tuyệt đối trong bộ nhớ trình duyệt để phục vụ thuyết trình và đào tạo Ban Giám hiệu, không gửi dữ liệu giả về Firestore và không ảnh hưởng đến số liệu đồng bộ từ Google Classroom.

---

**Đơn vị phát triển**: Ban Đổi Mới Công Nghệ Giáo Dục — Trường THCS Giảng Võ, Hà Nội.  
**Múi giờ vận hành**: `Asia/Ho_Chi_Minh` (GMT+7).  
**Ngôn ngữ giao diện**: Tiếng Việt chuẩn mực sư phạm.
