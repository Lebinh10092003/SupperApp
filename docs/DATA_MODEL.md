# Mô hình dữ liệu (PostgreSQL)

Nguồn sự thật: `apps/api/drizzle/0000_canonical_baseline.sql` (baseline chốt từ schema production ngày 06/10/2026) và các file `*.schema.ts` trong `apps/api/src/modules/*/`. Bản đối chiếu máy đọc được: `apps/api/schema/canonical-schema.json`.

> Trước đây tài liệu này mô tả cây Firestore `siSchools/{schoolId}/…`. Mô hình đó **không còn dùng**.

## Nguyên tắc

1. **Mỗi trường = một deployment = một database Postgres.** Không multi-tenant, không có tenant registry. Điểm trường chính và các phân hiệu dùng chung một database, phân biệt bằng cột `campus_id` (`MAIN_CAMPUS`, `CAMPUS_1`, `CAMPUS_2`). Xem `apps/api/src/core/db/README.md`.
2. **Một pool kết nối, một Drizzle instance** (`core/db/pool.ts`, `client.ts`). Module nghiệp vụ luôn import `db`, không tự tạo `Pool`.
3. **Migration chỉ đi tiến** trong `apps/api/drizzle/`. `drizzle-legacy/` chỉ để tham khảo lịch sử. Database production hiện có được "adopt" baseline bằng `db:adopt-baseline` sau khi qua kiểm tra fingerprint, không chạy lại DDL.
4. **Tách dữ liệu nguồn và dữ liệu tổng hợp**: dữ liệu Google gốc (`courses`, `course_*`) khác với bảng tổng hợp (`metrics_daily`, `dashboard_snapshot`, `alerts`).
5. **Người được tham chiếu bằng `per_id`** (mã người trong danh bạ), không phải `uid` Firebase. Bảng `accounts` nối `uid` ↔ `per_id`.
6. **Mã nghiệp vụ có tiền tố** (bảng `id_counters`): `CS` cơ sở, `PER` người, `TB` tin báo, `SC` sự cố, `NV` nhiệm vụ, `MC` minh chứng, `GV` mã tra cứu công khai (dạng `GV.YYMM.NNNN`).

## Nhóm bảng

### 1. Định danh & phân quyền (dùng chung)

| Bảng | Vai trò | Cột chính |
|---|---|---|
| `users` | Người dùng đăng nhập app | `uid, email, role, active, display_name, scope, last_login` |
| `access_allowlist` | Email được cấp quyền đăng nhập | `id, email, role, active` |
| `accounts` | Nối Firebase `uid` ↔ `per_id` | `uid, per_id, display_name, email` |
| `assignments` | Gán vai trò nghiệp vụ `R.*` | `per_id, role_id, campus_id, domain, from_date, to_date` |
| `people_directory` | Danh bạ liên hệ | `per_id, email, phone, display_name` |
| `duty_shifts` | Ca trực ban | `per_id, from_at, to_at` |
| `delegations` | Ủy quyền tạm thời | `to_per_id, campus_id, from_at, to_at` |
| `homeroom_assignments` | GVCN theo lớp | `class_name, per_id, name` |
| `grade_supervisor_assignments` | GV phụ trách khối | `grade, per_id, name` |
| `contact_groups`, `contact_group_members` | Sổ danh bạ nhóm | `group_id, owner_per_id, name` / `group_id, per_id` |
| `general_audit_logs` | Nhật ký thao tác quản trị | `action, actor, entity_type, entity_id, message` |
| `system_config` | Cấu hình khóa–giá trị | `key, value` |

### 2. An toàn & xử lý sự cố

| Bảng | Vai trò | Cột chính |
|---|---|---|
| `reports` | Tin báo (từ cổng công khai hoặc nhập trực tiếp) | `report_id, public_code, campus_id, category_code, content, anonymous, still_dangerous, class_name, reporter_role, occurred_*, merged_into_incident_id` |
| `report_identities` | Thông tin liên hệ người báo (tách riêng để bảo mật) | `report_id, contact_*, email, phone` |
| `report_supplements` | Bổ sung thông tin từ người báo | `report_id, content` |
| `public_codes` | Mã tra cứu công khai ↔ tin báo | `code, report_id` |
| `incidents` | Hồ sơ sự cố | `incident_id, campus_id, category_code, priority, state, commander_per_id, assigned_task_per_ids, report_ids, resolution_deadline_at, unclaimed_escalation_tier, pending_join_requests, version` + các cột yêu cầu huỷ tiếp nhận / gia hạn / mở lại |
| `sla_clocks` | Đồng hồ SLA (ack, assign) | `object_id, clock_label, priority, start_at, deadline_at, status, paused, pause_history, escalated_at` |
| `evidence` | Minh chứng đính kèm | `evidence_id, report_id, storage_path, file_type, size_bytes, scan_status, deleted` |
| `notify_requests` | Yêu cầu thông báo đa kênh | `object_id, event_type, urgency, channels, recipients, require_ack, status, ack_by, dispatch_log` |
| `admin_notifications` | Chuông thông báo trong app | `recipient_per_id, title, message, event_type, object_id, read` |
| `push_tokens` | Token Web Push | `token, per_id, user_agent` |
| `audit_logs` | Nhật ký kiểm toán an toàn (bất biến) | `occurred_at, actor_per_id, role_used, action, object_id, before, after, reason, request_id` |
| `saved_case_filters` | Bộ lọc đã lưu của người dùng | `per_id, kind, name, filter_json` |
| `idempotency_keys` | Chống xử lý trùng | `key, result` |
| `id_counters` | Bộ đếm sinh mã | `prefix, period, value` |
| `campus_zones`, `zone_categories`, `campus_map_markers` | Khu vực/bản đồ cơ sở | `zone_id, campus_id, label, polygon_percent, category_id, parent_zone_id, keywords` |

