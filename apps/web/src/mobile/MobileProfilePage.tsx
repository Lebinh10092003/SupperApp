/**
 * MobileProfilePage.tsx — tab "Cá nhân". DÙNG THẲNG `useAuth()` đã có sẵn
 * (profile/logout) — không tạo state/API riêng. Đã bỏ @ionic/react, đổi
 * sang antd-mobile.
 */
import { useEffect, useState } from 'react';
import { Button } from 'antd-mobile';
import { BellOutline, RedoOutline } from 'antd-mobile-icons';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { enablePushNotifications, isPushSubscribedOnThisDevice, isPushSupported } from '../features/safety/push-subscribe';
import { MobileScreenShell } from './MobileScreenShell';
import { MobileTabBar } from './MobileTabBar';

const ROLE_LABEL: Record<string, string> = {
  SYSTEM_SUPER_ADMIN: 'Quản trị viên cấp cao nhất',
  SCHOOL_ADMIN: 'Hiệu trưởng',
  SYSTEM_ADMIN: 'Quản trị hệ thống',
  PRINCIPAL: 'Hiệu trưởng',
  VICE_PRINCIPAL: 'Phó Hiệu trưởng',
  DEPARTMENT_HEAD: 'Tổ trưởng chuyên môn',
  HOMEROOM: 'GV Chủ nhiệm',
  TEACHER: 'Giáo viên'
};

export default function MobileProfilePage() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    isPushSubscribedOnThisDevice().then(setPushOn);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    const r = await enablePushNotifications();
    setPushBusy(false);
    if (r.ok) setPushOn(true);
  };

  return (
    <MobileScreenShell tabBar={<MobileTabBar />}>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
        Cá nhân
      </Typography>

      <Box sx={{ bgcolor: '#fff', borderRadius: 3, p: 2.5, display: 'flex', gap: 1.75, alignItems: 'center' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: '#2563eb',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 800,
            flexShrink: 0
          }}
        >
          {(profile?.displayName || profile?.email || 'U')[0]?.toUpperCase()}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body1" fontWeight={700}>
            {profile?.displayName || 'Người dùng'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {ROLE_LABEL[profile?.role || ''] || profile?.role}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {profile?.email}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 2 }}>
        {isPushSupported() && (
          <Button block color="primary" fill={pushOn ? 'outline' : 'solid'} disabled={pushOn || pushBusy} onClick={handleEnablePush}>
            <BellOutline style={{ verticalAlign: -2, marginRight: 6 }} />
            {pushOn ? 'Đã bật thông báo đẩy' : pushBusy ? 'Đang bật...' : 'Bật thông báo đẩy trên thiết bị này'}
          </Button>
        )}
        <Button block fill="outline" onClick={() => window.location.reload()}>
          <RedoOutline style={{ verticalAlign: -2, marginRight: 6 }} />
          Làm mới dữ liệu
        </Button>
        <Button block color="danger" fill="outline" onClick={handleLogout}>
          Đăng xuất
        </Button>
      </Box>
    </MobileScreenShell>
  );
}
