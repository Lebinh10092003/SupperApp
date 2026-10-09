# Phân hệ Cảnh báo an toàn & Xử lý sự cố

Code: `apps/api/src/modules/safety/` (≈68 file) · `apps/web/src/features/safety/`

## 1. Mục tiêu

Cho phép học sinh, phụ huynh, giáo viên, nhân viên **báo sự cố ngay** (không cần tài khoản), để nhà trường **tiếp nhận → phân loại → giao người chỉ huy → xử lý → đóng hồ sơ** có kiểm soát thời hạn (SLA), phân quyền chặt, và có nhật ký kiểm toán không thể sửa.

## 2. Luồng nghiệp vụ tổng thể

```
Người báo tin (công khai)           Hệ thống                         Nhân sự nhà trường
 /safety/report  ─── tin báo ───►  Tạo Report + Mã tra cứu GV.xxxx
 (kèm minh chứng)                  Tự phân loại: nhóm, ưu tiên gợi ý
                                   Tạo Incident (hồ sơ) SC-xxx
                                   Tự gán GVCN / GV phụ trách khối
                                   Mở đồng hồ SLA (ack / assign)
                                   P0/P1: đẩy chuông + push + email  ─►  Chuông / Banner khẩn
                                                                          Tiếp nhận (acknowledge) → thành Chỉ huy
                                                                          Thêm người tham gia, đổi trạng thái…
 /safety/lookup ◄── tra cứu bằng mã, bổ sung thông tin         Đề nghị đóng ─► Người báo xác nhận ─► Đóng
```

### 2.1 Tiếp nhận tin báo công khai (`/safety/report`)
Không cần đăng nhập. Các trường chính:
- Cơ sở xảy ra sự việc *(bắt buộc)*; Nhóm sự cố *(bắt buộc, 20 nhóm)*; Nội dung *(bắt buộc)*.
- Tùy chọn: lớp liên quan, "Bạn là ai trong sự việc" (người gặp sự cố / chứng kiến / phụ huynh báo giúp / GV-NV / khác), khoảng thời gian xảy ra (từ–đến), email/SĐT liên hệ, ẩn danh.
- Đính kèm **tối đa 5 minh chứng**/tin báo (ảnh ≤ 8 MB, âm thanh ≤ 15 MB, video ≤ 50 MB; tổng ≤ 80 MB). File được quét virus (ClamAV) trước khi cho xem (`pending_scan → clear/infected/rejected`).
- Idempotency key chống gửi trùng khi bấm nhiều lần.
- Kết quả: **mã tra cứu công khai** dạng `GV.YYMM.NNNN`.

### 2.2 Tra cứu & bổ sung (`/safety/lookup`)
Nhập mã tra cứu → xem tình trạng xử lý → gửi **bổ sung thông tin** (`POST /reports/supplement`). Người báo tin còn nhận thông báo trạng thái và **xác nhận đã xử lý xong** (`/reports/confirm-close`).

### 2.3 Phân loại tự động
- **20 nhóm sự cố** thuộc 5 nhóm lớn: An toàn thân thể & tâm lý HS (bạo lực, xâm hại, tự hại, bắt nạt mạng, lộ thông tin, vũ khí/chất cấm, HS mất tích), Y tế (cấp cứu, nhẹ, an toàn thực phẩm), Cơ sở vật chất (cháy nổ, điện/hóa chất, công trình, thiên tai, vệ sinh, CSVC chung), An ninh & giao thông (xâm nhập, cổng trường, xe đưa đón), Khác.
- Mỗi nhóm có **ưu tiên gợi ý** (VD cháy nổ, xâm hại, tự hại, vũ khí, HS mất tích → P0).
- Tự nhận diện tên lớp trong nội dung (`classStats.detectClassNamesFromContent`) và tự gán **GVCN / giáo viên phụ trách khối** làm người liên quan.

## 3. Mức ưu tiên & SLA

| Ưu tiên | Nhãn | SLA tiếp nhận | SLA giao người | Cách tính giờ |
|---|---|---|---|---|
| P0 | Khẩn cấp | 1 phút | 1 phút | Giờ đồng hồ |
| P1 | Nghiêm trọng | 5 phút | 15 phút | Giờ đồng hồ |
| P2 | Cần xử lý | 30 phút | 120 phút | Giờ làm việc |
| P3 | Thông thường | 240 phút | 480 phút | Giờ làm việc |

- Giờ làm việc mặc định: 07:00–17:00, Thứ 2–Thứ 7, trừ ngày lễ.
- Quy tắc: **nâng mức → tính lại theo mức mới**, hạ mức **không** kéo dài thời hạn; chỉ tạm dừng đồng hồ ở trạng thái khai báo, có lý do + người duyệt.
- **Hạn xử lý sự vụ** (thêm 10/2026): Hiệu trưởng/Phó HT/Tổ trưởng đặt hạn; người xử lý xin **gia hạn**, cấp trên duyệt/từ chối.

