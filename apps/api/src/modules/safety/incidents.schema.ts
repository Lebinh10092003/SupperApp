import { pgTable, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * incidents — BẢN CUỐI (chốt 2026-09-09 sau khi Hestia + Killshot đọc hết
 * `safety.js` 1147 dòng, đối chiếu chéo độc lập, khớp nhau). Port từ
 * Firestore collection `incidents`.
 */
export const incidents = pgTable('incidents', {
  incidentId: text('incident_id').primaryKey(),
  campusId: text('campus_id').notNull(),
  categoryCode: text('category_code').notNull(),
  className: text('class_name'),
  suggestedClassNames: jsonb('suggested_class_names').$type<string[]>(),
  // Legacy production map classification retained in the canonical schema.
  zoneId: text('zone_id'),
  zoneIds: jsonb('zone_ids').$type<string[]>(),
  reporterRole: text('reporter_role'),
  // NULLABLE từ 2026-09-22 (Sin chốt) — sự vụ CHƯA ai tiếp nhận thì mức ưu
  // tiên để TRỐNG (trừ khi người báo tin chọn "vẫn đang diễn ra" -> P0 ngay
  // lúc tạo). Bắt buộc chọn khi tiếp nhận (acknowledgeIncident), xem
  // incident-lifecycle.ts.
  priority: text('priority'),
  confidentiality: text('confidentiality').notNull(),
  state: text('state').notNull(),
  reportIds: jsonb('report_ids').$type<string[]>(),
  commanderPerId: text('commander_per_id'),
  assignedTaskPerIds: jsonb('assigned_task_per_ids').$type<string[]>(),
  version: integer('version').notNull().default(1),
  // Ghi chú tự do lần chuyển trạng thái gần nhất (transitionIncidentStatus).
  lastNote: text('last_note'),
  // Mốc chuyển "Đề nghị đóng" — dùng tính fallback REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS
  // (3 ngày) cho phép nhân viên tự đóng nếu người báo tin không phản hồi.
  closeRequestedAt: timestamp('close_requested_at', { withTimezone: true }),
  // Giá trị là actor.perId HOẶC literal 'REPORTER' (khi người báo tin tự
  // xác nhận đóng qua confirmIncidentCloseByReporter) — KHÔNG FK cứng vì
  // có giá trị đặc biệt không phải perId thật.
  closedBy: text('closed_by'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  reporterCloseConfirmedAt: timestamp('reporter_close_confirmed_at', { withTimezone: true }),
  reopenedBy: text('reopened_by'),
  reopenedAt: timestamp('reopened_at', { withTimezone: true }),
  reopenReason: text('reopen_reason'),
  // Thang cảnh báo "chưa ai tiếp nhận" cho P2/P3 (24h/48h/72h, bổ sung
  // 2026-09-22, xem jobs/check-unclaimed-incidents.ts) — 0 = chưa báo lần
  // nào, 1/2/3 = đã báo tới đúng mốc nào rồi (chống báo lặp lại cùng 1
  // mốc). Reset về 0 khi có người tiếp nhận (không còn cần theo dõi nữa)
  // hoặc khi đổi mức ưu tiên (hạn tính lại từ đầu).
  unclaimedEscalationTier: integer('unclaimed_escalation_tier').notNull().default(0),
  // Yêu cầu huỷ tiếp nhận đang chờ duyệt (bổ sung 2026-09-22) — chỉ 1 yêu
  // cầu treo tại 1 thời điểm trên 1 sự vụ, nên không cần bảng riêng. Set
  // đủ 3 cột khi chỉ huy gọi requestCancelAcknowledgment(), xoá cả 3 khi
  // cấp trên duyệt/từ chối qua approveCancelAcknowledgment().
  cancelRequestedBy: text('cancel_requested_by'),
  cancelRequestReason: text('cancel_request_reason'),
  cancelRequestedAt: timestamp('cancel_requested_at', { withTimezone: true }),
  // Yêu cầu TỰ THAM GIA đang chờ chỉ huy duyệt (bổ sung 2026-09-25, Sin
  // chốt: "trừ tài khoản cấp cao thì ai muốn chủ động tham gia sự cố phải
  // được chỉ huy duyệt nếu vụ đã có chỉ huy"). KHÁC yêu cầu huỷ tiếp nhận
  // ở chỗ có thể có NHIỀU người cùng xin tham gia 1 lúc -> dùng mảng thay
  // vì 3 cột đơn lẻ như cancelRequested*. Hồ sơ CHƯA có chỉ huy hoặc actor
  // là cấp cao (Hiệu trưởng/Phó HT/Tổ trưởng) vẫn tham gia được NGAY, bỏ
  // qua mảng này hoàn toàn — xem joinIncident (incident-lifecycle.ts).
  pendingJoinRequests: jsonb('pending_join_requests').$type<Array<{ perId: string; reason: string; requestedAt: string }>>(),
  // "Hạn xử lý sự vụ" (bổ sung 2026-10-05, Sin: "2 hạn tiếp nhận/phân công
  // ... phải gộp là một — hạn thực sự cần là hạn xử lý sự vụ") — THAY cho
  // việc hiện riêng 2 đồng hồ SLA ack/assign (sla_clocks, vẫn giữ nguyên
  // không đổi — đo tốc độ phản hồi ban đầu, mục đích khác hẳn) ở UI chi
  // tiết hồ sơ. NULL = chưa ai đặt hạn. Người giao (Hiệu trưởng/Phó
  // HT/Tổ trưởng — xem incident.set_resolution_deadline) đặt/điều chỉnh
  // tự do, không cần lý do.
  resolutionDeadlineAt: timestamp('resolution_deadline_at', { withTimezone: true }),
  resolutionDeadlineSetBy: text('resolution_deadline_set_by'),
  // Yêu cầu GIA HẠN đang chờ duyệt — CÙNG MẪU với cancelRequested* ở trên
  // (chỉ 1 yêu cầu treo/1 lúc, 1 hồ sơ). Chỉ huy hồ sơ (BẤT KỲ cấp nào,
  // kể cả cấp thấp — Sin: "người chỉ huy mà tk cấp thấp thì cũng có thể
  // xin gia hạn") được xin, bắt buộc lý do + hạn mới đề xuất; người giao
  // (hoặc cấp cao hơn) duyệt/từ chối qua incident.approve_resolution_extension.
  extensionRequestedBy: text('extension_requested_by'),
  extensionRequestReason: text('extension_request_reason'),
  extensionProposedDeadlineAt: timestamp('extension_proposed_deadline_at', { withTimezone: true }),
  extensionRequestedAt: timestamp('extension_requested_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
});
