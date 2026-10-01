import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, Menu, RefreshCw, RotateCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isFermatTechAdminEmail } from '../config/adminAccess';
import { useAuth } from '../auth/AuthProvider';
import { api } from '../services/api';
import { NotificationBell } from '../features/safety/components/NotificationBell';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { getCurrentSemesterLabel, useCurrentNavItem } from './nav-data';

/** Thanh header trên cùng — y hệt <AppBar> cũ trong AppShell.tsx (bản MUI):
 * breadcrumb tiêu đề trang, pill trạng thái đồng bộ Classroom + nút Đồng
 * bộ (chỉ FermatTech), badge học kỳ, nút làm mới, chuông thông báo. Logic
 * fetch/polling trạng thái đồng bộ giữ nguyên 100%. `sidebarWidth` truyền
 * từ AppShell.tsx — đổi theo trạng thái rút gọn sidebar. */
export function Topbar({ onOpenMobileMenu, sidebarWidth }: { onOpenMobileMenu: () => void; sidebarWidth: number }) {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isFermatTechAdmin = isFermatTechAdminEmail(profile?.email);
  const currentNav = useCurrentNavItem();
  const currentPageTitle = currentNav ? currentNav.label : 'Trang chủ';

  const [syncStatus, setSyncStatus] = useState<{ connected: boolean; isSynced: boolean; courseCount: number } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchStatus = () => {
    api<any>('/api/classroom/status')
      .then((res) => setSyncStatus(res))
      .catch(() => setSyncStatus(null));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 45000);
    return () => clearInterval(interval);
  }, []);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await api<any>('/api/classroom/sync', { method: 'POST' });
      fetchStatus();
    } catch {
      // User can view errors on /connections
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <header
      className="fixed top-0 right-0 left-0 z-40 flex h-[54px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm transition-[left] duration-200 md:left-(--sidebar-w) md:h-[58px] md:px-6"
      style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="-ml-1 flex size-8 items-center justify-center rounded-md text-[#0f172a] hover:bg-slate-100 md:hidden"
          aria-label="Mở menu"
        >
          <Menu className="size-[18px]" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-primary">Giảng Võ SuperApp</span>
          <span className="text-sm text-slate-300">/</span>
          <span className="text-sm font-bold text-[#0f172a]">{currentPageTitle}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Classroom Sync Status Pill — chỉ FermatTech thấy (Sin yêu
            cầu 2026-09-21, cùng đợt ẩn các mục Google Classroom khỏi
            sidebar cho tài khoản thường). */}
        {isFermatTechAdmin && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => navigate('/connections')}
                className={cn(
                  'hidden items-center gap-2 rounded-md border px-3 py-1 transition-colors sm:flex',
                  syncStatus?.isSynced ? 'border-emerald-200 bg-emerald-50 hover:border-emerald-400' : 'border-amber-200 bg-amber-50 hover:border-amber-400'
                )}
              >
                <span
                  className={cn(
                    'size-2 rounded-full',
                    syncStatus?.isSynced ? 'bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.25)]' : 'bg-amber-500 shadow-[0_0_0_2px_rgba(245,158,11,0.25)]'
                  )}
                />
                <span className={cn('text-xs font-bold', syncStatus?.isSynced ? 'text-emerald-800' : 'text-amber-800')}>
                  {syncStatus?.isSynced ? `Classroom: ${syncStatus.courseCount} lớp` : 'Chờ đồng bộ Classroom'}
                </span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {syncStatus?.isSynced ? `Đã đồng bộ ${syncStatus.courseCount} khóa học từ Google Classroom` : 'Chưa đồng bộ dữ liệu thật từ Google Classroom. Bấm để kết nối.'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Quick Sync Button — chỉ FermatTech thấy, cùng lý do trên. */}
        {isFermatTechAdmin && (
          <Button size="sm" onClick={handleSyncNow} disabled={isSyncing} className="hidden md:inline-flex">
            {isSyncing ? <Loader2 className="size-[15px] animate-spin" /> : <RotateCw className="size-[15px]" />}
            {isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ'}
          </Button>
        )}

        {/* Academic Semester Badge */}
        <div className="hidden items-center gap-2 rounded-md border border-blue-200 bg-secondary px-3 py-1 lg:flex">
          <span className="text-xs font-bold text-[#1d4ed8]">{getCurrentSemesterLabel()}</span>
        </div>

        {/* Làm mới toàn bộ dữ liệu — Sin phản hồi 2026-09-24: mở app từ
            icon "Thêm vào Màn hình chính" trên điện thoại (chế độ
            standalone) không có nút tải lại của trình duyệt như tab
            Safari/Chrome thường -> cần 1 nút làm mới ngay trong app. */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
              aria-label="Làm mới toàn bộ dữ liệu"
            >
              <RefreshCw className="size-[18px]" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Làm mới toàn bộ dữ liệu</TooltipContent>
        </Tooltip>

        <NotificationBell />
      </div>
    </header>
  );
}
