import { Chip } from '@mui/material';

// Sin chốt 2026-09-22: chip ĐẶC (solid), chữ trắng, cùng tông đỏ giảm dần
// độ đậm P0->P3 — KHÔNG còn màu vàng nhạt ở P2 (trước đây đọc nhẹ như bình
// thường, không đủ "nghiêm trọng"). "Chưa phân loại" (priority null, hồ sơ
// chưa ai tiếp nhận) dùng xám trung tính, tách biệt hẳn khỏi P3.
const PRIORITY_STYLE: Record<string, { bg: string; label: string }> = {
  P0: { bg: '#b91c1c', label: 'P0 - Đỏ' },
  P1: { bg: '#c2410c', label: 'P1 - Cam' },
  P2: { bg: '#c2680c', label: 'P2 - Cam đậm' },
  P3: { bg: '#64748b', label: 'P3 - Xám' }
};
const UNCLASSIFIED_STYLE = { bg: '#94a3b8', label: 'Chưa phân loại' };

export function PriorityChip({ priority }: { priority: 'P0' | 'P1' | 'P2' | 'P3' | null | undefined }) {
  const c = priority ? PRIORITY_STYLE[priority] || PRIORITY_STYLE.P3 : UNCLASSIFIED_STYLE;
  return (
    <Chip
      label={c.label}
      size="small"
      sx={{ bgcolor: c.bg, color: '#fff', fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}
