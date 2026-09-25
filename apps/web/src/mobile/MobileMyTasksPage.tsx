/**
 * MobileMyTasksPage.tsx — tab "Lịch" trong bản pilot mobile, DÙNG DỮ LIỆU
 * THẬT qua `useTasks`/`useActor` (work-schedule) đã có sẵn — cùng nguồn
 * dữ liệu với TasksListPage.tsx bản desktop, chỉ đổi lớp hiển thị.
 */
import { useMemo } from 'react';
import { IonPage, IonContent, IonCard, IonCardContent, IonChip, IonSpinner, setupIonicReact } from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../features/work-schedule/hooks/useTasks';
import { useActor as useWorkScheduleActor } from '../features/work-schedule/hooks/useActor';
import { MobileTabBar } from './MobileTabBar';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

setupIonicReact({ mode: 'md' });

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  ASSIGNED: { bg: '#eff6ff', fg: '#1d4ed8', label: 'Mới giao' },
  IN_PROGRESS: { bg: '#fffbeb', fg: '#d97706', label: 'Đang làm' },
  PENDING_ACCEPTANCE: { bg: '#fef2f2', fg: '#dc2626', label: 'Chờ nghiệm thu' },
  COMPLETED: { bg: '#ecfdf5', fg: '#16a34a', label: 'Hoàn thành' },
  RETURNED: { bg: '#fef2f2', fg: '#dc2626', label: 'Bị trả lại' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b', label: 'Đã huỷ' }
};

function formatDue(iso?: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function MobileMyTasksPage() {
  const { actor } = useWorkScheduleActor();
  const { items, loading, error } = useTasks(actor?.perId ? { assigneePerId: actor.perId } : {});
  const navigate = useNavigate();

  const openCount = useMemo(() => items.filter((t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED').length, [items]);

  return (
    <IonPage>
      <IonContent style={{ '--background': '#f4f5f7' } as any}>
        <div style={{ padding: '16px 16px 4px' }}>
          <p style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, margin: '0 0 2px' }}>Lịch công tác</p>
          <h1 style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 28, margin: '0 0 6px' }}>Việc của tôi</h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 14px' }}>{openCount} việc đang chờ xử lý</p>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <IonSpinner />
          </div>
        )}
        {error && <p style={{ padding: 16, color: '#dc2626', fontSize: 14 }}>{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p style={{ padding: 16, color: '#64748b', fontSize: 14, textAlign: 'center' }}>Chưa có việc nào được giao cho bạn.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 100px' }}>
          {items.map((t) => {
            const s = STATUS_STYLE[t.status] || STATUS_STYLE.ASSIGNED;
            return (
              <IonCard key={t.id} button onClick={() => navigate('/work-schedule/tasks')} style={{ margin: 0, borderRadius: 16 }}>
                <IonCardContent>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, flex: 1 }}>{t.title}</div>
                    <IonChip style={{ background: s.bg, color: s.fg, fontWeight: 800, fontSize: 11.5, height: 22, margin: 0, flexShrink: 0 }}>
                      {s.label}
                    </IonChip>
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>Hạn: {formatDue(t.dueAt)}</div>
                  {t.createdByName && <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>Giao bởi: {t.createdByName}</div>}
                </IonCardContent>
              </IonCard>
            );
          })}
        </div>
      </IonContent>
      <MobileTabBar />
    </IonPage>
  );
}
