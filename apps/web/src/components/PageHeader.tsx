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
        borderBottom: '1px solid #e4e4e7'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
        {icon && (
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: 1.5,
              border: '1px solid #e4e4e7',
              bgcolor: '#f4f4f5',
              color: '#18181b',
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
            fontWeight={700}
            sx={{ color: '#09090b', letterSpacing: '-0.025em', lineHeight: 1.2 }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: '#71717a', mt: 0.5, fontSize: '0.84rem' }}>
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