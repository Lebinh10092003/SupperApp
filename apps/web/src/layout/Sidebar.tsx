import { useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GROUP_DISPLAY_ORDER, useVisibleNavGroups } from './nav-data';
import { useOpenUrgentCount } from '../features/safety/hooks/useOpenUrgentCount';
import { UserMenu } from './UserMenu';

const BADGE_STYLES: Record<string, string> = {
  LIVE: 'bg-red-50 text-red-600 border-red-200',
  BETA: 'bg-amber-50 text-amber-700 border-amber-200'
};
const BADGE_DEFAULT = 'bg-blue-50 text-blue-600 border-blue-200';

/** Nội dung sidebar dùng chung cho cả MobileSheet (drawer tạm thời trên di
 * động) và bản desktop cố định (xem AppShell.tsx) — y hệt `drawerContent`
 * cũ trong AppShell.tsx (bản MUI), chỉ đổi lớp hiển thị sang shadcn/
 * Tailwind. Logic lọc vai trò/nhóm gấp-mở giữ nguyên 100%.
 *
 * `collapsed`/`onToggleCollapsed` — nút rút gọn kiểu template (chỉ bản
 * desktop cố định dùng, xem AppShell.tsx; MobileSheet không truyền 2 prop
 * này nên mặc định luôn hiển thị đầy đủ). Khi thu gọn: ẩn toàn bộ nhãn
 * chữ, các NHÓM được "làm phẳng" thành 1 cột icon duy nhất (không còn
 * Collapsible ẩn/hiện) vì flyout lồng nhau khi thu gọn phức tạp không
 * tương xứng lợi ích — tooltip khi hover thay thế nhãn chữ. */
