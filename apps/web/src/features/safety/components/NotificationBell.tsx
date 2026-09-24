/**
 * NotificationBell.tsx — chuông thông báo trong cổng nội bộ, port lại từ
 * `adminNotify.js` (Firebase) sang gọi thẳng
 * `GET /api/safety/notifications` + `POST /api/safety/notifications/:id/read`
 * đã có sẵn (safety-query.routes.ts). Badge số chưa đọc + tự làm mới mỗi
 * 30 giây, khớp đúng hành vi bản gốc ghi trong CLAUDE.md dự án.
 */
import { useEffect, useState } from 'react';
import { Badge, Box, IconButton, Menu, MenuItem, Typography, Divider, CircularProgress, Button, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import { api } from '../../../services/api';
import { isPushSupported, getNotificationPermission, isPushSubscribedOnThisDevice, enablePushNotifications } from '../push-subscribe';

interface AdminNotification {
  notificationId: string;
  title: string;
  message: string;
  eventType: string | null;
  objectId: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [loading, setLoading] = useState(false);
  // Trạng thái thông báo đẩy CỦA CHÍNH THIẾT BỊ/TRÌNH DUYỆT này (bổ sung
  // 2026-09-24) — không phải trạng thái tài khoản (1 người có thể bật trên
  // điện thoại nhưng chưa bật trên máy tính, mỗi thiết bị đăng ký riêng).
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushEnabling, setPushEnabling] = useState(false);
  const [pushError, setPushError] = useState('');

  useEffect(() => {
    isPushSubscribedOnThisDevice().then(setPushSubscribed);
  }, []);

  const handleEnablePush = async () => {
    setPushEnabling(true);
    setPushError('');
    const result = await enablePushNotifications();
    setPushEnabling(false);
    if (result.ok) {
      setPushSubscribed(true);
    } else if (result.reason === 'permission_denied') {
      setPushError('Trình duyệt đã bị chặn quyền thông báo — vào cài đặt trình duyệt để bật lại.');
    } else if (result.reason === 'unsupported') {
      setPushError('Trình duyệt này không hỗ trợ thông báo đẩy.');
    } else {
      setPushError('Không bật được thông báo đẩy, thử lại sau.');
    }
  };

  const load = () => {
    api
      .get<{ items: AdminNotification[]; unreadCount: number }>('/api/safety/notifications')
      .then((res) => {
        setItems(res.items || []);
        setUnreadCount(res.unreadCount || 0);
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = (e: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(e.currentTarget);
    setLoading(true);
    load();
    setTimeout(() => setLoading(false), 300);
  };

  const handleItemClick = async (n: AdminNotification) => {
    if (!n.read) {
      try {
        await api.post(`/api/safety/notifications/${n.notificationId}/read`);
        setItems((prev) => prev.map((it) => (it.notificationId === n.notificationId ? { ...it, read: true } : it)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // im lặng — không chặn điều hướng nếu đánh dấu đã đọc thất bại
      }
    }
    setAnchorEl(null);
    if (n.objectId && n.objectId.startsWith('SC.')) {
      navigate(`/safety/incidents/${n.objectId}`);
    } else if (n.objectId && n.objectId.startsWith('TB.')) {
      // Từ 2026-09-22, submitReport() tự tạo hồ sơ NGAY lúc gửi tin — mọi
      // objectId "TB." MỚI đều đã có mergedIntoIncidentId. Nhánh này giữ lại
      // CHỈ để mở được thông báo LỊCH SỬ trước ngày đổi luồng (tin báo cũ
      // có thể chưa từng được chuyển thành hồ sơ).
      try {
        const r = await api.get<{ reportId: string; mergedIntoIncidentId: string | null }>(`/api/safety/reports/${n.objectId}`);
        if (r.mergedIntoIncidentId) {
          navigate(`/safety/incidents/${r.mergedIntoIncidentId}`);
        } else {
          navigate(`/safety/cases?q=${encodeURIComponent(n.objectId)}`);
        }
      } catch {
        navigate(`/safety/cases?q=${encodeURIComponent(n.objectId)}`);
      }
    }
  };

  return (
    <>
      <IconButton onClick={handleOpen} size="small" sx={{ color: '#64748b' }}>
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsRoundedIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={!!anchorEl}
        onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 360, maxHeight: 440 } } }}
      >
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Thông báo
          </Typography>
        </Box>
        {isPushSupported() && getNotificationPermission() !== 'denied' && (
          <Box sx={{ px: 2, pb: 1.25 }}>
            {!pushSubscribed ? (
              <Button
                size="small"
                variant="outlined"
                fullWidth
                startIcon={<NotificationsActiveRoundedIcon sx={{ fontSize: 16 }} />}
                disabled={pushEnabling}
                onClick={handleEnablePush}
                sx={{ textTransform: 'none', fontWeight: 600 }}
              >
                {pushEnabling ? 'Đang bật...' : 'Bật thông báo đẩy trên thiết bị này'}
              </Button>
            ) : (
              // Thiết bị dùng chung nhiều tài khoản (VD điện thoại chung) —
              // đăng ký thông báo đẩy của trình duyệt KHÔNG tự đổi theo
              // người vừa đăng nhập, có thể vẫn đang gắn với tài khoản
              // trước đó trên CHÍNH thiết bị này (Sin phát hiện 2026-09-24).
              // Bấm lại nút này để gán lại đúng tài khoản đang đăng nhập.
              <Button
                size="small"
                variant="text"
                fullWidth
                disabled={pushEnabling}
                onClick={handleEnablePush}
                sx={{ textTransform: 'none', fontWeight: 500, fontSize: '0.75rem', color: '#64748b' }}
              >
                {pushEnabling ? 'Đang đồng bộ...' : 'Đồng bộ lại thông báo đẩy cho tài khoản này'}
              </Button>
            )}
            {pushError && (
              <Alert severity="warning" sx={{ mt: 1, fontSize: '0.75rem', py: 0 }}>
                {pushError}
              </Alert>
            )}
          </Box>
        )}
        <Divider />
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={20} />
          </Box>
        )}
        {!loading && items.length === 0 && (
          <Box sx={{ py: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Không có thông báo nào.
            </Typography>
          </Box>
        )}
        {!loading &&
          items.map((n) => (
            <MenuItem
              key={n.notificationId}
              onClick={() => handleItemClick(n)}
              sx={{
                whiteSpace: 'normal',
                alignItems: 'flex-start',
                py: 1.25,
                bgcolor: n.read ? 'transparent' : '#eff6ff',
                borderLeft: n.read ? '3px solid transparent' : '3px solid #2563eb'
              }}
            >
              <Box>
                <Typography variant="body2" fontWeight={n.read ? 500 : 700} sx={{ color: '#0f172a' }}>
                  {n.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {n.message}
                </Typography>
                <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                  {new Date(n.createdAt).toLocaleString('vi-VN')}
                </Typography>
              </Box>
            </MenuItem>
          ))}
      </Menu>
    </>
  );
}
