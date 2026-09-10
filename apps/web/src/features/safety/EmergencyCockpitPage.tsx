/**
 * EmergencyCockpitPage.tsx — Chunk B. Danh sách hồ sơ P0/P1 đang mở, style
 * khẩn cấp (banner đỏ/cam, nút to). Route: `/safety/cockpit`. Phase 1
 * KHÔNG có SLA countdown live/websocket (theo chốt của Hestia) — chỉ hiện
 * tĩnh `slaClocks.deadlineAt`, tự poll lại danh sách mỗi 30s.
 *
 * Dùng `useIncidents` thật (`./hooks/useIncidents`, Chunk A/Hestia,
 * PR #12) — trước đó dùng `useIncidentsTemp` tạm thời cùng interface,
 * đã xoá sau khi Chunk A merge.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';

import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { ConfidentialityBadge } from './components/ConfidentialityBadge';
import { useIncidents } from './hooks/useIncidents';

function formatDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
}

export default function EmergencyCockpitPage() {
  const { items, loading, error, refetch } = useIncidents({ priorities: ['P0', 'P1'] });

  // Poll lại mỗi 30s — Phase 1 chưa có websocket/live update.
  useEffect(() => {
    const timer = setInterval(refetch, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = items.filter((it) => it.state !== 'Đã đóng' && it.state !== 'Trùng' && it.state !== 'Tin rác');

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Cockpit khẩn cấp"
        subtitle="Toàn bộ hồ sơ ưu tiên P0/P1 đang mở — tự làm mới mỗi 30 giây"
        icon={<WarningAmberIcon />}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ p: 4, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : open.length === 0 ? (
        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>
              Không có hồ sơ P0/P1 nào đang mở
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {open.map((it) => (
            <Card
              key={it.incidentId}
              component={Link}
              to={`/safety/incidents/${it.incidentId}`}
              sx={{
                display: 'block',
                textDecoration: 'none',
                borderLeft: `4px solid ${it.priority === 'P0' ? '#dc2626' : '#ea580c'}`,
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                boxShadow: 'none',
                bgcolor: it.priority === 'P0' ? '#fef2f2' : '#fff7ed',
                '&:hover': { boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.08)' }
              }}
            >
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
                  <PriorityChip priority={it.priority} />
                  <StatusChip state={it.state} />
                  <ConfidentialityBadge confidentiality={it.confidentiality} redacted={it.redacted} />
                  <Chip size="small" label={it.campusId} sx={{ bgcolor: '#f8fafc', color: '#334155', fontWeight: 600, height: 24 }} />
                </Stack>
                <Typography variant="subtitle2" fontWeight={700} color="#0f172a">
                  {it.incidentId} {it.categoryLabel ? `— ${it.categoryLabel}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {it.className ? `Lớp ${it.className} — ` : ''}Chỉ huy: {it.commanderName || 'Chưa chỉ định'}
                </Typography>
                {it.slaClocks && Object.keys(it.slaClocks).length > 0 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    {Object.entries(it.slaClocks)
                      .map(([label, c]) => `${label}: hạn ${formatDateTime(c.deadlineAt)}`)
                      .join(' · ')}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
