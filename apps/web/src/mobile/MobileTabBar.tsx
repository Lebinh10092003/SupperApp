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
  icon: string;
  label: string;
  badge?: number;
}

const TABS: TabDef[] = [
  { path: '/mobile-preview/an-toan', icon: shieldOutline, label: 'An toàn' },
  { path: '/mobile-preview/lich', icon: calendarOutline, label: 'Lịch' },
  { path: '/mobile-preview/lop-hoc-so', icon: schoolOutline, label: 'Lớp học số' },
  { path: '/mobile-preview/ca-nhan', icon: personCircleOutline, label: 'Cá nhân' }
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
        const isActive = location.pathname === t.path;
        return (
          <IonTabButton key={t.path} selected={isActive} onClick={() => navigate(t.path)}>
            <IonIcon icon={t.icon} />
            <IonLabel>{t.label}</IonLabel>
            {t.path === '/mobile-preview/an-toan' && !!activeCount && <IonBadge color="danger">{activeCount}</IonBadge>}
          </IonTabButton>
        );
      })}
    </IonTabBar>
  );
}
