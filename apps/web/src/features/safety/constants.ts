/**
 * Hằng số nghiệp vụ ổn định của module An toàn, trùng khớp
 * `apps/api/src/modules/identity/roles.ts` (CAMPUS_IDS) và
 * `apps/api/src/modules/safety/catalog.ts` (REPORTER_ROLE) — không thay
 * đổi thường xuyên nên hardcode ở client thay vì gọi API riêng, cùng cách
 * StatusChip hardcode STATE.
 */
export const CAMPUS_LABEL: Record<string, string> = {
  MAIN_CAMPUS: 'Cơ sở chính',
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

export const REPORTER_ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'victim', label: 'Người trực tiếp gặp sự cố' },
  { value: 'witness', label: 'Người chứng kiến' },
  { value: 'parent_on_behalf', label: 'Phụ huynh báo giúp con' },
  { value: 'staff', label: 'Giáo viên/nhân viên trường' },
  { value: 'other', label: 'Khác' }
];
