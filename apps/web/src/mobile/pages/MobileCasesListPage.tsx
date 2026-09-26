/**
 * MobileCasesListPage.tsx — bản mobile thật của danh sách "Sự vụ"
 * (/safety/cases), dùng antd-mobile (NavBar/SearchBar/Card/Popup) thay vì
 * tái sử dụng bảng MUI. Dữ liệu tái dùng NGUYÊN `useIncidents` (cùng
 * nguồn với bản desktop), chỉ đổi lớp hiển thị + rút gọn bộ lọc vào 1
 * Popup đáy màn hình thay vì 7 ô xếp dọc chiếm hết màn hình.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, SearchBar, Card, Tag, Popup, Button as AntButton, Selector, List, SpinLoading } from 'antd-mobile';
import { AddOutline, FilterOutline } from 'antd-mobile-icons';
import { Box, Typography, IconButton, Badge } from '@mui/material';
import { useIncidents } from '../../features/safety/hooks/useIncidents';
import { CAMPUS_IDS, CAMPUS_LABEL, STATE_OPTIONS } from '../../features/safety/constants';
import { CreateIncidentDirectDialog } from '../../features/safety/dialogs/CreateIncidentDirectDialog';
import { MobileScreenShell } from '../MobileScreenShell';
import { MobileTabBar } from '../MobileTabBar';

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  P0: { bg: '#fef2f2', fg: '#dc2626' },
  P1: { bg: '#fffbeb', fg: '#d97706' },
  P2: { bg: '#eff6ff', fg: '#1d4ed8' },
  P3: { bg: '#f1f5f9', fg: '#475569' }
};
const STATE_STYLE: Record<string, { bg: string; fg: string }> = {
  'Mới tiếp nhận': { bg: '#eff6ff', fg: '#2563eb' },
  'Đang phân loại': { bg: '#eff6ff', fg: '#2563eb' },
  'Khẩn cấp đang xử lý': { bg: '#fef2f2', fg: '#dc2626' },
  'Đã giao': { bg: '#fffbeb', fg: '#b45309' },
  'Đang xử lý': { bg: '#fffbeb', fg: '#b45309' },
  'Chờ bên ngoài': { bg: '#f5f3ff', fg: '#6d28d9' },
  'Đang theo dõi': { bg: '#f5f3ff', fg: '#6d28d9' },
  'Đề nghị đóng': { bg: '#f0fdf4', fg: '#15803d' },
  'Đã đóng': { bg: '#f1f5f9', fg: '#475569' },
  'Mở lại': { bg: '#fef2f2', fg: '#dc2626' }
};

export default function MobileCasesListPage() {
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [campusFilter, setCampusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { items, loading, error } = useIncidents({
    campusId: campusFilter[0] || undefined,
    priorities: priorityFilter.length ? priorityFilter : undefined,
    states: stateFilter.length ? stateFilter : undefined,
    searchText: searchText || undefined,
    limit: 200
  });

  const sorted = useMemo(() => [...items].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))), [items]);
  const activeFilterCount = campusFilter.length + priorityFilter.length + stateFilter.length;

  return (
    <MobileScreenShell
      header={
        <NavBar onBack={() => navigate(-1)} right={<IconButton onClick={() => setCreateOpen(true)} size="small" sx={{ color: '#2563eb' }}><AddOutline fontSize={22} /></IconButton>} style={{ background: '#fff' }}>
          Sự vụ
        </NavBar>
      }
      tabBar={<MobileTabBar />}
      contentPadding={false}
    >
      <Box sx={{ p: 2, pb: 1, display: 'flex', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <SearchBar placeholder="Tìm theo nội dung/mã sự vụ" value={searchText} onChange={setSearchText} />
        </Box>
        <Badge badgeContent={activeFilterCount} color="primary">
          <IconButton onClick={() => setFilterOpen(true)} sx={{ border: '1px solid #d1d5db', borderRadius: 2 }}>
            <FilterOutline fontSize={20} />
          </IconButton>
        </Badge>
      </Box>

      {loading && (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <SpinLoading />
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ px: 2 }}>
          {error}
        </Typography>
      )}
      {!loading && !error && sorted.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Không có sự vụ nào.
        </Typography>
      )}

      <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {sorted.map((it) => {
          const ps = it.priority ? PRIORITY_STYLE[it.priority] : PRIORITY_STYLE.P3;
          const ss = STATE_STYLE[it.state] || { bg: '#f1f5f9', fg: '#334155' };
          return (
            <Card key={it.incidentId} onClick={() => navigate(`/safety/incidents/${it.incidentId}`)} style={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b' }}>
                  {it.incidentId}
                </Typography>
                <Tag style={{ '--background-color': ps.bg, '--text-color': ps.fg } as any}>{it.priority || '—'}</Tag>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>
                {it.contentPreview || <em>(không có nội dung)</em>}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                {CAMPUS_LABEL[it.campusId] || it.campusId} · {it.categoryLabel || it.categoryCode}
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                <Tag style={{ '--background-color': ss.bg, '--text-color': ss.fg } as any}>{it.state}</Tag>
                <Typography variant="caption" color="text.secondary">
                  {it.updatedAt ? new Date(it.updatedAt).toLocaleDateString('vi-VN') : '—'}
                </Typography>
              </Box>
              {!it.commanderName && (
                <Tag color="warning" style={{ marginTop: 8 }}>
                  Chưa tiếp nhận
                </Tag>
              )}
            </Card>
          );
        })}
      </Box>

      <Popup visible={filterOpen} onMaskClick={() => setFilterOpen(false)} bodyStyle={{ borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '75vh', overflowY: 'auto' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
            Bộ lọc
          </Typography>
          <List header="Cơ sở">
            <List.Item>
              <Selector
                columns={2}
                options={CAMPUS_IDS.map((c) => ({ label: CAMPUS_LABEL[c], value: c }))}
                value={campusFilter}
                onChange={(v) => setCampusFilter(v as string[])}
              />
            </List.Item>
          </List>
          <List header="Mức ưu tiên">
            <List.Item>
              <Selector columns={4} options={PRIORITY_OPTIONS.map((p) => ({ label: p, value: p }))} value={priorityFilter} multiple onChange={(v) => setPriorityFilter(v as string[])} />
            </List.Item>
          </List>
          <List header="Trạng thái">
            <List.Item>
              <Selector columns={2} options={STATE_OPTIONS.map((s) => ({ label: s, value: s }))} value={stateFilter} multiple onChange={(v) => setStateFilter(v as string[])} />
            </List.Item>
          </List>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <AntButton
              block
              onClick={() => {
                setCampusFilter([]);
                setPriorityFilter([]);
                setStateFilter([]);
              }}
            >
              Xoá lọc
            </AntButton>
            <AntButton block color="primary" onClick={() => setFilterOpen(false)}>
              Xem kết quả
            </AntButton>
          </Box>
        </Box>
      </Popup>

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
