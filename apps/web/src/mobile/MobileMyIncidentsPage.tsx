/**
 * MobileMyIncidentsPage.tsx — pilot màn hình "Sự vụ của tôi" theo phong
 * cách Ionic, DÙNG DỮ LIỆU THẬT qua đúng hook `useIncidents` đã có sẵn
 * (KHÔNG tạo API/hook riêng — tái dùng nguyên logic đang chạy ở
 * MyIncidentsSection.tsx, chỉ đổi lớp hiển thị). Tự động hiện thay cho
 * bản desktop khi mở "/" hoặc "/safety" trên màn hình hẹp — xem
 * `pResponsive`/`Responsive` ở App.tsx (không còn URL riêng).
 */
import { useMemo, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonCard,
  IonCardContent,
  IonChip,
  IonFabButton,
  IonFab,
  IonIcon,
  IonSpinner,
  setupIonicReact
} from '@ionic/react';
// CSS thật của Ionic — CỐ Ý import ngay trong file của route lazy-load
// này (không import ở main.tsx toàn cục) để reset CSS của Ionic KHÔNG
// lẫn vào các trang MUI khác, chỉ áp dụng khi chunk này được tải.
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

setupIonicReact({ mode: 'md' });
import { addOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { useIncidents, type IncidentListItem } from '../features/safety/hooks/useIncidents';
import { useActor } from '../features/safety/hooks/useActor';
import { MobileTabBar } from './MobileTabBar';
import { useIonicBodyScrollFix } from '../hooks/useIonicBodyScrollFix';

const TERMINAL_STATES = new Set(['Đã đóng', 'Trùng', 'Tin rác']);

const PRIORITY_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  P0: { bg: '#fef2f2', fg: '#dc2626', label: 'P0 — Khẩn cấp' },
  P1: { bg: '#fffbeb', fg: '#d97706', label: 'P1 — Nghiêm trọng' },
  P2: { bg: '#eff6ff', fg: '#1d4ed8', label: 'P2 — Cần xử lý' },
  P3: { bg: '#f1f5f9', fg: '#475569', label: 'P3 — Thông thường' }
};

function formatRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffH = Math.round(diffMs / 3_600_000);
  if (diffH < 1) return 'vừa xong';
  if (diffH < 24) return `${diffH} giờ trước`;
  return d.toLocaleDateString('vi-VN');
}

export default function MobileMyIncidentsPage() {
  useIonicBodyScrollFix();
  const { actor } = useActor();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  // Tái dùng NGUYÊN hook thật — cùng nguồn dữ liệu với bản desktop
  // (MyIncidentsSection.tsx), không phải dữ liệu giả lập cho demo.
  const { items, loading, error } = useIncidents({ onlyMine: true, limit: 500 });

  const filtered = useMemo(() => {
    let rows = items.filter((it) => (tab === 'open' ? !TERMINAL_STATES.has(it.state) : TERMINAL_STATES.has(it.state)));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((it) => it.incidentId.toLowerCase().includes(q) || (it.categoryLabel || '').toLowerCase().includes(q) || (it.className || '').toLowerCase().includes(q));
    }
    return rows;
  }, [items, tab, search]);

  const openCount = items.filter((it) => !TERMINAL_STATES.has(it.state)).length;

  return (
    <IonPage>
      <IonContent style={{ '--background': '#f4f5f7' } as any}>
        <div style={{ padding: '16px 16px 4px' }}>
          <p style={{ fontSize: 13, color: '#2563eb', fontWeight: 600, margin: '0 0 2px' }}>Cảnh báo an toàn</p>
          <h1 style={{ fontFamily: 'inherit', fontWeight: 800, fontSize: 28, margin: '0 0 14px' }}>Sự vụ của tôi</h1>
          <IonSegment value={tab} onIonChange={(e) => setTab((e.detail.value as 'open' | 'closed') || 'open')}>
            <IonSegmentButton value="open">
              <IonLabel>Đang mở ({openCount})</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="closed">
              <IonLabel>Đã xử lý</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <IonSearchbar
          value={search}
          onIonInput={(e) => setSearch(e.detail.value || '')}
          placeholder="Tìm theo mã hồ sơ, lớp..."
          debounce={200}
        />

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <IonSpinner />
          </div>
        )}
        {error && <p style={{ padding: 16, color: '#dc2626', fontSize: 14 }}>{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p style={{ padding: 16, color: '#64748b', fontSize: 14, textAlign: 'center' }}>Không có hồ sơ nào trong mục này.</p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 12px 100px' }}>
          {filtered.map((it: IncidentListItem) => {
            const p = it.priority ? PRIORITY_STYLE[it.priority] : PRIORITY_STYLE.P3;
            const isCommander = actor?.perId && it.commanderPerId === actor.perId;
            return (
              <IonCard key={it.incidentId} button onClick={() => navigate(`/safety/incidents/${it.incidentId}`)} style={{ margin: 0, borderRadius: 16 }}>
                <IonCardContent>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: '#64748b', fontWeight: 600 }}>{it.incidentId}</span>
                    <IonChip style={{ background: p.bg, color: p.fg, fontWeight: 800, fontSize: 11.5, height: 22, margin: 0 }}>
                      {it.priority ? p.label : 'Chưa phân loại'}
                    </IonChip>
                  </div>
                  <div style={{ fontSize: 15.5, fontWeight: 700, margin: '6px 0', lineHeight: 1.35 }}>
                    {it.categoryLabel || it.categoryCode}
                    {it.className ? ` — lớp ${it.className}` : ''}
                  </div>
                  <div style={{ fontSize: 13, color: '#64748b' }}>
                    {isCommander ? 'Bạn là chỉ huy' : it.commanderName ? `Chỉ huy: ${it.commanderName}` : 'Chưa có ai tiếp nhận'}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700 }}>{it.state}</span>
                    <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatRelative(it.updatedAt)}</span>
                  </div>
                </IonCardContent>
              </IonCard>
            );
          })}
        </div>

        <IonFab vertical="bottom" horizontal="end" style={{ bottom: 84 }}>
          <IonFabButton color="primary" onClick={() => navigate('/safety/report')}>
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>
      <MobileTabBar activeCount={openCount} />
    </IonPage>
  );
}