### 3. Lịch công tác & giao việc (`ltc_*`)

| Bảng | Vai trò | Cột chính |
|---|---|---|
| `ltc_events` | Lịch công tác | `title, type, priority, campus_id, scope (CAMPUS/SCHOOL_WIDE), start_at, end_at (null được), chair_per_id, participant_per_ids, external_participants, status, department_domain, approvals, version` |
| `ltc_tasks` | Giao việc | `event_id, parent_task_id (tối đa 2 cấp), title, assignee_per_id, collaborator_per_ids, start_at, due_at, status (ASSIGNED/COMPLETED), evidence_url` |
| `ltc_exam_shifts` | Ca thi, giám thị | `exam_date, session, period_label, subject, class_name, campus_id, first/second_proctor_per_id` |
| `ltc_weekly_sheet_rows` | Dòng bảng lịch tuần | `row_date, time_label, content, location, people, sort_order, linked_event_id` |
| `ltc_weekly_sheet_connection` | Liên kết Google Sheet lịch tuần | `sheet_url, connected_by_per_id` |
| `ltc_audit_logs` | Lịch sử thay đổi lịch/việc/ca thi | `entity_type, entity_id, action, actor_per_id, before, after` |

Trạng thái lịch: `DRAFT, PENDING_APPROVAL, PUBLISHED, REVISION_REQUIRED, CANCELLED`.

### 4. Lớp học số (Google Classroom / Meet)

| Bảng | Vai trò |
|---|---|
| `courses` | Khóa học Classroom, kèm số liệu tổng hợp (`submissions_*`, `completion_rate`, `on_time_rate`, `average_score`), `class_id`/`subject_id` đã ánh xạ, `sync_run_id` |
| `course_members` | Giáo viên, học sinh trong khóa (`user_id, role, email`) |
| `course_coursework`, `course_submissions` | Bài tập và bài nộp (`is_turned_in, is_late, is_graded, due_date`) |
| `course_materials`, `course_announcements`, `course_topics` | Tài liệu, thông báo, chủ đề (lưu JSON trong `data`) |
| `classes` | Lớp hành chính chuẩn (6A1…) + chỉ số tổng hợp, GVCN, sĩ số |
| `class_mappings`, `subject_mappings`, `catalog_mappings` | Ánh xạ khóa học → lớp/môn chuẩn, chuẩn hóa tên |
| `people` | Học sinh/giáo viên đồng bộ từ Workspace (`person_type, org_unit_path, class_id`) |
| `schedules`, `schedule_imports` | Thời khóa biểu và lô import (có `rolled_back`) |
| `meet_sessions`, `meet_attendance` | Phiên Meet và điểm danh |
| `alert_rules`, `alerts` | Quy tắc và cảnh báo sớm |
| `metrics_daily`, `dashboard_snapshot` | Số liệu theo ngày, snapshot KPI |
| `sync_runs` | Lịch sử đồng bộ (`type, status, courses_*`) |
| `google_connections` | Token kết nối Google |
| `subscriptions` | Đăng ký Push/Meet (chưa có logic gia hạn thật, xem `jobs/README-cron.md`) |
| `events` | Hàng đợi/lease sự kiện webhook (`source, status, lease_until, attempts`) |

## Lưu ý khi thay đổi schema

- Sửa `*.schema.ts` rồi sinh migration mới bằng `drizzle-kit generate` trong `apps/api`; không sửa `0000_canonical_baseline.sql`.
- Cập nhật manifest: `npm --workspace apps/api run db:fingerprint:update`, kiểm tra bằng `db:fingerprint`.
- Test có thể xóa dữ liệu, chỉ chạy trên database dùng một lần (xem README).
