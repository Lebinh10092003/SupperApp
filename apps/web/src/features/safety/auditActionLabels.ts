/**
 * Toàn bộ giá trị `action` thật ghi vào audit_logs — đối chiếu trực tiếp
 * từng file backend (report-flow.ts/incident-lifecycle.ts/evidence.ts/
 * safety-query.routes.ts/directory-assignments.ts), không suy đoán. Trích
 * xuất từ AuditLogPage.tsx (desktop) ra module dùng chung để
 * MobileAuditLogPage.tsx dùng lại y hệt, không chép tay 2 nơi dễ lệch.
 */
export const ACTION_LABEL: Record<string, string> = {
  'audit.read': 'Xem nhật ký kiểm toán',
  'catalog.edit': 'Sửa danh mục/danh bạ',
  'config.grade_supervisor_assignment_edited': 'Gán giáo viên phụ trách khối',
  'config.homeroom_assignment_edited': 'Gán giáo viên chủ nhiệm',
  'evidence.download_url_issued': 'Cấp link tải minh chứng',
  'evidence.scan_infected_deleted': 'Xoá minh chứng nhiễm mã độc',
  'incident.acknowledged': 'Tự tiếp nhận (trở thành chỉ huy)',
  'incident.participant_added': 'Thêm người tham gia xử lý',
  'incident.participant_joined': 'Tự tham gia sự vụ',
  'incident.participant_left': 'Rời khỏi sự vụ',
  'incident.merged_duplicate': 'Gộp sự vụ trùng nhau',
  'incident.cancel_acknowledgment_requested': 'Yêu cầu huỷ tiếp nhận',
  'incident.acknowledgment_cancelled': 'Đã duyệt huỷ tiếp nhận',
  'incident.cancel_acknowledgment_rejected': 'Từ chối yêu cầu huỷ tiếp nhận',
  'incident.assign_commander': 'Chỉ định chỉ huy hồ sơ',
  'incident.classification_corrected': 'Đã sửa phân loại hồ sơ',
  'incident.close': 'Đóng hồ sơ',
  'incident.close_confirmed_by_reporter': 'Người báo tin xác nhận đóng hồ sơ',
  'incident.correct_classification': 'Yêu cầu sửa phân loại hồ sơ',
  'incident.priority_changed': 'Đổi mức ưu tiên',
  'incident.reassign_commander': 'Đổi chỉ huy hồ sơ',
  'incident.reopen': 'Mở lại hồ sơ',
  'incident.state_changed': 'Đổi trạng thái hồ sơ',
  'incident.view': 'Xem hồ sơ',
  'incident.view_c1_c2': 'Xem hồ sơ (C1–C2)',
  'incident.view_c3': 'Xem hồ sơ (C3)',
  'incident.view_c4': 'Xem hồ sơ (C4)',
  'incident.view_campus_comparison': 'Xem so sánh cơ sở',
  'incident.view_class_stats': 'Xem thống kê theo lớp',
  'incident.view_evidence': 'Xem minh chứng',
  'incident.view_stats': 'Xem thống kê an toàn',
  'incident.view_trend_alerts': 'Xem cảnh báo xu hướng',
  'notify.acknowledged': 'Xác nhận đã nhận thông báo',
  read: 'Xem',
  'safety.incident.created': 'Tạo hồ sơ sự cố',
  'safety.incident.homeroom_notified': 'Đã báo giáo viên chủ nhiệm',
  'safety.incident.p0_activated': 'Kích hoạt khẩn cấp P0',
  'safety.incident.p1_escalation_notified': 'Leo thang thông báo P1',
  'safety.incident.p1_no_recipients': 'P1 không có người nhận thông báo',
  'safety.report.merged': 'Gộp tin báo vào hồ sơ',
  'safety.report.received': 'Tiếp nhận tin báo',
  'safety.report.reporter_notified': 'Đã báo người báo tin',
  'safety.report.urgent_no_recipients': 'Tin khẩn không có người nhận',
  'safety.report.urgent_notified': 'Đã báo tin khẩn',
  'safety.report.view': 'Xem tin báo'
};
