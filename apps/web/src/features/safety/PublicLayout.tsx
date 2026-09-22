import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

const EMERGENCY_NUMBERS = [
  { num: '112', label: 'Khẩn cấp' },
  { num: '113', label: 'Công an' },
  { num: '114', label: 'PCCC' },
  { num: '115', label: 'Cấp cứu' },
  { num: '111', label: 'Trẻ em' }
];

/** Nút nổi liên hệ khẩn cấp — dính bên cạnh màn hình khi CUỘN (khác banner
 * tĩnh 1 lần đầu trang). Mỗi số LUÔN kèm nhãn ngắn để biết đúng số nào gọi
 * việc gì, không chỉ có icon mập mờ — Sin phản hồi 2026-09-11: "phải đủ
 * thông tin rút gọn để biết số nào số nào chứ không phải để mỗi số". */
function EmergencyFab() {
  return (
    <Box
      role="navigation"
      aria-label="Số điện thoại khẩn cấp"
      sx={{
        position: 'fixed',
        right: 0,
        top: '60%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg,#ef4444,#b91c1c)',
        borderRadius: '14px 0 0 14px',
        boxShadow: '-3px 4px 16px rgba(0,0,0,.28)',
        overflow: 'hidden'
      }}
    >
      {EMERGENCY_NUMBERS.map((e, i) => (
        <Box
          key={e.num}
          component="a"
          href={`tel:${e.num}`}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 54,
            minHeight: 44,
            px: 1,
            py: 0.75,
            color: '#fff',
            textDecoration: 'none',
            borderBottom: i < EMERGENCY_NUMBERS.length - 1 ? '1px solid rgba(255,255,255,.22)' : 'none',
            '&:active': { bgcolor: 'rgba(255,255,255,.18)' }
          }}
        >
          <Typography sx={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.15 }}>{e.num}</Typography>
          <Typography sx={{ fontSize: '.56rem', fontWeight: 600, lineHeight: 1.15, opacity: 0.95 }}>{e.label}</Typography>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Chrome tối thiểu cho 2 trang công khai (không đăng nhập) — không AppShell/
 * sidebar, cùng tinh thần LoginPage.tsx (full-bleed Box riêng).
 */
export function PublicLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at 50% -10%, #dbeafe 0%, #eff6ff 40%, #f8fafc 100%)',
        py: { xs: 1.25, md: 2 },
        px: 2,
        position: 'relative'
      }}
    >
      <EmergencyFab />
      <Box sx={{ position: 'absolute', top: { xs: 10, md: 14 }, right: { xs: 12, md: 24 } }}>
        <Typography
          component={Link}
          to="/login"
          variant="caption"
          sx={{ color: '#64748b', fontWeight: 600, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
        >
          Đăng nhập nội bộ →
        </Typography>
      </Box>
      <Box sx={{ maxWidth: 720, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center', mb: 1.25 }}>
          <Box
            component="img"
            src="/logo-truong-transparent.png"
            alt="Logo trường"
            sx={{ display: 'inline-block', width: 'auto', height: 44, objectFit: 'contain', mb: 0.75 }}
          />
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Trường THCS Giảng Võ
          </Typography>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#dc2626', mt: 0.25, fontSize: '0.9rem' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" sx={{ color: '#64748b', mt: 0.25, display: 'block' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
