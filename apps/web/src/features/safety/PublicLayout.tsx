import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { Link } from 'react-router-dom';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';

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
        py: { xs: 3, md: 5 },
        px: 2,
        position: 'relative'
      }}
    >
      <Box sx={{ position: 'absolute', top: { xs: 12, md: 20 }, right: { xs: 12, md: 24 } }}>
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
        <Box sx={{ textAlign: 'center', mb: 3.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
              color: '#ffffff',
              mb: 2,
              boxShadow: '0 6px 16px rgba(220, 38, 38, 0.28)'
            }}
          >
            <ShieldOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            THCS Giảng Võ
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#dc2626', mt: 0.5, fontSize: '1rem' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.84rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {children}
      </Box>
    </Box>
  );
}
