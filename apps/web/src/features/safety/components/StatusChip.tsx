import { Chip } from '@mui/material';

/**
 * `state` là chuỗi TIẾNG VIỆT NGUYÊN VĂN lưu thật trong DB (không phải mã
 * code) — xem `STATE` trong apps/api/src/modules/safety/catalog.ts. Map
 * theo đúng 12 giá trị đó, giá trị lạ (chưa từng thấy) vẫn hiển thị được
 * (fallback xám) thay vì vỡ giao diện.
 */
const STATE_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  'Mới tiếp nhận': { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' },
  'Đang phân loại': { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' },
  'Khẩn cấp đang xử lý': { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  'Đã giao': { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  'Đang xử lý': { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  'Chờ bên ngoài': { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  'Đang theo dõi': { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  'Đề nghị đóng': { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  'Đã đóng': { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' },
  'Mở lại': { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  'Trùng': { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' },
  'Tin rác': { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' }
};

export function StatusChip({ state }: { state: string }) {
  const c = STATE_COLOR[state] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Chip
      label={state}
      size="small"
      sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}