## 4. Vòng đời hồ sơ (12 trạng thái)

`Mới tiếp nhận → Đang phân loại → (Khẩn cấp đang xử lý) → Đã giao → Đang xử lý ↔ Chờ bên ngoài / Đang theo dõi → Đề nghị đóng → Đã đóng → (Mở lại → Đang xử lý)`; nhánh cuối: `Trùng`, `Tin rác`.

Chuyển trạng thái theo bảng `ALLOWED_TRANSITIONS`; không nhảy cóc. Trạng thái kết thúc: Đã đóng, Trùng, Tin rác.

**Quy tắc đóng hồ sơ**
- Quyết định họp 07/09/2026: **người gửi tin báo xác nhận** đã xử lý xong thì đóng (mọi ưu tiên). Dự phòng: sau **3 ngày** không phản hồi, nhân sự có quyền tự đóng.
- Đóng P2/P3: Hiệu trưởng, Phó HT, Tổ trưởng (hoặc người đang tham gia đúng hồ sơ).
- Đóng P0/P1: Hiệu trưởng trực tiếp; Phó HT cần phê duyệt.
- Mở lại: Hiệu trưởng (bắt buộc lý do), Phó HT cần phê duyệt.

## 5. Hành động trên hồ sơ (màn `IncidentDetailPage`)

| Hành động | API | Ghi chú |
|---|---|---|
| Tiếp nhận (nhận xử lý) | `POST /incidents/:id/acknowledge` | Người tiếp nhận thành chỉ huy |
| Bàn giao chỉ huy | `POST /incidents/:id/commander` | HT/PHT giao cho ai cũng được; Tổ trưởng chỉ giao cấp dưới |
| Thêm người tham gia | `POST /incidents/:id/participants` | Có **gợi ý vai trò liên quan** theo nhóm sự cố |
| Xin tham gia / duyệt / từ chối / rời | `/join`, `/join-requests/:perId/approve|reject`, `/leave` | |
| Huỷ tiếp nhận (xin–duyệt) | `/cancel-acknowledgment/request|decide` | Cấp trên quyết định |
| Đổi ưu tiên | `PATCH /incidents/:id/priority` | Nâng: chỉ huy/cấp cao; hạ: bắt buộc lý do |
| Đổi trạng thái | `PATCH /incidents/:id/status` | Theo bảng chuyển trạng thái |
| Mở lại | `POST /incidents/:id/reopen` | |
| Đặt hạn xử lý / xin gia hạn / duyệt gia hạn | `/resolution-deadline*` | |
| Sửa phân loại (lớp, khu vực) | `PATCH /incidents/:id/classification` | Bắt buộc lý do |
| Gộp hồ sơ trùng | `POST /incidents/:id/merge-duplicate` | |
| Tạo hồ sơ trực tiếp (không qua tin báo) | `POST /incidents/direct` | |
| Kích hoạt P0 | `activateP0` | Hiệu trưởng, Phó HT, Trực ban, Tổ trưởng, VP, GV |
| Xem/tải minh chứng | `GET /evidence-file`, `POST /evidence-download` | Gallery trong hồ sơ |

## 6. Phân quyền (authz 8 bước, thuần logic ở `authz.ts`)

Quyền xem/sửa hồ sơ đến từ **hai đường**:
1. **Đường vai trò** (bảng `PERMISSION_MATRIX`, ràng buộc cơ sở/tổ ở bước phạm vi tổ chức và lĩnh vực):
   - **Quản lý chung**: Hiệu trưởng (toàn trường), Phó HT & Tổ trưởng (đúng cơ sở/tổ phụ trách) — xem và quản mọi hồ sơ trong phạm vi.
   - **Chuyên trách theo nhóm**: Y tế (nhóm `health`), Tư vấn tâm lý (`student_safety`), Bảo vệ (`student_safety` + `security_traffic`), CSVC (`facility` + `security_traffic`).
2. **Đường quan hệ/thời gian**: là chỉ huy hoặc người tham gia của đúng hồ sơ đó; GVCN lớp liên quan (tự được gán); **Trực ban đang trong ca** xem được mọi hồ sơ.

Giáo viên thường *không* xem được sự vụ không liên quan (quyết định 27/09/2026: "có vụ đánh nhau của lớp này thì cả trường biết hết thì không ổn").

Mức bí mật C1–C4 đã **bỏ hoàn toàn** (22/09/2026).

Danh sách cấm tuyệt đối (không vai trò nào làm được): sửa/xoá nhật ký kiểm toán, ép vượt xung đột cứng, AI tự duyệt/tự đóng/tự hạ ưu tiên.

