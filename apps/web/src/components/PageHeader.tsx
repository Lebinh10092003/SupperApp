import { Box, Typography, Stack } from '@mui/material';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  action,
  icon
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        justifyContent: 'space-between',
        alignItems: { xs: 'flex-start', sm: 'center' },
        gap: 2,
        mb: 3,
        pb: 2.5,
        borderBottom: '1px solid #e2e8f0'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        {icon && (
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2,
              border: '1px solid #bfdbfe',
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
              color: '#2563eb',
              boxShadow: '0 2px 5px rgba(37, 99, 235, 0.08)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0
            }}
          >
            {icon}
          </Box>
        )}
        <Box>
          <Typography
            variant="h5"
            component="h1"
            fontWeight={800}
            sx={{ color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.25 }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.84rem' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      {action && (
        <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {action}
        </Stack>
      )}
    </Box>
  );
}