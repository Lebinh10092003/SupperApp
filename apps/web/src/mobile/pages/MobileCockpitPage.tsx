/**
 * MobileCockpitPage.tsx — bản mobile của "Cockpit khẩn cấp" (/safety/cockpit).
 * Nội dung gốc đã là danh sách thẻ (không bảng) nên chỉ cần đổi khung
 * (NavBar + antd-mobile Card) thay vì viết lại logic — tái dùng NGUYÊN
 * `useIncidents({priorities:['P0','P1']})`.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavBar, Card, SpinLoading } from 'antd-mobile';
import { Box, Chip, Typography } from '@mui/material';
import { useIncidents } from '../../features/safety/hooks/useIncidents';
import { CAMPUS_LABEL, SLA_CLOCK_LABEL } from '../../features/safety/constants';
import { MobileScreenShell } from '../MobileScreenShell';
import { MobileTabBar } from '../MobileTabBar';

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function MobileCockpitPage() {
  const navigate = useNavigate();
  const { items, loading, refetch } = useIncidents({ priorities: ['P0', 'P1'] });

  useEffect(() => {
    const timer = setInterval(refetch, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = items.filter((it) => it.state !== 'Đã đóng' && it.state !== 'Trùng' && it.state !== 'Tin rác');

  return (
    <MobileScreenShell header={<NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>Cockpit khẩn cấp</NavBar>} tabBar={<MobileTabBar />}>
      {loading ? (
        <Box sx={{ display: 'grid', placeItems: 'center', py: 6 }}>
          <SpinLoading />
        </Box>
      ) : open.length === 0 ? (
        <Card>
          <Typography variant="body1" fontWeight={700} align="center" sx={{ py: 3 }}>
            Không có hồ sơ P0/P1 nào đang mở
          </Typography>
        </Card>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {open.map((it) => (
            <Card
              key={it.incidentId}
              onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}
              style={{
                cursor: 'pointer',
                borderLeft: `4px solid ${it.priority === 'P0' ? '#dc2626' : '#ea580c'}`,
                background: it.priority === 'P0' ? '#fef2f2' : '#fff7ed'
              }}
            >
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                <Chip size="small" label={it.priority} sx={{ bgcolor: it.priority === 'P0' ? '#dc2626' : '#ea580c', color: '#fff', fontWeight: 700 }} />
                <Chip size="small" label={it.state} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} />
                <Chip size="small" label={CAMPUS_LABEL[it.campusId] || it.campusId} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} />
              </Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {it.incidentId} {it.categoryLabel ? `— ${it.categoryLabel}` : ''}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {it.className ? `Lớp ${it.className} — ` : ''}Chỉ huy: {it.commanderName || 'Chưa chỉ định'}
              </Typography>
              {it.slaClocks && Object.keys(it.slaClocks).length > 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  {Object.entries(it.slaClocks)
                    .map(([label, c]) => `${SLA_CLOCK_LABEL[label] || label}: hạn ${formatDateTime(c.deadlineAt)}`)
                    .join(' · ')}
                </Typography>
              )}
            </Card>
          ))}
        </Box>
      )}
    </MobileScreenShell>
  );
}