Một số quyền khác: xem thống kê (HT, PHT); so sánh 3 cơ sở (chỉ HT); thống kê theo lớp (HT, PHT, Trực ban, Tổ trưởng); xuất dữ liệu (HT có lý do, PHT/VP cần duyệt); đọc nhật ký kiểm toán (HT, PHT, QT hệ thống, Kiểm toán).

## 7. Thông báo & leo thang

- Kênh theo độ khẩn: thường → chuông; cao/P1 → chuông + email + push; **P0 → chuông + push đồng thời** (không phụ thuộc kênh có hạn mức).
- Nội dung thông báo **chỉ chứa mã hồ sơ, mức độ, việc cần làm, liên kết** — cấm danh tính người bị ảnh hưởng, mô tả nhạy cảm, hình ảnh.
- P0/P1 yêu cầu **xác nhận (ack)**; không ack → leo thang.
- Cron `check-sla-overdue` (15'): đồng hồ SLA quá hạn → đẩy chuông cho chỉ huy + lãnh đạo/trực ban đúng cơ sở, idempotent.
- Cron `check-unclaimed-incidents` (15'): hồ sơ chưa ai tiếp nhận — P2/P3: báo Tổ trưởng lúc 24h, Tổ trưởng + lãnh đạo lúc 48h, nhắc lại 72h; P0/P1: báo ngay khi quá hạn ack.
- Người báo tin được thông báo khi trạng thái đổi (nếu để lại liên hệ).
- Web Push: đăng ký qua `POST /push-tokens`.

## 8. Các màn hình

| Màn hình | Nội dung |
|---|---|
| **Tổng quan An toàn** (`/safety`) | Thẻ thống kê, "Sự vụ của tôi" (`MyIncidentsSection`), cảnh báo xu hướng |
| **Sự vụ** (`/safety/cases`) | Danh sách hồ sơ + tin báo chờ (gộp 2 trang cũ), bộ lọc nhiều tiêu chí (ngày, ưu tiên, trạng thái, cơ sở, nhóm, lớp…), **lưu bộ lọc** (`saved-filters`), tìm kiếm tiếng Việt không dấu (`text-match`) |
| **Hồ sơ sự cố** (`/safety/incidents/:id`) | Thông tin chung, dòng thời gian, người tham gia, minh chứng, các dialog hành động (§5), liên hệ nhanh người liên quan (`ContactInfoButton`) |
| **Cần xử lý ngay** (`/safety/cockpit`) | Hồ sơ P0/P1 đang mở, badge đếm trên sidebar (`useOpenUrgentCount`); `UrgentIncidentBanner` hiện toàn app |
| **Phân tích & thống kê** (`/safety/analytics`) | Thống kê sự cố theo thời gian/nhóm/ưu tiên; **cảnh báo xu hướng**; so sánh 3 cơ sở (HT); thống kê theo lớp. Ẩn nhóm nhỏ hơn 5 để tránh lộ danh tính (`MIN_GROUP_SIZE_FOR_BREAKDOWN`) |
| **Nhật ký kiểm toán** (`/safety/audit-logs`) | Ghi mọi thao tác, bất biến |
| **Mã QR báo tin** (`ReportQrCodeButton`) | Sinh QR dẫn tới `/safety/report` để dán tại trường |
| **Chuông thông báo** (`NotificationBell`) | Thông báo trong app, đánh dấu đã đọc |

**Cảnh báo xu hướng** (`trend-alerts.ts`): ≥ 2 sự cố P0/P1 trong 5 ngày, hoặc ≥ 4 sự cố P2/P3 trong 7 ngày (theo cùng đối tượng/khu vực).

## 9. Danh bạ & phân công liên quan (do module cung cấp)

- Phân công **GVCN theo lớp** và **GV phụ trách khối** (`PUT /homeroom-assignments/:className`, `/grade-supervisor-assignments/:grade`) — dùng để tự gán người liên quan khi có sự cố.
- Hồ sơ người trong danh bạ (`/people-directory/:perId`), tìm người (`/people/search`, `/people/all`).
- **Zones/khu vực** trong trường (`campus_zones`, `zone_categories`, `campus_map_markers`).
- **Ca trực** (`duty_shifts`) và **ủy quyền** (`delegations`) trong lược đồ identity.

## 10. Nhận xét nhanh

Điểm mạnh: phân quyền nhiều lớp có lý do nghiệp vụ ghi rõ; SLA/leo thang tự động; idempotency; nội dung thông báo tối thiểu hóa dữ liệu nhạy cảm; test phong phú (≈30 file test/smoke).
Điểm cần lưu ý: xem [`REVIEW_NOTES.md`](REVIEW_NOTES.md).
