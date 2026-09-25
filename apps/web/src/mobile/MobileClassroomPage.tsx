/**
 * MobileClassroomPage.tsx — tab "Lớp học số" trong bản pilot mobile.
 * Bản đọc-nhanh (read-only), gọi thẳng `GET /api/classroom` — cùng nguồn
 * dữ liệu với ClassroomPage.tsx bản desktop, chỉ đổi lớp hiển thị và bỏ
 * các thao tác quản trị (đồng bộ/xoá/gán lớp) vốn không phù hợp trên
 * điện thoại.
 */
import { useEffect, useState } from 'react';
import { IonPage, IonContent, IonCard, IonCardContent, IonChip, IonSpinner, IonIcon, setupIonicReact } from '@ionic/react';
import { openOutline } from 'ionicons/icons';
import { api } from '../services/api';
import { MobileTabBar } from './MobileTabBar';
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

setupIonicReact({ mode: 'md' });

interface CourseItem {
  id: string;
  name: string;
  section?: string;
  courseState?: string;
  alternateLink?: string;
  className?: string;
  classId?: string;
}

export default function MobileClassroomPage() {
  const [items, setItems] = useState<CourseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ items: CourseItem[] }>('/api/classroom')
      .then((x) => setItems(x.items || []))
      .catch(() => setError('Không tải được danh sách lớp học.'))
      .finally(() => setLoading(false));
  }, []);

  const activeCount = items.filter((c) => c.courseState === 'ACTIVE').length;

  return (
    <IonPage>
      <IonContent style={{ '--background': '#f4f5f7' } as any}>
        <div style={{ padding: '16px 16px 4px' }}>
          <p style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, margin: '0 0 2px' }}>Google Classroom</p>
          <h1 style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 28, margin: '0 0 6px' }}>Lớp học số</h1>
          <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 14px' }}>{activeCount} lớp đang mở</p>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <IonSpinner />
          </div>
        )}
        {error && <p style={{ padding: 16, color: '#dc2626', fontSize: 14 }}>{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p style={{ padding: 16, color: '#64748b', fontSize: 14, textAlign: 'center' }}>Chưa có lớp học nào được đồng bộ.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 100px' }}>
          {items.map((c) => {
            const active = c.courseState === 'ACTIVE';
            return (
              <IonCard key={c.id} style={{ margin: 0, borderRadius: 16 }}>
                <IonCardContent>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, flex: 1 }}>{c.name}</div>
                    <IonChip
                      style={{
                        background: active ? '#ecfdf5' : '#f1f5f9',
                        color: active ? '#059669' : '#64748b',
                        fontWeight: 800,
                        fontSize: 11.5,
                        height: 22,
                        margin: 0,
                        flexShrink: 0
                      }}
                    >
                      {active ? 'Đang mở' : c.courseState || '—'}
                    </IonChip>
                  </div>
                  {c.section && <div style={{ fontSize: 13, color: '#64748b', marginTop: 6 }}>{c.section}</div>}
                  {(c.className || c.classId) && (
                    <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>Đã gán lớp: {c.className || c.classId}</div>
                  )}
                  {c.alternateLink && (
                    <a
                      href={c.alternateLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12.5, color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                    >
                      Mở Google Classroom <IonIcon icon={openOutline} style={{ fontSize: 13 }} />
                    </a>
                  )}
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
