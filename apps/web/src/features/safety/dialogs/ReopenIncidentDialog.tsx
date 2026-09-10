/**
 * ReopenIncidentDialog.tsx — mở lại hồ sơ đã đóng, port UI cho
 * `POST /api/safety/incidents/:id/reopen` (`reopenIncident`). CHỈ nên hiện
 * nút này khi `incident.state === 'Đã đóng'` (kiểm tra ở nơi gọi, xem
 * IncidentDetailPage.tsx) — dialog không tự kiểm tra lại điều kiện đó.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';

export interface ReopenIncidentTarget {
  incidentId: string;
}

export function ReopenIncidentDialog({
  target,
  onClose,
  onChanged
}: {
  target: ReopenIncidentTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; state: string }) => void;
}) {
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setReason('');
    setApprovedBy('');
    setNeedsApproval(false);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!target || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ incidentId: string; state: string }>(`/api/safety/incidents/${target.incidentId}/reopen`, {
        reason: reason.trim(),
        approvedBy: approvedBy.trim() || undefined
      });
      onChanged(result);
      handleClose();
    } catch (e: any) {
      if (isApprovalRequiredMessage(e.message)) setNeedsApproval(true);
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Mở lại hồ sơ đã đóng</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong> sẽ chuyển về trạng thái <strong>Mở lại</strong>.
            </Typography>
            <TextField label="Lý do mở lại (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={3} fullWidth required />
            {needsApproval && (
              <TextField
                label="Mã người phê duyệt (perId của Hiệu trưởng)"
                value={approvedBy}
                onChange={(e) => setApprovedBy(e.target.value)}
                fullWidth
                autoFocus
              />
            )}
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={!reason.trim() || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: '#dc2626', color: '#fff', '&:hover': { bgcolor: '#b91c1c' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang xử lý...' : 'Xác nhận mở lại hồ sơ'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
