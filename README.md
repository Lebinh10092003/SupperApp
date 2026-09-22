# 🏫 THCS Giảng Võ — School Classroom Intelligence Platform

> **Nền tảng quản trị điều hành lớp học số & phân tích sư phạm thông minh**  
> Dành cho Ban Giám hiệu, Tổ chuyên môn và Giáo viên Trường THCS Giảng Võ, Ba Đình, Hà Nội.

---

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19.1-61dafb?logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey?logo=express)](https://expressjs.com/)
[![Vite](https://img.shields.io/badge/Vite-6.3-purple?logo=vite)](https://vitejs.dev/)
[![MUI](https://img.shields.io/badge/MUI-7.2-007fff?logo=mui)](https://mui.com/)
[![Google Classroom](https://img.shields.io/badge/Google_Classroom-API_v1-orange?logo=googleclassroom)](https://developers.google.com/classroom)
[![Data Mode](https://img.shields.io/badge/Data_Mode-100%25_Zero--Mock_SSOT-success)](#-4-hai-chế-độ-kết-nối-google-classroom-thực-tế-zero-mock-ssot)
[![Tests](https://img.shields.io/badge/Tests-17_Passing-brightgreen)](#-10-kiểm-thử--đảm-bảo-chất-lượng-qa--testing)

---

## 📑 MỤC LỤC CHI TIẾT

1. [⚡ Khởi Chạy Nhanh Bằng 1 Câu Lệnh Duy Nhất (Quick Start)](#-1-khởi-chạy-nhanh-bằng-1-câu-lệnh-duy-nhất-quick-start)
2. [👥 Tài Khoản Thử Nghiệm Sẵn Có & Ma Trận Phân Quyền (RBAC)](#-2-tài-khoản-thử-nghiệm-sẵn-có--ma-trận-phân-quyền-rbac)
3. [🌟 Danh Mục Các Phân Hệ & Tính Năng Trọng Tâm](#-3-danh-mục-các-phân-hệ--tính-năng-trọng-tâm)
4. [🔌 Hai Chế Độ Kết Nối Google Classroom Thực Tế (Zero-Mock SSOT)](#-4-hai-chế-độ-kết-nối-google-classroom-thực-tế-zero-mock-ssot)
5. [🏗️ Kiến Trúc Hệ Thống & Ngăn Xếp Công Nghệ (Tech Stack)](#-5-kiến-trúc-hệ-thống--ngăn-xếp-công-nghệ-tech-stack)
6. [📁 Cấu Trúc Thư Mục Toàn Dự Án (Monorepo Structure)](#-6-cấu-trúc-thư-mục-toàn-dự-án-monorepo-structure)
7. [⚙️ Hướng Dẫn Cấu Hình Biến Môi Trường (.env)](#-7-hướng-dẫn-cấu-hình-biến-môi-trường-env)
8. [📋 Bảng Tra Cứu Toàn Bộ Câu Lệnh Dự Án (Scripts Cheat Sheet)](#-8-bảng-tra-cứu-toàn-bộ-câu-lệnh-dự-án-scripts-cheat-sheet)
9. [🐙 Cẩm Nang Git Thường Dùng (Đồng Bộ & Quản Trị Code)](#-9-cẩm-nang-git-thường-dùng-đồng-bộ--quản-trị-code)
10. [🧪 Kiểm Thử & Đảm Bảo Chất Lượng (QA & Testing)](#-10-kiểm-thử--đảm-bảo-chất-lượng-qa--testing)
11. [🚀 Hướng Dẫn Triển Khai Production (Cloud Run & Firebase)](#-11-hướng-dẫn-triển-khai-production-cloud-run--firebase)
12. [🛠️ Xử Lý Sự Cố Thường Gặp (Troubleshooting & FAQ)](#-12-xử-lý-sự-cố-thường-gặp-troubleshooting--faq)
13. [📚 Tài Liệu Kỹ Thuật Chuyên Sâu](#-13-tài-liệu-kỹ-thuật-chuyên-sâu)

---

## ⚡ 1. Khởi Chạy Nhanh Bằng 1 Câu Lệnh Duy Nhất (Quick Start)

### 📌 Yêu Cầu Môi Trường Tối Thiểu (Prerequisites):
- **Node.js**: Phiên bản `>= 20.18.0` (Khuyên dùng `v22.x LTS`).
- **npm**: Phiên bản `>= 10.0.0` (Hỗ trợ npm workspaces).
- **Hệ điều hành**: Windows 10/11, macOS, hoặc Linux (Ubuntu/Debian).

---

### 🚀 Chạy Hàng Ngày (1 Câu Lệnh Duy Nhất)
```powershell
npm run dev
```
> 💡 Lệnh này sử dụng bộ script điều phối `scripts/dev.mjs`, tự động khởi chạy đồng thời cả **Backend API (port 8080)** và **Frontend Web (port 5173)** trong cùng **1 cửa sổ Terminal duy nhất**, tự động phân luồng log `[API]` và `[WEB]` với màu sắc trực quan.

### 🌐 Địa Chỉ Truy Cập Sau Khi Chạy:
| Dịch vụ | Địa chỉ URL | Mô tả / Chức năng |
| :--- | :--- | :--- |
| **Frontend Web** | [http://localhost:5173](http://localhost:5173) | Giao diện Quản trị Ban Giám hiệu, Giáo viên & Học sinh |
| **Backend API** | [http://localhost:8080](http://localhost:8080) | Máy chủ REST API phục vụ toàn bộ nghiệp vụ |
| **Kiểm tra Sức khỏe API** | [http://localhost:8080/health](http://localhost:8080/health) | Endpoint kiểm tra trạng thái hoạt động và CSDL |
| **Thông tin Hệ thống** | [http://localhost:8080/api/system/status](http://localhost:8080/api/system/status) | Báo cáo chi tiết số lượng khóa học, người dùng và kết nối |

---

### 📦 Cài Đặt Lần Đầu Tiên (Khi mới clone/tải code về máy):
Mở terminal tại thư mục gốc dự án và thực thi lần lượt 3 bước:

```powershell
# Bước 1: Cài đặt toàn bộ thư viện dependencies cho cả Monorepo (Web, API, Root)
npm install

# Bước 2: Tạo file cấu hình môi trường từ mẫu có sẵn
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Bước 3: Khởi chạy dự án
npm run dev
```

---

## 👥 2. Tài Khoản Thử Nghiệm Sẵn Có & Ma Trận Phân Quyền (RBAC)

Tại màn hình đăng nhập ([http://localhost:5173/login](http://localhost:5173/login)), hệ thống cung cấp sẵn **6 vai trò thử nghiệm nhanh** bằng 1 cú click chuột (không cần nhập mật khẩu):

### 📋 Bảng Tài Khoản Demo Theo Vai Trò
| Vai trò (Role) | Tên hiển thị thử nghiệm | Email đại diện | Quyền hạn trọng tâm |
| :--- | :--- | :--- | :--- |
| **👑 SUPER_ADMIN** | Thầy Hiệu Trưởng (Admin Cấp Cao) | `hieutruong@thcs-giangvo.edu.vn` | Toàn quyền điều hành, phân tích chiến lược, cấu hình kết nối Google, quản trị hệ thống |
| **🎯 PRINCIPAL** | Cô Phó Hiệu Trưởng | `hieupho@thcs-giangvo.edu.vn` | Xem Dashboard điều hành toàn trường, đối sánh lớp học, hồ sơ 360°, báo cáo chuyên môn |
| **📚 DEPARTMENT_HEAD** | Thầy Tổ Trưởng Toán | `totruong.toan@thcs-giangvo.edu.vn` | Xem tiến độ giảng dạy, khối lượng bài tập và nộp bài môn Toán toàn trường |
| **👨‍🏫 TEACHER** | Thầy Giáo Viên Bộ Môn | `giaovien.toan@thcs-giangvo.edu.vn` | Xem danh sách lớp phụ trách, theo dõi chi tiết tình hình nộp bài của học sinh |
| **🎓 STUDENT** | Học Sinh Lê Văn Bình | `09.levanbinh2003@gmail.com` | Xem hồ sơ sư phạm 360° cá nhân, bảng điểm môn học, tiến độ nộp bài Classroom |
| **👁️ DATA_VIEWER** | Cán Bộ Thanh Tra / Quan Sát | `viewer@thcs-giangvo.edu.vn` | Chế độ chỉ đọc báo cáo thống kê, không có quyền sửa đổi hay kết nối hệ thống |

### 🔐 Ma Trận Năng Lực Nghiệp Vụ (Capabilities Matrix)
| Năng lực (Capability) | SUPER_ADMIN | PRINCIPAL | DEPARTMENT_HEAD | TEACHER | DATA_VIEWER | STUDENT |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| `VIEW_DASHBOARD` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `VIEW_EXECUTIVE_BI` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ |
| `VIEW_STUDENTS` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| `VIEW_OWN_PROFILE` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `MANAGE_CONNECTIONS` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `VIEW_SYSTEM_HEALTH` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `MANAGE_CATALOG` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🌟 3. Danh Mục Các Phân Hệ & Tính Năng Trọng Tâm

### 1️⃣ Bảng Điều Hành Ban Giám Hiệu (`/dashboard`)
- **Bộ Thẻ Chỉ Số KPI Thời Gian Thực**: Tổng số lớp học, tổng sĩ số học sinh, số khóa học Classroom đang hoạt động, tỷ lệ hoàn thành bài tập toàn trường, tỷ lệ nộp bài đúng hạn.
- **Bộ Lọc Động Theo Khối Lớp**: Lọc dữ liệu linh hoạt theo Toàn trường, Khối 6, Khối 7, Khối 8, Khối 9 (tự động phát hiện các khối thực tế đang có trong CSDL).
- **Biểu Đồ Xu Hướng & Tình Trạng Bài Nộp**: Trực quan hóa tỷ lệ nộp bài, phân bổ bài nộp đã chấm / chờ chấm / nộp muộn.
- **Nút Kích Hoạt Đồng Bộ Nhanh**: Nhấn **"Đồng bộ Classroom"** trực tiếp trên thanh công cụ để quét bài tập và bài nộp mới nhất từ Google.

### 2️⃣ Phân Tích Đối Đầu & So Sánh Lớp Học (`/classes/compare`)
- **Tab 1 — Đối Đầu Trực Tiếp 1 vs 1 (Head-to-Head Duel)**:
  - Chọn 2 lớp bất kỳ trong trường để so sánh toàn diện.
  - **Biểu đồ Radar 5 chiều sư phạm**: Tỷ lệ hoàn thành, Tỷ lệ đúng hạn, Điểm trung bình, Tỷ lệ chuyên cần, Khối lượng bài tập.
  - **Bảng phân tích chênh lệch (Delta +/-)**: Đánh giá chi tiết ưu điểm và điểm cần cải thiện của từng lớp.
  - **Khuyến nghị sư phạm tự động**: Đề xuất chỉ đạo cụ thể cho Giáo viên Chủ nhiệm của từng lớp.
- **Tab 2 — Bảng Xếp Hạng & Chuẩn Đối Sánh Toàn Khối (Grade Benchmark)**:
  - Biểu đồ thanh so sánh tỷ lệ hoàn thành của từng lớp với đường chuẩn trung bình toàn trường (Reference Line).
  - Bảng xếp hạng chi tiết với huy chương Top 3 (Vàng, Bạc, Đồng) và gắn nhãn phân loại: *Tiến độ xuất sắc (≥95%)*, *Đạt chuẩn (≥90%)*, *Cần đôn đốc (<90%)*.

### 3️⃣ Hồ Sơ Sư Phạm 360° Của Học Sinh (`/students`)
- **Bảng Điểm Điện Tử Chi Tiết**: Cấu trúc đầy đủ các cột điểm theo Thông tư của Bộ Giáo dục & Đào tạo:
  - Đánh giá thường xuyên: `ĐGTX 1`, `ĐGTX 2`, `ĐGTX 3`, `ĐGTX 4`
  - Đánh giá định kỳ: `ĐGK-Kỳ` (Giữa kỳ), `ĐGC-Kỳ` (Cuối kỳ)
  - Điểm trung bình môn (`ĐTBm`)
- **Biểu Đồ Năng Lực Radar Học Tập**: Phân tích sự đồng đều giữa các môn Khoa học Tự nhiên và Khoa học Xã hội.
- **Lịch Sử Bài Tập & Điểm Số Classroom**: Bảng chi tiết toàn bộ bài tập đã giao, trạng thái nộp bài, điểm số thực tế từ Google Classroom.
- **Chỉ Số Chuyên Cần & Tham Gia Google Meet**: Ghi nhận số buổi tham gia và thời lượng tham gia lớp học trực tuyến.

### 4️⃣ Quản Lý Đội Ngũ Giáo Viên & Tải Giảng Dạy (`/teachers`)
- Danh bạ toàn bộ giáo viên trong nhà trường.
- Thống kê các lớp học phụ trách và môn học giảng dạy.
- Đánh giá khối lượng bài tập đã giao và tiến độ chấm bài trên Google Classroom.

### 5️⃣ Trung Tâm Kết Nối Google Classroom (`/connections`)
- Kết nối và kiểm tra tính hợp lệ của tài khoản Google.
- Tự động phát hiện thông tin tài khoản kết nối, phạm vi quyền hạn (Scopes).
- Nút **"Đồng bộ toàn bộ dữ liệu"**: Tải về toàn bộ Khóa học, Học sinh, Giáo viên, Bài tập và Bài nộp.
- Nút **"Làm mới token"**: Gia hạn Access Token khi sắp hết hạn.
- Nút **"Dọn dẹp dữ liệu mẫu"**: Xóa sạch các dữ liệu thử nghiệm cũ để hệ thống đạt chuẩn 100% dữ liệu thật.

### 6️⃣ Giám Sát Sức Khỏe Kỹ Thuật & CSDL (`/system`)
- Đo đạc độ trễ mạng thực tế (Latency ms) tới Cloud Run Backend và Firestore/SQLite.
- Hiển thị trạng thái các dịch vụ: Backend API, SQLite/Firestore Database, Google Classroom API, Google OAuth/DWD.
- Kiểm kê số lượng bản ghi thực tế: số lớp học, số người dùng, trạng thái tệp cấu hình Service Account.

---

## 🔌 4. Hai Chế Độ Kết Nối Google Classroom Thực Tế (Zero-Mock SSOT)

Hệ thống được thiết kế theo nguyên tắc **Single Source of Truth (SSOT)** — 100% dữ liệu từ Google Classroom thật, không tạo dữ liệu ảo:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    NGUỒN DỮ LIỆU GOOGLE CLASSROOM                       │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
         Chế Độ A   │                      Chế Độ B   │
    (OAuth 2.0 Cá Nhân)               (Workspace Domain-Wide Delegation)
                    ▼                                 ▼
┌──────────────────────────────────┐  ┌───────────────────────────────────┐
│ • Giáo viên/BGH đăng nhập Google │  │ • Sử dụng Service Account JSON    │
│ • Cấp quyền Classroom Scopes     │  │ • Cấu hình DWD trên Admin Console │
│ • Tự động gia hạn Access Token   │  │ • Đồng bộ toàn trường 100% tự động│
│   (cả Google OAuth & Playground) │  │   không cần mời BGH vào từng lớp  │
└──────────────────┬───────────────┘  └───────────────┬───────────────────┘
                   │                                  │
                   └─────────────────┬────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        SQLITE / FIRESTORE STORE                         │
│       Kho dữ liệu chuẩn hóa Single Source of Truth của nhà trường       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 🔹 Chế Độ A — Google OAuth 2.0 (Dành cho cá nhân / Giáo viên)
1. Đăng nhập hệ thống bằng tài khoản Google có quyền truy cập Google Classroom.
2. Hệ thống lưu trữ `accessToken` và `refreshToken` bảo mật tại Backend.
3. **Cơ chế Auto-Refresh Token thông minh**: Hệ thống tự động làm mới token trước khi hết hạn, hỗ trợ cả Client OAuth chính thức lẫn Refresh Token sinh từ Google OAuth Playground.

### 🔹 Chế Độ B — Google Workspace Domain-Wide Delegation (DWD) (Dành cho toàn trường)
1. Dành cho Quản trị viên Google Workspace của trường (`admin.google.com`).
2. Tải file Service Account Key JSON vào thư mục `apps/api/credentials/service-account.json`.
3. Cấp quyền ủy quyền toàn miền (Domain-Wide Delegation) cho Client ID với các phạm vi Classroom:
   ```text
   https://www.googleapis.com/auth/classroom.courses.readonly
   https://www.googleapis.com/auth/classroom.rosters.readonly
   https://www.googleapis.com/auth/classroom.coursework.students.readonly
   https://www.googleapis.com/auth/classroom.topics.readonly
   https://www.googleapis.com/auth/classroom.profile.emails
   ```
4. Điền email Admin trường vào biến `GOOGLE_ADMIN_EMAIL` trong `apps/api/.env`.

---

## 🏗️ 5. Kiến Trúc Hệ Thống & Ngăn Xếp Công Nghệ (Tech Stack)

### 💻 Phân Hệ Frontend Web (`apps/web`)
- **Framework**: React 19.1 + TypeScript 5.8
- **Bundler & Dev Server**: Vite 6.3 (Build cực nhanh, Hot-Module Replacement dưới 50ms)
- **Giao Diện & Thành Phần**: Material UI (MUI v7.2) với thiết kế tùy biến, màu sắc sư phạm cao cấp, chuẩn Responsive
- **Trực Quan Hóa Dữ Liệu (Data Viz)**: Recharts (Radar Chart, Bar Chart, Line Chart)
- **Điều Hướng & Routing**: React Router DOM v7
- **Quản Lý Trạng Thái**: React Context API + Local Storage Session

### ⚙️ Phân Hệ Backend API (`apps/api`)
- **Môi Trường**: Node.js v22 LTS + Express 5 (TypeScript compiled)
- **Công Cụ Thực Thi Dev**: `tsx watch` (Hot-reload tức thì khi sửa code API)
- **Cơ Sở Dữ Liệu**:
  - **Môi trường cục bộ**: SQLite3 với chế độ WAL (Write-Ahead Logging) cho hiệu năng ghi ACID cao và độ bền tuyệt đối (`apps/api/data/school_intelligence.db`).
  - **Tương thích Cloud**: Lớp trừu tượng Firestore API tương thích ngược 100%, sẵn sàng chuyển đổi giữa SQLite cục bộ và Google Cloud Firestore khi triển khai Production.
- **Tích Hợp Google Cloud**:
  - `googleapis`: Google Classroom API v1, Admin SDK Directory API v1
  - Google OAuth 2.0 Auth Flow & Token Management Engine

---

## 📁 6. Cấu Trúc Thư Mục Toàn Dự Án (Monorepo Structure)

```text
SupperApp/
├── apps/
│   ├── api/                              # 🔌 PHÂN HỆ BACKEND REST API
│   │   ├── data/                         # Thư mục lưu trữ SQLite database cục bộ
│   │   │   └── school_intelligence.db   # File CSDL SQLite chuẩn hóa SSOT
│   │   ├── src/
│   │   │   ├── config/                   # Cấu hình biến môi trường và nạp env
│   │   │   ├── core/                     # CSDL Firestore layer, SQLite store, Auth middleware
│   │   │   ├── modules/
│   │   │   │   ├── auth/                 # Xác thực đăng nhập, phát hành JWT token
│   │   │   │   ├── classes/              # API phân tích lớp học, đối đầu 1vs1, bảng xếp hạng
│   │   │   │   ├── classroom/            # Bộ xử lý đồng bộ Google Classroom API
│   │   │   │   ├── connections/          # Quản lý kết nối Google OAuth, gia hạn token
│   │   │   │   ├── dashboard/            # API tổng hợp KPIs BGH và tính toán xu hướng
│   │   │   │   ├── meet/                 # Phân tích nhật ký tham gia Google Meet
│   │   │   │   ├── people/               # Quản lý hồ sơ học sinh 360°, giáo viên, bảng điểm
│   │   │   │   └── system/               # Kiểm tra sức khỏe, chẩn đoán hệ thống
│   │   │   └── server.ts                 # Điểm khởi động chính của Express API
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                              # 🌐 PHÂN HỆ FRONTEND WEB
│       ├── src/
│       │   ├── components/               # Các UI component dùng chung (Header, Layout, Nav)
│       │   ├── features/                 # Các màn hình nghiệp vụ chính
│       │   │   ├── classes/              # Màn hình So sánh lớp học & Đối đầu 1vs1
│       │   │   ├── connections/          # Màn hình Quản lý kết nối Google Classroom
│       │   │   ├── dashboard/            # Màn hình Bảng điều hành Ban Giám hiệu
│       │   │   ├── executive/            # Màn hình Báo cáo phân tích chuyên sâu
│       │   │   ├── login/                # Màn hình Đăng nhập & Chọn vai trò demo
│       │   │   ├── students/             # Màn hình Hồ sơ sư phạm 360° học sinh
│       │   │   ├── system/               # Màn hình Giám sát hạ tầng & CSDL
│       │   │   └── teachers/             # Màn hình Danh bạ & Tải giảng dạy giáo viên
│       │   ├── services/                 # Cấu hình gọi API (fetch wrapper)
│       │   ├── App.tsx                   # Khai báo tuyến đường Router & Theme Provider
│       │   └── main.tsx                  # Điểm gắn kết React DOM
│       ├── package.json
│       └── vite.config.ts
│
├── scripts/                              # 🛠️ BỘ SCRIPT TỰ ĐỘNG HÓA HỆ THỐNG
│   ├── dev.mjs                           # Script khởi chạy đồng thời cả Web và API
│   ├── verify-source.mjs                 # Script xác thực cấu trúc mã nguồn
│   ├── 00-check-prerequisites.ps1        # Kiểm tra môi trường Node, npm, Git
│   └── 05-deploy-api.ps1                 # Script đóng gói & deploy lên Cloud Run
│
├── docs/                                 # 📚 TÀI LIỆU HỆ THỐNG BỔ SUNG
├── DOCS.md                               # Sách trắng kiến trúc hệ thống chuyên sâu (38KB)
├── README.md                             # Tài liệu hướng dẫn tổng quan & cài đặt (file này)
├── package.json                          # Cấu hình Monorepo Workspaces gốc
└── firebase.json                         # Cấu hình triển khai Firebase Hosting & Firestore
```

---

## ⚙️ 7. Hướng Dẫn Cấu Hình Biến Môi Trường (.env)

Hệ thống có 2 file cấu hình môi trường chính:

### 🔹 1. Cấu hình Backend: `apps/api/.env`
Tạo file `apps/api/.env` bằng cách sao chép từ `apps/api/.env.example`:

```ini
# Cổng mạng Backend Express lắng nghe (mặc định: 8080)
PORT=8080

# Chế độ môi trường (development | production)
NODE_ENV=development

# Tên miền CORS cho phép Frontend truy cập
CORS_ORIGIN=http://localhost:5173

# Cấu hình Google OAuth 2.0 (Dùng khi kết nối Classroom bằng tài khoản Google)
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8080/api/connections/oauth/callback

# Cấu hình Google Workspace Domain-Wide Delegation (Tùy chọn - Dành cho toàn trường)
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=credentials/service-account.json
GOOGLE_ADMIN_EMAIL=admin@thcs-giangvo.edu.vn

# Tài khoản mặc định nhận quyền Super Admin đầu tiên
BOOTSTRAP_SUPER_ADMIN_EMAILS=09.levanbinh2003@gmail.com,admin@thcs-giangvo.edu.vn
```

### 🔹 2. Cấu hình Frontend: `apps/web/.env.local`
Tạo file `apps/web/.env.local` bằng cách sao chép từ `apps/web/.env.example`:

```ini
# Địa chỉ URL của Backend API (khi chạy dev qua proxy nội bộ Vite, để trống hoặc trỏ tới /api)
VITE_API_BASE_URL=http://localhost:8080
```

---

## 📋 8. Bảng Tra Cứu Toàn Bộ Câu Lệnh Dự Án (Scripts Cheat Sheet)

| Câu lệnh | Cấp thực thi | Chức năng chi tiết |
| :--- | :---: | :--- |
| **`npm run dev`** | **Root** | **[Khuyên Dùng]** Chạy đồng thời cả Frontend Web (5173) và Backend API (8080) |
| **`npm run dev:api`** | Root | Chỉ chạy riêng Backend API với cơ chế hot-reload `tsx watch` trên port 8080 |
| **`npm run dev:web`** | Root | Chỉ chạy riêng Frontend Web với Vite dev server trên port 5173 |
| **`npm run check`** | Root | **Kiểm tra toàn diện**: Xác thực cấu trúc + Quét lỗi TypeScript + Chạy 17 unit tests + Build thử nghiệm |
| **`npm run verify`** | Root | Chạy script kiểm tra sự tồn tại của các file cấu hình và tính hợp lệ của mã nguồn |
| **`npm run typecheck`** | Root | Quét và kiểm tra lỗi kiểu dữ liệu TypeScript trên toàn bộ Monorepo |
| **`npm run test`** | Root | Chạy toàn bộ 17 bài Unit Test nghiệp vụ của Backend |
| **`npm run build`** | Root | Đóng gói bản phát hành Production cho cả Web (`dist/`) và API (`dist/`) |
| **`npm --workspace apps/web run build`** | Web | Đóng gói tài nguyên tĩnh (HTML/CSS/JS) cho Frontend Web |
| **`npm --workspace apps/api run build`** | API | Biên dịch TypeScript của Backend sang thư mục `apps/api/dist/` |
| **`npm --workspace apps/api run start`** | API | Khởi chạy máy chủ API ở chế độ Production từ file đã biên dịch |

---

## 🐙 9. Cẩm Nang Git Thường Dùng (Đồng Bộ & Quản Trị Code)

### 📥 1. Lấy Code Mới Nhất Về Máy (Pull)
```powershell
# Cập nhật code mới nhất từ nhánh main trên GitHub
git pull origin main
```

### 📤 2. Lưu & Đẩy Code Lên GitHub (Commit & Push)
```powershell
# Bước 1: Xem danh sách các file vừa chỉnh sửa
git status

# Bước 2: Thêm các file thay đổi vào hàng đợi (staging)
git add .

# Bước 3: Ghi nhận phiên bản kèm thông điệp rõ ràng
git commit -m "feat: hoan thien tinh nang moi"

# Bước 4: Đẩy code lên nhánh main trên kho chứa từ xa
git push origin main
```

> 💡 **Mẹo: Đẩy nhanh toàn bộ thay đổi bằng 1 dòng lệnh duy nhất:**
> ```powershell
> git add . ; git commit -m "update: dong bo code moi nhat" ; git push
> ```

### 🔄 3. Hoàn Tác / Khôi Phục Khi Có Lỗi (Undo Changes)
```powershell
# Hủy toàn bộ thay đổi chưa commit trên các file có sẵn
git restore .

# Xóa các file mới tạo chưa được git theo dõi (untracked)
git clean -fd

# Xem 5 commit gần nhất
git log --oneline -n 5
```

---

## 🧪 10. Kiểm Thử & Đảm Bảo Chất Lượng (QA & Testing)

Hệ thống được bảo vệ bởi bộ bài kiểm thử tự động (Automated Test Suite) nghiêm ngặt:

```powershell
# Chạy toàn bộ bài test nghiệp vụ
npm run test
```

### 📋 Danh Sách Các Bài Kiểm Thử Tự Động (17/17 Passed):
1. **Phân quyền RBAC & Bảo mật**:
   - `principal no infra`: Hiệu trưởng không có quyền truy cập cấu hình hạ tầng.
   - `admin infra`: Quản trị viên hệ thống có quyền truy cập hạ tầng.
   - `super admin has all`: Super Admin có đầy đủ 100% năng lực hệ thống.
   - `school admin can manage connections and catalog`: Quản trị trường có quyền kết nối và quản lý danh mục.
   - `teacher has student data but no executive bi or infra`: Giáo viên xem được học sinh của mình nhưng không có quyền xem báo cáo chiến lược cấp cao.
   - `department head has student data and alerts`: Tổ trưởng có quyền xem dữ liệu học sinh và nhận cảnh báo môn học.
   - `data viewer is read-only dashboard`: Quan sát viên chỉ có quyền xem Dashboard ở chế độ đọc.
2. **Cơ sở dữ liệu SQLite ACID & Persistence Engine**:
   - Thêm mới và đọc lại tài liệu chính xác (Insert & Read).
   - Hỗ trợ gộp thuộc tính tài liệu với `{ merge: true }`.
   - Hỗ trợ phân cấp Subcollection lồng nhau.
   - Truy vấn tài liệu với mệnh đề `where`, `orderBy`, và `limit`.
   - Xóa tài liệu an toàn.
   - Thực thi các thao tác ghi hàng loạt (Atomic Batch Write).
3. **Tính toán Thống kê & Single Source of Truth (SSOT)**:
   - Gộp các khoảng thời gian chuyên cần Meet (Merge intervals).
   - Nhận diện chính xác vai trò Giáo viên qua mọi định dạng tài khoản.
   - Nhận diện chính xác vai trò Học sinh.
   - **Cam kết SSOT**: Đảm bảo số lượng giáo viên/học sinh trong CSDL luôn khớp tuyệt đối 100% với số liệu trên Dashboard và danh sách chi tiết.

---

## 🚀 11. Hướng Dẫn Triển Khai Production (Cloud Run & Firebase)

### 🔹 1. Triển Khai Frontend Lên Firebase Hosting
```powershell
# 1. Build bundle web
npm --workspace apps/web run build

# 2. Triển khai lên CDN Firebase Hosting
firebase deploy --only hosting
```

### 🔹 2. Triển Khai Backend Lên Google Cloud Run
Sử dụng script đóng gói container tự động có sẵn trong thư mục `scripts`:
```powershell
powershell .\scripts\05-deploy-api.ps1
```
Script sẽ tự động:
- Đóng gói container Docker cho Backend Express.
- Đẩy container image lên Google Artifact Registry.
- Triển khai dịch vụ lên Google Cloud Run với cấu hình auto-scaling từ 0 đến 10 instances.

### 🔹 3. Cập Nhật Firestore Security Rules
```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

---

## 🛠️ 12. Xử Lý Sự Cố Thường Gặp (Troubleshooting & FAQ)

### ❓ 1. Lỗi cổng bị chiếm dụng: `Error: listen EADDRINUSE: address already in use :::8080`
- **Nguyên nhân**: Một tiến trình cũ của API đang chạy ngầm hoặc phần mềm khác đang chiếm cổng 8080.
- **Cách xử lý trên Windows**:
  ```powershell
  # Tìm PID tiến trình đang chiếm cổng 8080
  netstat -ano | findstr :8080
  
  # Dừng tiến trình đó (thay PID bằng số thực tế ở cột cuối cùng)
  taskkill /PID <PID> /F
  ```

### ❓ 2. Access Token Google báo lỗi `invalid_grant` khi đồng bộ
- **Nguyên nhân**: Refresh Token của Google đã hết hạn (sau 7 ngày ở chế độ Google Testing) hoặc người dùng đã đổi mật khẩu tài khoản Google.
- **Cách xử lý**:
  1. Truy cập trang **Kết Nối Google** (`/connections`).
  2. Bấm **"Kết nối lại tài khoản Google"** hoặc nhập Refresh Token mới.

### ❓ 3. Lỗi khóa CSDL SQLite: `database is locked`
- **Nguyên nhân**: Có 2 cửa sổ terminal đang cùng chạy tiến trình ghi vào file database SQLite.
- **Cách xử lý**: Đóng tất cả terminal cũ và chỉ chạy duy nhất 1 câu lệnh `npm run dev`. Chế độ WAL (Write-Ahead Logging) mặc định sẽ ngăn ngừa tình trạng này.

### ❓ 4. Tại sao các ô điểm số hiển thị "Chưa có"?
- **Nguyên nhân**: Hệ thống hoạt động theo chế độ **100% Dữ liệu Thực (Zero-Mock SSOT)**. Khi giáo viên bộ môn chưa nhập điểm vào các bài tập trên Google Classroom, hệ thống sẽ để trống hoặc ghi nhận "Chưa có", tuyệt đối không tự bịa đặt điểm số giả. Ngay khi giáo viên chấm bài thật trên Classroom, nhấn **"Làm mới"** để điểm số tự động hiển thị ngay lập tức.

---

## 📚 13. Tài Liệu Kỹ Thuật Chuyên Sâu

Để tìm hiểu chi tiết hơn về các đặc tả kiến trúc, công thức toán học và các quy chuẩn kỹ thuật:

👉 **[Xem Sách Trắng Hệ Thống Chi Tiết tại DOCS.md](./DOCS.md)**
- *Mục 1*: Ma trận khả năng cung cấp dữ liệu của toàn bộ Google APIs.
- *Mục 2*: Sơ đồ dòng dữ liệu phân tầng chi tiết.
- *Mục 5*: Quy tắc chuẩn hóa mã lớp tự động (Regex Normalizer) cho trường THCS.
- *Mục 6*: Công thức tính toán chỉ số sư phạm Student Health Score.
- *Mục 7*: Hướng dẫn chi tiết từng bước tạo dự án trên Google Cloud Console & cấp quyền Workspace.

---

<p align="center">
  <strong>Trường THCS Giảng Võ — Ba Đình, Hà Nội</strong><br>
  <em>Nền tảng Quản trị Điều hành Lớp học số & Phân tích Sư phạm Thông minh</em><br>
  Bản quyền © 2024–2026 THCS Giảng Võ. Mọi quyền được bảo lưu.
</p>
