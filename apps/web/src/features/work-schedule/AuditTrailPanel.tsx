/**
 * AuditTrailPanel.tsx — panel "Lịch sử" nhúng vào dialog chi tiết lịch
 * công tác/công việc, đọc `GET /api/work-schedule/audit-logs`. Dùng
 * chung cho cả `EventDetailDialog` (EventsListPage.tsx) và
 * `TaskDetailDialog` (TasksListPage.tsx) — đặt file riêng thay vì viết
 * lặp lại 2 lần.
 */
import { useEffect, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, CircularProgress, Stack, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import { api } from '../../services/api';

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorPerId: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  'event.created': 'Tạo lịch',
  'event.updated_for_revision': 'Sửa lại sau khi bị yêu cầu chỉnh sửa',
  'event.status_changed': 'Đổi trạng thái',
  'event.published': 'Ban hành (duyệt xong)',
  'event.approval_step': 'Duyệt 1 bước (chờ bước tiếp theo)',
  'task.created': 'Giao việc',
  'task.status_changed': 'Đổi trạng thái',
  'task.accepted': 'Nghiệm thu',
  'task.returned': 'Trả lại'
};

export function AuditTrailPanel({ entityType, entityId }: { entityType: 'event' | 'task'; entityId: string }) {
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    api
      .get<{ items: AuditLogEntry[] }>(`/api/work-schedule/audit-logs?entityType=${entityType}&entityId=${entityId}`)
      .then((res) => {
        if (!cancelled) setItems(res.items || []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Không tải được lịch sử.');
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  return (
    <Accordion sx={{ boxShadow: 'none', border: '1px solid #e2e8f0', borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <HistoryIcon fontSize="small" sx={{ color: '#64748b' }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Lịch sử{items ? ` (${items.length})` : ''}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {error && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}
        {!items && !error && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={18} />
          </Box>
        )}
        {items && items.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Chưa có nhật ký nào.
          </Typography>
        )}
        {items && items.length > 0 && (
          <Stack spacing={1}>
            {items.map((log) => (
              <Box key={log.id} sx={{ pb: 1, borderBottom: '1px solid #f1f5f9', '&:last-child': { borderBottom: 'none', pb: 0 } }}>
                <Typography variant="body2" fontWeight={600}>
                  {ACTION_LABEL[log.action] || log.action}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {log.actorPerId} — {new Date(log.createdAt).toLocaleString('vi-VN')}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
