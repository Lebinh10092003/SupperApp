/**
 * NotificationBell.tsx — chuông thông báo trong cổng nội bộ, port lại từ
 * `adminNotify.js` (Firebase) sang gọi thẳng
 * `GET /api/safety/notifications` + `POST /api/safety/notifications/:id/read`
 * đã có sẵn (safety-query.routes.ts). Badge số chưa đọc + tự làm mới mỗi
 * 30 giây, khớp đúng hành vi bản gốc ghi trong CLAUDE.md dự án.
 */
import { useEffect, useState } from 'react';
import { Badge, Box, IconButton, Menu, MenuItem, Typography, Divider, CircularProgress } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import { api } from '../../../services/api';

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
      // Trước đây KHÔNG xử lý nhánh này — bấm thông báo gắn với tin báo
      // (chưa/hoặc đã từng là hồ sơ) không làm gì cả, chỉ đánh dấu đã đọc
      // (Sin phản hồi 2026-09-11: "bấm vào mục nào thì phải trỏ được về
      // mục đó"). Tin báo có thể đã được gộp vào hồ sơ từ trước khi actor
      // bấm xem — gọi GET /reports/:id để biết chắc, rồi điều hướng đúng
      // nơi: hồ sơ đã gộp (có trang chi tiết đầy đủ) hoặc bảng "Tin báo chờ
      // xử lý" lọc sẵn xuống đúng dòng đó (chưa có trang chi tiết riêng cho
      // tin báo).
      try {
        const r = await api.get<{ reportId: string; mergedIntoIncidentId: string | null }>(`/api/safety/reports/${n.objectId}`);
        if (r.mergedIntoIncidentId) {
          navigate(`/safety/incidents/${r.mergedIntoIncidentId}`);
        } else {
          navigate(`/safety/reports/pending?q=${encodeURIComponent(n.objectId)}`);
        }
      } catch {
        navigate(`/safety/reports/pending?q=${encodeURIComponent(n.objectId)}`);
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
