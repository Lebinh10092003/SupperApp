/**
 * MobileProfilePage.tsx — tab "Cá nhân" trong bản pilot mobile. DÙNG
 * THẲNG `useAuth()` đã có sẵn (profile/logout) — không tạo state/API
 * riêng.
 */
import { IonPage, IonContent, IonButton, IonIcon, setupIonicReact } from '@ionic/react';
import { logOutOutline, notificationsOutline, refreshOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { enablePushNotifications, isPushSubscribedOnThisDevice, isPushSupported } from '../features/safety/push-subscribe';
import { useEffect, useState } from 'react';
import { MobileTabBar } from './MobileTabBar';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

setupIonicReact({ mode: 'md' });

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
    <IonPage>
      <IonContent style={{ '--background': '#f4f5f7' } as any}>
        <div style={{ padding: '16px 16px 4px' }}>
          <h1 style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 28, margin: '0 0 18px' }}>Cá nhân</h1>
        </div>

        <div style={{ margin: '0 16px', background: '#fff', borderRadius: 16, padding: 20, display: 'flex', gap: 14, alignItems: 'center' }}>
          <div
            style={{
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
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{profile?.displayName || 'Người dùng'}</div>
            <div style={{ fontSize: 13, color: '#64748b' }}>{ROLE_LABEL[profile?.role || ''] || profile?.role}</div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile?.email}</div>
          </div>
        </div>

        <div style={{ margin: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {isPushSupported() && (
            <IonButton expand="block" fill={pushOn ? 'outline' : 'solid'} color="primary" disabled={pushOn || pushBusy} onClick={handleEnablePush}>
              <IonIcon icon={notificationsOutline} slot="start" />
              {pushOn ? 'Đã bật thông báo đẩy' : pushBusy ? 'Đang bật...' : 'Bật thông báo đẩy trên thiết bị này'}
            </IonButton>
          )}
          <IonButton expand="block" fill="outline" color="medium" onClick={() => window.location.reload()}>
            <IonIcon icon={refreshOutline} slot="start" />
            Làm mới dữ liệu
          </IonButton>
          <IonButton expand="block" fill="outline" color="danger" onClick={handleLogout}>
            <IonIcon icon={logOutOutline} slot="start" />
            Đăng xuất
          </IonButton>
        </div>
      </IonContent>
      <MobileTabBar />
    </IonPage>
  );
}
