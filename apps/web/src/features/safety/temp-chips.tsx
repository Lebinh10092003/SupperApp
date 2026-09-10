/**
 * temp-chips.tsx — TẠM THỜI. Chunk A (Hestia) sẽ land StatusChip/
 * PriorityChip/ConfidentialityBadge thật (cùng thư mục `features/safety/`)
 * — khi đó XOÁ file này, đổi import ở IncidentDetailPage.tsx/
 * EmergencyCockpitPage.tsx sang bản thật. Interface props ở đây đã khớp
 * đúng spec Hestia chốt (state/priority/confidentiality dạng string thật,
 * KHÔNG phải code) để việc thay thế chỉ là đổi 1 dòng import.
 */
import { Chip } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';

const STATE_COLOR: Record<string, { bg: string; fg: string }> = {
  'Mới tiếp nhận': { bg: '#eff6ff', fg: '#2563eb' },
  'Đang phân loại': { bg: '#f1f5f9', fg: '#475569' },
  'Khẩn cấp đang xử lý': { bg: '#fef2f2', fg: '#dc2626' },
  'Đã giao': { bg: '#eff6ff', fg: '#2563eb' },
  'Đang xử lý': { bg: '#eff6ff', fg: '#1d4ed8' },
  'Chờ bên ngoài': { bg: '#fffbeb', fg: '#b45309' },
  'Đang theo dõi': { bg: '#f0fdfa', fg: '#0f766e' },
  'Đề nghị đóng': { bg: '#f0fdf4', fg: '#15803d' },
  'Đã đóng': { bg: '#ecfdf5', fg: '#059669' },
  'Mở lại': { bg: '#fff7ed', fg: '#c2410c' },
  Trùng: { bg: '#f8fafc', fg: '#64748b' },
  'Tin rác': { bg: '#f8fafc', fg: '#94a3b8' }
};

export function StatusChip({ state }: { state: string }) {
  const c = STATE_COLOR[state] || { bg: '#f8fafc', fg: '#64748b' };
  return <Chip size="small" label={state} sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.75rem', height: 24 }} />;
}

const PRIORITY_COLOR: Record<string, { bg: string; fg: string }> = {
  P0: { bg: '#fef2f2', fg: '#dc2626' },
  P1: { bg: '#fff7ed', fg: '#ea580c' },
  P2: { bg: '#fffbeb', fg: '#b45309' },
  P3: { bg: '#f8fafc', fg: '#64748b' }
};

export function PriorityChip({ priority }: { priority: string }) {
  const c = PRIORITY_COLOR[priority] || PRIORITY_COLOR.P3;
  return <Chip size="small" label={priority} sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 800, fontSize: '0.75rem', height: 24 }} />;
}

const CONF_COLOR: Record<string, { bg: string; fg: string }> = {
  C1: { bg: '#f8fafc', fg: '#475569' },
  C2: { bg: '#eff6ff', fg: '#2563eb' },
  C3: { bg: '#fff7ed', fg: '#c2410c' },
  C4: { bg: '#fef2f2', fg: '#dc2626' }
};

export function ConfidentialityBadge({ confidentiality, redacted }: { confidentiality: string; redacted?: boolean }) {
  if (redacted) {
    return (
      <Chip
        size="small"
        icon={<LockOutlinedIcon sx={{ fontSize: '14px !important' }} />}
        label={`${confidentiality} — đã ẩn bớt`}
        sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 700, fontSize: '0.75rem', height: 24 }}
      />
    );
  }
  const c = CONF_COLOR[confidentiality] || CONF_COLOR.C1;
  return <Chip size="small" label={confidentiality} sx={{ bgcolor: c.bg, color: c.fg, fontWeight: 700, fontSize: '0.75rem', height: 24 }} />;
}
