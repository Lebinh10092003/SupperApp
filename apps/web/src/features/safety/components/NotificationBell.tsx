/**
 * NotificationBell.tsx — chuông thông báo trong cổng nội bộ, port lại từ
 * `adminNotify.js` (Firebase) sang gọi thẳng
 * `GET /api/safety/notifications` + `POST /api/safety/notifications/:id/read`
 * đã có sẵn (safety-query.routes.ts). Badge số chưa đọc + tự làm mới mỗi
 * 30 giây, khớp đúng hành vi bản gốc ghi trong CLAUDE.md dự án.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellRing, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';
import { isPushSupported, getNotificationPermission, isPushSubscribedOnThisDevice, enablePushNotifications } from '../push-subscribe';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

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
  const [open, setOpen] = useState(false);
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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setLoading(true);
      load();
      setTimeout(() => setLoading(false), 300);
    }
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
    setOpen(false);
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
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-slate-500">
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[0.65rem] font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-90 max-h-[440px] overflow-y-auto">
        <div className="px-2 py-1.5">
          <p className="text-sm font-bold">Thông báo</p>
        </div>
        {isPushSupported() && getNotificationPermission() !== 'denied' && (
          <div className="px-2 pb-1.5">
            {!pushSubscribed ? (
              <Button variant="outline" size="sm" disabled={pushEnabling} onClick={handleEnablePush} className="w-full font-semibold">
                <BellRing className="size-4" />
                {pushEnabling ? 'Đang bật...' : 'Bật thông báo đẩy trên thiết bị này'}
              </Button>
            ) : (
              // Thiết bị dùng chung nhiều tài khoản (VD điện thoại chung) —
              // đăng ký thông báo đẩy của trình duyệt KHÔNG tự đổi theo
              // người vừa đăng nhập, có thể vẫn đang gắn với tài khoản
              // trước đó trên CHÍNH thiết bị này (Sin phát hiện 2026-09-24).
              // Bấm lại nút này để gán lại đúng tài khoản đang đăng nhập.
              <Button variant="ghost" size="sm" disabled={pushEnabling} onClick={handleEnablePush} className="w-full text-xs text-slate-500">
                {pushEnabling ? 'Đang đồng bộ...' : 'Đồng bộ lại thông báo đẩy cho tài khoản này'}
              </Button>
            )}
            {pushError && (
              <Alert className="mt-1.5 border-amber-200 bg-amber-50 py-1.5">
                <AlertDescription className="text-xs text-amber-800">{pushError}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <DropdownMenuSeparator />
        {loading && (
          <div className="flex justify-center py-6">
            <Loader2 className="size-5 animate-spin text-slate-400" />
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="py-6 text-center">
            <p className="text-sm text-slate-500">Không có thông báo nào.</p>
          </div>
        )}
        {!loading &&
          items.map((n) => (
            <DropdownMenuItem
              key={n.notificationId}
              onClick={() => handleItemClick(n)}
              className={cn('flex-col items-start gap-0.5 border-l-[3px] py-2.5 whitespace-normal', n.read ? 'border-l-transparent' : 'border-l-primary bg-secondary')}
            >
              <p className={cn('text-sm text-[#0f172a]', n.read ? 'font-medium' : 'font-bold')}>{n.title}</p>
              <p className="block text-xs text-slate-500">{n.message}</p>
              <p className="text-xs text-slate-400">{new Date(n.createdAt).toLocaleString('vi-VN')}</p>
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
