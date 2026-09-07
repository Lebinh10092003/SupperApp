# 🏫 THCS Giảng Võ — School Classroom Intelligence Platform

> **Nền tảng quản trị điều hành lớp học số & phân tích sư phạm thông minh**  
> Dành cho Ban Giám hiệu, Giáo viên và Quản trị viên trường THCS Giảng Võ.

---

## ⚡ 1. Khởi Chạy Dự Án Bằng 1 Câu Lệnh Duy Nhất

### 🚀 Chạy Hàng Ngày (1 Câu Lệnh Duy Nhất)
```powershell
npm run dev
```
> Lệnh này tự động khởi chạy đồng thời cả **Backend API (port 8080)** và **Frontend Web (port 5173)** trong 1 cửa sổ Terminal duy nhất.

### 🌐 Địa Chỉ Truy Cập Sau Khi Chạy:
- **Frontend Web**: [http://localhost:5173](http://localhost:5173) *(Giao diện Quản trị Ban Giám hiệu & Giáo viên)*
- **Backend API**: [http://localhost:8080](http://localhost:8080) *(Kiểm tra sức khỏe: [http://localhost:8080/health](http://localhost:8080/health))*

---

### 📦 Cài Đặt Lần Đầu Tiên (Khi mới tải code về máy):
```powershell
# 1. Cài đặt toàn bộ thư viện dependencies
npm install

# 2. Tạo file cấu hình môi trường từ mẫu có sẵn
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Khởi chạy dự án
npm run dev
```

---

## 🐙 2. Các Câu Lệnh Git Thường Dùng (Cập Nhật & Đồng Bộ Code)

### 📥 2.1. Cập Nhật Code Mới Nhất Về Máy (Pull)
```powershell
# Cập nhật code mới nhất từ nhánh main
git pull origin main

# Hoặc lệnh rút gọn (nếu đang ở nhánh main)
git pull
```

### 📤 2.2. Lưu & Đẩy Code Lên GitHub / Remote (Commit & Push)
```powershell
# Bước 1: Xem các file vừa sửa đổi
git status

# Bước 2: Thêm toàn bộ các thay đổi vào hàng đợi
git add .

# Bước 3: Ghi nhận phiên bản với lời nhắn mô tả công việc
git commit -m "feat: cap nhat tinh nang moi"

# Bước 4: Đẩy code lên nhánh main trên GitHub
git push origin main
```

> 💡 **Mẹo: Cập nhật & đẩy code nhanh bằng 1 dòng duy nhất:**
> ```powershell
> git add . ; git commit -m "update: dong bo code moi nhat" ; git push
> ```

### 🔄 2.3. Hủy / Hoàn Tác Thay Đổi (Khi muốn quay lại trạng thái cũ)
```powershell
# Hủy toàn bộ thay đổi chưa commit trên các file
git restore .

# Xóa các file mới tạo chưa được git theo dõi (untracked)
git clean -fd

# Xem lịch sử 5 commit gần nhất
git log --oneline -n 5
```

### 🌿 2.4. Làm Việc Với Nhánh (Branch)
```powershell
# Xem danh sách các nhánh hiện có
git branch

# Tạo nhánh mới và chuyển ngay sang nhánh đó
git checkout -b feature/ten-tinh-nang

# Chuyển về lại nhánh chính
git checkout main
```

---

## 📋 3. Bảng Tra Cứu Các Câu Lệnh Dự Án (Scripts Cheat Sheet)

| Câu lệnh | Chức năng chi tiết |
| :--- | :--- |
| **`npm run dev`** | **[Khuyên dùng]** Chạy đồng thời cả Web (5173) và API (8080) với 1 lệnh duy nhất |
| **`npm run dev:api`** | Chạy riêng Backend API (cơ chế hot-reload `tsx watch` trên port 8080) |
| **`npm run dev:web`** | Chạy riêng Frontend Web với Vite trên port 5173 |
| **`npm run check`** | Kiểm tra toàn diện hệ thống: verify cấu trúc + typecheck + unit tests + build |
| **`npm run typecheck`** | Quét và kiểm tra lỗi TypeScript trên toàn bộ dự án |
| **`npm run test`** | Chạy toàn bộ bài Unit Test nghiệp vụ của Backend |
| **`npm run build`** | Đóng gói Production bundle cho cả Web và API |

---

## 📚 4. Tài Liệu Chi Tiết Về Hệ Thống

Toàn bộ tài liệu chuyên sâu về **Kiến trúc hệ thống**, **Ma trận Google API**, **Phân quyền RBAC**, **Kết nối Google Workspace DWD**, và **Hướng dẫn triển khai Production** đã được lưu trữ đầy đủ tại:

👉 **[Xem chi tiết tại DOCS.md](./DOCS.md)**
