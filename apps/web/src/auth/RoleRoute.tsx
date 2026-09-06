import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { Box, Paper, Typography } from '@mui/material';

export function RoleRoute({
  children,
  allowedRoles
}: {
  children: ReactNode;
  allowedRoles?: string[];
}) {
  const { profile } = useAuth();
  if (!allowedRoles || allowedRoles.length === 0) {
    return <>{children}</>;
  }
  const userRole = profile?.role;
  if (!userRole || !allowedRoles.includes(userRole)) {
    return (
      <Box sx={{ p: 4, display: 'grid', placeItems: 'center', minHeight: '60vh' }}>
        <Paper sx={{ p: 4, textAlign: 'center', maxWidth: 480 }}>
          <Typography variant="h6" color="error" gutterBottom>
            Truy cập bị từ chối
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vai trò hiện tại ({userRole || 'Chưa xác định'}) không có quyền truy cập vào phân hệ này. Vui lòng liên hệ Quản trị viên để được cấp quyền.
          </Typography>
        </Paper>
      </Box>
    );
  }
  return <>{children}</>;
}
