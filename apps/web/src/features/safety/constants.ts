/**
 * Hằng số nghiệp vụ ổn định của module An toàn, trùng khớp
 * `apps/api/src/modules/identity/roles.ts` (CAMPUS_IDS) và
 * `apps/api/src/modules/safety/catalog.ts` (REPORTER_ROLE) — không thay
 * đổi thường xuyên nên hardcode ở client thay vì gọi API riêng, cùng cách
 * StatusChip hardcode STATE.
 */
export const CAMPUS_LABEL: Record<string, string> = {
  MAIN_CAMPUS: 'Điểm trường chính',
  CAMPUS_1: 'Phân hiệu 1',
  CAMPUS_2: 'Phân hiệu 2'
};

export const CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const;

/** 12 trạng thái chuẩn (STATE trong catalog.ts) — dùng cho dropdown lọc trạng thái. */
export const STATE_OPTIONS: string[] = [
  'Mới tiếp nhận',
  'Đang phân loại',
  'Khẩn cấp đang xử lý',
  'Đã giao',
  'Đang xử lý',
  'Chờ bên ngoài',
  'Đang theo dõi',
  'Đề nghị đóng',
  'Đã đóng',
  'Mở lại',
  'Trùng',
  'Tin rác'
];

/** 3 trạng thái kết thúc (TERMINAL_STATES trong catalog.ts) — dùng để loại hồ sơ đã xong khỏi danh sách chọn gộp tin báo trùng. */
export const TERMINAL_STATES: string[] = ['Đã đóng', 'Trùng', 'Tin rác'];

/**
 * Bước chuyển hợp lệ giữa các trạng thái — port 1-1 từ
 * `apps/api/src/modules/safety/catalog.ts::ALLOWED_TRANSITIONS`. Dùng để
 * VÔ HIỆU HOÁ (không phải ẩn) các lựa chọn không hợp lệ trong dropdown đổi
 * trạng thái — trước đây cho bấm hết 12 trạng thái rồi mới báo lỗi sau khi
 * submit (Sin phản hồi 2026-09-21: "cái nào click được thì mới cho click").
 * "Trùng"/"Tin rác" cố ý để mảng rỗng — khôi phục xử lý riêng, không đi
 * qua dropdown này (khớp đúng bản gốc).
 */
export const ALLOWED_STATE_TRANSITIONS: Record<string, string[]> = {
  'Mới tiếp nhận': ['Đang phân loại', 'Khẩn cấp đang xử lý', 'Trùng', 'Tin rác'],
  'Đang phân loại': ['Khẩn cấp đang xử lý', 'Đã giao', 'Trùng', 'Tin rác'],
  'Khẩn cấp đang xử lý': ['Đã giao', 'Đang xử lý', 'Đang theo dõi'],
  'Đã giao': ['Đang xử lý', 'Chờ bên ngoài'],
  'Đang xử lý': ['Chờ bên ngoài', 'Đang theo dõi', 'Đề nghị đóng'],
  'Chờ bên ngoài': ['Đang xử lý', 'Đang theo dõi'],
  'Đang theo dõi': ['Đang xử lý', 'Đề nghị đóng'],
  'Đề nghị đóng': ['Đã đóng', 'Đang xử lý'],
  'Đã đóng': ['Mở lại'],
  'Mở lại': ['Đang xử lý', 'Đang theo dõi'],
  Trùng: [],
  'Tin rác': []
};

export const REPORTER_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'victim', label: 'Người trực tiếp gặp sự cố' },
  { value: 'witness', label: 'Người chứng kiến' },
  { value: 'parent_on_behalf', label: 'Phụ huynh báo giúp con' },
  { value: 'staff', label: 'Giáo viên/nhân viên trường' },
  { value: 'other', label: 'Khác' }
];

/** 2 mốc thời hạn song song mỗi mức (ack/assign) — khớp key thật trong
 * incident.slaClocks. Tên gọi (Sin chốt 2026-10-02): "SLA" không ai hiểu,
 * đổi hẳn tiếng Việt mô tả đúng từng mốc đang đo gì. */
export const SLA_CLOCK_LABEL: Record<string, string> = {
  ack: 'Hạn tiếp nhận xử lý',
  assign: 'Hạn phân công người xử lý'
};

/** SlaClockStatus (sla.ts backend): 'running' | 'paused' | 'met' | 'overdue'. */
export const SLA_STATUS_LABEL: Record<string, string> = {
  running: 'Đang chạy',
  paused: 'Đang tạm dừng',
  met: 'Đã hoàn thành đúng hạn',
  overdue: 'Đã quá hạn'
};

/** Sắp đến hạn — tính ở client (backend không có trạng thái riêng cho mức
 * này), dưới ngưỡng này coi là "sắp đến hạn" để tô vàng cảnh báo sớm. */
const APPROACHING_DEADLINE_MS = 2 * 60 * 60 * 1000;

export type SlaClockVisualTone = 'overdue' | 'met' | 'approaching' | 'normal' | 'paused';

/** Màu theo đúng yêu cầu (Sin chốt 2026-10-02): quá hạn = đỏ, đúng hạn/đã
 * xong = xanh, sắp đến hạn = vàng, còn lại = bình thường. */
export function getSlaClockTone(clock: { deadlineAt: string; status: string }, now: Date = new Date()): SlaClockVisualTone {
  if (clock.status === 'overdue') return 'overdue';
  if (clock.status === 'met') return 'met';
  if (clock.status === 'paused') return 'paused';
  const msLeft = new Date(clock.deadlineAt).getTime() - now.getTime();
  if (msLeft <= APPROACHING_DEADLINE_MS) return 'approaching';
  return 'normal';
}

export const SLA_CLOCK_TONE_CLASS: Record<SlaClockVisualTone, string> = {
  overdue: 'text-red-600',
  met: 'text-emerald-600',
  approaching: 'text-amber-600',
  normal: 'text-slate-600',
  paused: 'text-slate-400'
};