export function Sidebar({
  onNavigate,
  onOpenSearch,
  collapsed = false,
  onToggleCollapsed
}: {
  onNavigate?: () => void;
  onOpenSearch: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const visibleGroups = useVisibleNavGroups();
  const openUrgentCount = useOpenUrgentCount();
  // Badge "Cần xử lý ngay" (/safety/cockpit) đổi từ chữ tĩnh "P0/P1" sang
  // SỐ THẬT đang mở (Sin chốt 2026-10-02) — các badge khác (LIVE/BETA/MỚI...)
  // vẫn giữ nguyên chữ tĩnh từ nav-data.tsx.
  const resolveBadge = (item: { path: string; badge?: string }): { text: string; style: string } | null => {
    if (item.path === '/safety/cockpit') {
      if (!openUrgentCount) return null;
      return { text: String(openUrgentCount), style: 'bg-red-50 text-red-600 border-red-200' };
    }
    if (!item.badge) return null;
    return { text: item.badge, style: BADGE_STYLES[item.badge] ?? BADGE_DEFAULT };
  };

  // Menu cha gấp/mở — Mr Tiến phản hồi 2026-09-21: sidebar hiện quá nhiều
  // mục cùng lúc, người mới khó dùng. Chỉ TỰ MỞ SẴN đúng 1 nhóm chứa trang
  // đang xem (tính 1 lần lúc mount qua lazy initializer, không tự đổi khi
  // điều hướng trong phiên — người dùng có thể tự mở thêm nhóm khác mà
  // không bị sập lại nhóm đang xem), các nhóm còn lại gấp lại.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    const activeGroup = visibleGroups.find((g) => g.items.some((it) => it.path === location.pathname));
    for (const g of visibleGroups) initial[g.groupTitle] = g === activeGroup;
    if (!activeGroup) initial[GROUP_DISPLAY_ORDER[0]!] = true;
    return initial;
  });
  const toggleGroup = (groupTitle: string) => setOpenGroups((prev) => ({ ...prev, [groupTitle]: !prev[groupTitle] }));

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center bg-white text-[#0f172a]">
        <div className="flex w-full flex-col items-center gap-2 border-b border-slate-100 p-3">
          <img src="/logo-truong-transparent.png" alt="Logo trường" className="h-8 w-auto shrink-0 object-contain" />
          {onToggleCollapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onToggleCollapsed}
                  className="flex size-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#0f172a]"
                  aria-label="Mở rộng sidebar"
                >
                  <PanelLeftOpen className="size-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Mở rộng sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onOpenSearch}
              className="mt-3 flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300"
              aria-label="Tìm kiếm điều hành"
            >
              <Search className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Tìm kiếm điều hành (⌘K)</TooltipContent>
        </Tooltip>

        <nav className="flex w-full flex-1 flex-col items-center overflow-y-auto px-2 py-3">
          {visibleGroups.map((group, groupIdx) => (
            <div key={group.groupTitle} className={cn('flex w-full flex-col items-center gap-1', groupIdx > 0 && 'mt-2 border-t border-slate-100 pt-2')}>
              {group.items.map((item) => {
                const isSelected = location.pathname === item.path;
                const badge = resolveBadge(item);
                return (
                  <Tooltip key={item.path}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          onNavigate?.();
                        }}
                        className={cn(
                          'relative flex size-10 items-center justify-center rounded-lg transition-colors',
                          isSelected ? 'bg-secondary text-primary' : 'text-slate-500 hover:bg-slate-100 hover:text-[#0f172a]'
                        )}
                      >
                        {item.icon}
                        {badge && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="w-full border-t border-slate-200 bg-slate-50 p-2.5">
          <UserMenu collapsed />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-white text-[#0f172a]">
      {/* Brand Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <img src="/logo-truong-transparent.png" alt="Logo trường" className="h-10 w-auto shrink-0 object-contain" />
        <div className="min-w-0 flex-1 overflow-hidden">
          <p className="truncate text-sm font-extrabold tracking-tight text-[#0f172a]">Trường THCS Giảng Võ</p>
          <span className="mt-0.5 inline-block truncate rounded px-[0.21rem] py-[0.04rem] text-xs font-bold tracking-wide text-primary bg-secondary">
            SuperApp
          </span>
        </div>
        {onToggleCollapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onToggleCollapsed}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-[#0f172a]"
                aria-label="Thu gọn sidebar"
              >
                <PanelLeftClose className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Thu gọn sidebar</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Quick Search Trigger */}
      <div className="px-4 pt-3 pb-1">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-500 transition-colors hover:border-slate-300"
        >
          <span className="flex items-center gap-2">
            <Search className="size-3.5" />
            Tìm kiếm điều hành...
          </span>
          <kbd className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs text-slate-400">⌘K</kbd>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        {visibleGroups.map((group) => {
          const groupHasActiveItem = group.items.some((it) => it.path === location.pathname);
          const isOpen = !!openGroups[group.groupTitle];
          return (
            <div key={group.groupTitle} className="mb-1">
              <Collapsible open={isOpen} onOpenChange={() => toggleGroup(group.groupTitle)}>
                <CollapsibleTrigger
                  className={cn(
                    'flex w-full items-center justify-between gap-1 rounded-md px-[0.3rem] py-1.5 text-left text-xs font-medium transition-colors hover:bg-slate-100 hover:text-[#0f172a]',
                    groupHasActiveItem ? 'text-primary' : 'text-slate-400'
                  )}
                >
                  <span className="min-w-0 flex-1">{group.groupTitle}</span>
                  <ChevronDown className={cn('size-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {group.items.map((item) => {
                    const isSelected = location.pathname === item.path;
                    const badge = resolveBadge(item);
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          onNavigate?.();
                        }}
                        className={cn(
                          'mb-1 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                          isSelected
                            ? 'border-blue-200 bg-secondary font-bold text-[#1d4ed8] shadow-[0_1px_2px_rgba(37,99,235,0.05)]'
                            : 'border-transparent font-medium text-slate-700 hover:bg-slate-100 hover:text-[#0f172a]'
                        )}
                      >
                        <span className={cn('shrink-0', isSelected ? 'text-primary' : 'text-slate-500')}>{item.icon}</span>
                        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                        {badge && (
                          <Badge variant="outline" className={cn('h-[18px] shrink-0 px-1 text-xs font-bold', badge.style)}>
                            {badge.text}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>
          );
        })}
      </nav>

      {/* User Session Footer */}
      <UserMenu />
    </div>
  );
}
