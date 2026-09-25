/**
 * MobileTabBar.tsx — thanh điều hướng dưới cùng kiểu app di động thật
 * (Ionic), pilot 2026-09-25 sau khi Sin duyệt hướng "sửa UI mobile theo
 * Ionic React" (xem demo artifact trước đó). CỐ Ý KHÔNG dùng
 * `@ionic/react-router` (package đó yêu cầu react-router-dom <7, dự án
 * đang ở v7) — tự điều hướng bằng `useNavigate`/`useLocation` của
 * react-router-dom v7 sẵn có, chỉ mượn phần HIỂN THỊ (IonTabBar/
 * IonTabButton) của Ionic.
 */
import { IonTabBar, IonTabButton, IonIcon, IonLabel, IonBadge } from '@ionic/react';
import { shieldOutline, calendarOutline, schoolOutline, personCircleOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';

interface TabDef {
  path: string;
  matchPaths: string[];
  icon: string;
  label: string;
}

// Trỏ thẳng vào ĐÚNG URL desktop đã dùng (/safety, /work-schedule/tasks,
// /classroom) — không còn "/mobile-preview/..." riêng (Sin phản hồi
// 2026-09-25 lần 2: không muốn bị dẫn sang link khác, giao diện phải tự
// đổi ngay trên URL người dùng đang mở qua `pResponsive` ở App.tsx).
// "/account" là trang mới (hồ sơ cá nhân), chưa có ở bản desktop.
const TABS: TabDef[] = [
  { path: '/safety', matchPaths: ['/', '/safety'], icon: shieldOutline, label: 'An toàn' },
  { path: '/work-schedule/tasks', matchPaths: ['/work-schedule', '/work-schedule/tasks'], icon: calendarOutline, label: 'Lịch' },
  { path: '/classroom', matchPaths: ['/classroom'], icon: schoolOutline, label: 'Lớp học số' },
  { path: '/account', matchPaths: ['/account'], icon: personCircleOutline, label: 'Cá nhân' }
];

export function MobileTabBar({ activeCount }: { activeCount?: number }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <IonTabBar
      style={{
        borderTop: '1px solid var(--mobile-line, #e5e7eb)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        position: 'fixed',
        left: '0',
        right: '0',
        bottom: '0'
      }}
    >
      {TABS.map((t) => {
        const isActive = t.matchPaths.includes(location.pathname);
        return (
          <IonTabButton key={t.path} selected={isActive} onClick={() => navigate(t.path)}>
            <IonIcon icon={t.icon} />
            <IonLabel>{t.label}</IonLabel>
            {t.label === 'An toàn' && !!activeCount && <IonBadge color="danger">{activeCount}</IonBadge>}
          </IonTabButton>
        );
      })}
    </IonTabBar>
  );
}
