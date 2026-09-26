/**
 * MobileMyIncidentsPage.tsx — màn hình "Sự vụ của tôi", dùng component
 * antd-mobile (Tabs/SearchBar/Card/FloatingBubble) — DÙNG DỮ LIỆU THẬT
 * qua đúng hook `useIncidents` đã có sẵn (không tạo API riêng). Tự động
 * hiện thay cho bản desktop khi mở "/" hoặc "/safety" trên màn hình hẹp —
 * xem `pResponsive`/`Responsive` ở App.tsx.
 *
 * Đã BỎ HẲN @ionic/react (xem MobileTabBar.tsx để biết lý do: onClick bị
 * chặn ngoài IonTabs, CSS structure.css phá cuộn body toàn app) — đổi
 * sang antd-mobile, cùng bộ với các trang mobile khác trong app cho đồng
 * bộ (Sin: "phải tham khảo UI mobile chứ không phải áp web vào").
 */
import { useMemo, useState } from 'react';
import { Tabs, SearchBar, Card, Tag, FloatingBubble, SpinLoading } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useIncidents, type IncidentListItem } from '../features/safety/hooks/useIncidents';
import { useActor } from '../features/safety/hooks/useActor';
import { CreateIncidentDirectDialog } from '../features/safety/dialogs/CreateIncidentDirectDialog';
import { MobileScreenShell } from './MobileScreenShell';
import { MobileTabBar } from './MobileTabBar';

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
  const { actor } = useActor();
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

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
    <MobileScreenShell tabBar={<MobileTabBar activeCount={openCount} />} contentPadding={false}>
      <Box sx={{ p: 2, pb: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700 }}>
            Cảnh báo an toàn
          </Typography>
          <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25 }}>
            Sự vụ của tôi
          </Typography>
        </Box>
        {/* Sin báo thiếu lối vào xem TOÀN BỘ sự vụ (không chỉ của mình) —
            trước đây chỉ tới được qua "Quay lại danh sách" sau khi lỡ mở
            1 hồ sơ, không hợp lý. */}
        <Typography
          component="button"
          onClick={() => navigate('/safety/cases')}
          sx={{ border: 'none', background: 'none', color: '#2563eb', fontSize: 13, fontWeight: 700, p: 0, cursor: 'pointer' }}
        >
          Tất cả sự vụ ›
        </Typography>
      </Box>

      <Tabs activeKey={tab} onChange={(k) => setTab(k as 'open' | 'closed')}>
        <Tabs.Tab title={`Đang mở (${openCount})`} key="open" />
        <Tabs.Tab title="Đã xử lý" key="closed" />
      </Tabs>

      <Box sx={{ p: 2, pb: 1 }}>
        <SearchBar placeholder="Tìm theo mã hồ sơ, lớp..." value={search} onChange={setSearch} />
      </Box>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 5 }}>
          <SpinLoading />
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ px: 2 }}>
          {error}
        </Typography>
      )}
      {!loading && !error && filtered.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Không có hồ sơ nào trong mục này.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: 2, pb: 2 }}>
        {filtered.map((it: IncidentListItem) => {
          const p = it.priority ? PRIORITY_STYLE[it.priority] : PRIORITY_STYLE.P3;
          const isCommander = actor?.perId && it.commanderPerId === actor.perId;
          return (
            <Card key={it.incidentId} onClick={() => navigate(`/safety/incidents/${it.incidentId}`)} style={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  {it.incidentId}
                </Typography>
                <Tag style={{ '--background-color': p.bg, '--text-color': p.fg } as any}>{it.priority ? p.label : 'Chưa phân loại'}</Tag>
              </Box>
              <Typography variant="body1" sx={{ fontWeight: 700, my: 0.5, lineHeight: 1.35 }}>
                {it.categoryLabel || it.categoryCode}
                {it.className ? ` — lớp ${it.className}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isCommander ? 'Bạn là chỉ huy' : it.commanderName ? `Chỉ huy: ${it.commanderName}` : 'Chưa có ai tiếp nhận'}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography variant="caption" fontWeight={700}>
                  {it.state}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatRelative(it.updatedAt)}
                </Typography>
              </Box>
            </Card>
          );
        })}
      </Box>

      <FloatingBubble
        onClick={() => setCreateOpen(true)}
        style={{ '--initial-position-bottom': '84px', '--initial-position-right': '24px', '--background': '#2563eb' } as any}
      >
        <AddOutline fontSize={26} color="#fff" />
      </FloatingBubble>

      <CreateIncidentDirectDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(incidentId) => {
          setCreateOpen(false);
          navigate(`/safety/incidents/${incidentId}`);
        }}
      />
    </MobileScreenShell>
  );
}
