/**
 * MobileTabBar.tsx — thanh điều hướng dưới cùng, dùng component `TabBar`
 * thật của thư viện antd-mobile (không tự dựng tay nữa).
 *
 * LỊCH SỬ 3 LẦN SỬA THẤT BẠI TRƯỚC ĐÓ (2026-09-26, tự dựng tay bằng
 * `<button>` + CSS `position`) — giữ lại để không lặp lại:
 *  1. `IonTabButton` của @ionic/react tự bóc `onClick` khi đứng ngoài
 *     `<IonTabs>` → bấm không chạy.
 *  2. `position:fixed` + `transform:translateZ(0)` (ép layer GPU) — Sin
 *     xác nhận trên iPhone thật VẪN bị trôi/kẹt khi cuộn chạm (lỗi nền
 *     tảng iOS Safari với fixed + cuộn quán tính, không phải lỗi code).
 *  3. `position:sticky` — hết trôi khi cuộn, nhưng Sin chỉ ra ĐÚNG:
 *     sticky ở CUỐI nội dung trang chỉ "dính" khi cuộn TỚI gần đó, không
 *     hiện xuyên suốt như 1 thanh điều hướng thật phải có — sai bản chất
 *     yêu cầu (phải LUÔN ở đáy màn hình bất kể cuộn tới đâu).
 *
 * FIX ĐÚNG KIẾN TRÚC: bỏ hẳn CSS `position` tự chế — component này giờ
 * THUẦN HIỂN THỊ, không tự định vị gì cả. Nó được đặt làm phần tử cuối
 * cùng (không cuộn) trong `MobileScreenShell.tsx` — 1 khung flex-column
 * cao đúng 100dvh, vùng nội dung MỚI là phần cuộn (overflow-y:auto),
 * thanh tab nằm NGOÀI vùng cuộn nên không bao giờ cần "dính"/"cố định"
 * bằng CSS position nữa — luôn ở đáy, không jank, không phụ thuộc hành vi
 * cuộn quán tính của bất kỳ trình duyệt nào.
 */
import type { ReactNode } from 'react';
import { TabBar } from 'antd-mobile';
import { CheckShieldOutline, CalendarOutline, UserOutline } from 'antd-mobile-icons';
import { SchoolOutline } from './icons/SchoolOutline';
import { useLocation, useNavigate } from 'react-router-dom';

interface TabDef {
  path: string;
  matchPaths: string[];
  icon: ReactNode;
  title: string;
}

// Trỏ thẳng vào ĐÚNG URL desktop đã dùng (/safety, /work-schedule/tasks,
// /classroom) — không có "/mobile-preview/..." riêng (Sin: không muốn bị
// dẫn sang link khác, giao diện phải tự đổi ngay trên URL đang mở).
// "/account" là trang mới (hồ sơ cá nhân), chưa có ở bản desktop.
const TABS: TabDef[] = [
  { path: '/safety', matchPaths: ['/', '/safety'], icon: <CheckShieldOutline />, title: 'An toàn' },
  { path: '/work-schedule/tasks', matchPaths: ['/work-schedule', '/work-schedule/tasks'], icon: <CalendarOutline />, title: 'Lịch' },
  { path: '/classroom', matchPaths: ['/classroom'], icon: <SchoolOutline />, title: 'Lớp học số' },
  { path: '/account', matchPaths: ['/account'], icon: <UserOutline />, title: 'Cá nhân' }
];

export function MobileTabBar({ activeCount }: { activeCount?: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = TABS.find((t) => t.matchPaths.includes(location.pathname));

  return (
    <TabBar activeKey={activeTab?.path} onChange={(key) => navigate(key)} safeArea style={{ borderTop: '1px solid #e5e7eb', flexShrink: 0 }}>
      {TABS.map((t) => (
        <TabBar.Item key={t.path} icon={t.icon} title={t.title} badge={t.path === '/safety' && activeCount ? activeCount : undefined} />
      ))}
    </TabBar>
  );
}
