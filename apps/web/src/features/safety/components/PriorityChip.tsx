import { Chip } from '@mui/material';

const PRIORITY_STYLE: Record<string, { bg: string; fg: string; border: string; label: string }> = {
  P0: { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca', label: 'P0 - Đỏ' },
  P1: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa', label: 'P1 - Cam' },
  P2: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a', label: 'P2 - Vàng' },
  P3: { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0', label: 'P3 - Xám' }
};

export function PriorityChip({ priority }: { priority: 'P0' | 'P1' | 'P2' | 'P3' }) {
  const c = PRIORITY_STYLE[priority] || PRIORITY_STYLE.P3;
  return (
    <Chip
      label={c.label}
      size="small"
      sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}
