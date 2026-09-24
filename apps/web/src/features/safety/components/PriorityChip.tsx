import { Chip } from '@mui/material';

// Sin chốt 2026-09-22: chip ĐẶC (solid), chữ trắng, cùng tông đỏ giảm dần
// độ đậm P0->P3 — KHÔNG còn màu vàng nhạt ở P2 (trước đây đọc nhẹ như bình
// thường, không đủ "nghiêm trọng"). "Chưa phân loại" (priority null, hồ sơ
// chưa ai tiếp nhận) dùng xám trung tính, tách biệt hẳn khỏi P3.
//
// Sin chốt 2026-09-24: nhãn phải ghi theo MỨC ĐỘ NGHIÊM TRỌNG, không phải
// tên màu ("P2 - Cam đậm" không nói lên được gì) — khớp PRIORITY_LABEL bên
// backend (catalog.ts). Ở cột danh sách chỉ hiện gọn "P0"/"P1"/"P2"/"P3"
// (prop `compact`), vào trang chi tiết mới hiện đủ nghĩa.
const PRIORITY_STYLE: Record<string, { bg: string; label: string }> = {
  P0: { bg: '#b91c1c', label: 'P0 — Khẩn cấp' },
  P1: { bg: '#c2410c', label: 'P1 — Nghiêm trọng' },
  P2: { bg: '#c2680c', label: 'P2 — Cần xử lý' },
  P3: { bg: '#64748b', label: 'P3 — Thông thường' }
};
const UNCLASSIFIED_STYLE = { bg: '#94a3b8', label: 'Chưa phân loại' };

export function PriorityChip({
  priority,
  compact = false
}: {
  priority: 'P0' | 'P1' | 'P2' | 'P3' | null | undefined;
  /** true = chỉ hiện "P0"/"P1"/... (dùng ở cột danh sách), false = hiện đủ nghĩa (trang chi tiết). */
  compact?: boolean;
}) {
  const c = priority ? PRIORITY_STYLE[priority] || PRIORITY_STYLE.P3 : UNCLASSIFIED_STYLE;
  const label = compact ? priority || '—' : c.label;
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: c.bg, color: '#fff', fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}
