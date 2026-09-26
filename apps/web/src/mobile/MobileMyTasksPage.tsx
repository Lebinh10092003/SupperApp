/**
 * MobileMyTasksPage.tsx — tab "Lịch", DÙNG DỮ LIỆU THẬT qua
 * `useTasks`/`useActor` (work-schedule) đã có sẵn — cùng nguồn dữ liệu
 * với TasksListPage.tsx bản desktop, chỉ đổi lớp hiển thị. Đã bỏ
 * @ionic/react, đổi sang antd-mobile (xem MobileTabBar.tsx để biết lý do).
 */
import { useMemo } from 'react';
import { Card, Tag, SpinLoading } from 'antd-mobile';
import { Box, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTasks } from '../features/work-schedule/hooks/useTasks';
import { useActor as useWorkScheduleActor } from '../features/work-schedule/hooks/useActor';
import { MobileScreenShell } from './MobileScreenShell';
import { MobileTabBar } from './MobileTabBar';

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
    <MobileScreenShell tabBar={<MobileTabBar />} contentPadding={false}>
      <Box sx={{ p: 2, pb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 700 }}>
          Lịch công tác
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25 }}>
          Việc của tôi
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {openCount} việc đang chờ xử lý
        </Typography>
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
      {!loading && !error && items.length === 0 && (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Chưa có việc nào được giao cho bạn.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, px: 2, pb: 2 }}>
        {items.map((t) => {
          const s = STATUS_STYLE[t.status] || STATUS_STYLE.ASSIGNED;
          return (
            <Card key={t.id} onClick={() => navigate('/work-schedule/tasks')} style={{ cursor: 'pointer' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 700, lineHeight: 1.35, flex: 1 }}>
                  {t.title}
                </Typography>
                <Tag style={{ '--background-color': s.bg, '--text-color': s.fg } as any}>{s.label}</Tag>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Hạn: {formatDue(t.dueAt)}
              </Typography>
              {t.createdByName && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  Giao bởi: {t.createdByName}
                </Typography>
              )}
            </Card>
          );
        })}
      </Box>
    </MobileScreenShell>
  );
}
