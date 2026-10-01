import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { MobileSheet } from './MobileSheet';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED } from './nav-data';

/**
 * Khung ứng dụng chính (sidebar + topbar + nội dung) — BẢN SHADCN/TAILWIND,
 * thay cho bản MUI cũ (xem lịch sử git — file cũ dùng AppBar/Drawer/List
 * của MUI). Toàn bộ logic nghiệp vụ (lọc nav theo vai trò, trạng thái đồng
 * bộ Classroom, đổi mật khẩu/thông tin cá nhân, tìm kiếm ⌘K...) được GIỮ
 * NGUYÊN 100%, chỉ tách ra các file con theo đúng từng mảng việc:
 * - nav-data.tsx — dữ liệu menu + hook lọc theo vai trò (dùng chung
 *   Sidebar + CommandPalette).
 * - Sidebar.tsx — nội dung menu (dùng chung cho MobileSheet + bản desktop
 *   cố định ở dưới).
 * - MobileSheet.tsx — drawer tạm thời trên di động (shadcn `Sheet`).
 * - Topbar.tsx — thanh header trên cùng (breadcrumb, đồng bộ Classroom,
 *   badge học kỳ, làm mới, chuông thông báo).
 * - UserMenu.tsx — avatar + menu tài khoản + 2 dialog (sửa thông tin cá
 *   nhân, đổi mật khẩu), nằm trong Sidebar.
 * - CommandPalette.tsx — tìm kiếm điều hành ⌘K/Ctrl+K (shadcn `Command`).
 *
 * Chỉ 2 mẩu state thật sự cần CHIA SẺ giữa các file con nên vẫn giữ ở đây
 * (AppShell): `mobileOpen` (nút hamburger ở Topbar mở Sheet) và `searchOpen`
 * (cả nút "Tìm kiếm điều hành..." trong Sidebar VÀ phím tắt ⌘K/Ctrl+K đều
 * phải mở được đúng 1 CommandPalette) — còn lại mỗi file tự quản lý state
 * riêng của nó.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Nút rút gọn sidebar (kiểu template) — nhớ lựa chọn giữa các phiên qua
  // localStorage, chỉ áp dụng ở bản desktop cố định (di động vẫn dùng Sheet
  // toàn chiều rộng như cũ).
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1');
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);
  const sidebarWidth = collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Topbar onOpenMobileMenu={() => setMobileOpen(true)} sidebarWidth={sidebarWidth} />

      {/* Sidebar di động (Sheet) */}
      <MobileSheet open={mobileOpen} onOpenChange={setMobileOpen} onOpenSearch={() => setSearchOpen(true)} />

      {/* Sidebar desktop cố định */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 transition-[width] duration-200 md:block"
        style={{ width: sidebarWidth }}
      >
        <Sidebar onOpenSearch={() => setSearchOpen(true)} collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} />
      </aside>

      {/* Nội dung chính — md:ml-(--sidebar-w) chừa đúng bề rộng sidebar
          desktop, cùng cách Topbar.tsx chừa chỗ bằng md:left-(--sidebar-w). */}
      <main
        className="box-border min-w-0 flex-1 p-4 pt-[calc(54px+1rem)] transition-[margin] duration-200 sm:p-6 sm:pt-[calc(54px+1.5rem)] md:ml-(--sidebar-w) md:p-[1.75rem] md:pt-[calc(58px+1.75rem)]"
        style={{ '--sidebar-w': `${sidebarWidth}px` } as CSSProperties}
      >
        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
      </main>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
