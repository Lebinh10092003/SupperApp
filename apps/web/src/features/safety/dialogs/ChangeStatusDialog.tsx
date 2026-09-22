/**
 * ChangeStatusDialog.tsx — đổi trạng thái hồ sơ, port UI cho
 * `PATCH /api/safety/incidents/:id/status` (`transitionIncidentStatus`).
 * 12 giá trị trạng thái là CHUỖI TIẾNG VIỆT NGUYÊN VĂN (khớp `catalog.ts`
 * STATE.*), không phải mã — gửi thẳng chuỗi lên server.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';

const STATE_OPTIONS = [
  'Mới tiếp nhận',
  'Đang phân loại',
  'Khẩn cấp đang xử lý',
  'Đã giao',
  'Đang xử lý',
  'Chờ bên ngoài',
  'Đang theo dõi',
  'Đề nghị đóng',
  'Đã đóng',
  'Mở lại',
  'Trùng',
  'Tin rác'
];

export interface ChangeStatusTarget {
  incidentId: string;
  state: string;
}

export function ChangeStatusDialog({
  target,
  onClose,
  onChanged
}: {
  target: ChangeStatusTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; state: string }) => void;
}) {
  const [toState, setToState] = useState('');
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setToState('');
    setNote('');
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
    if (!target || !toState) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.patch<{ incidentId: string; state: string }>(`/api/safety/incidents/${target.incidentId}/status`, {
        toState,
        note: note.trim() || undefined,
        reason: reason.trim() || undefined,
        approvedBy: approvedBy.trim() || undefined
      });
      onChanged(result);
      handleClose();
    } catch (e: any) {
      if (isApprovalRequiredMessage(e.message)) {
        setNeedsApproval(true);
      }
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Đổi trạng thái hồ sơ</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong> — trạng thái hiện tại: <strong>{target.state}</strong>
            </Typography>
            <TextField select label="Trạng thái mới" value={toState} onChange={(e) => setToState(e.target.value)} fullWidth>
              {STATE_OPTIONS.map((s) => (
                <MenuItem key={s} value={s} disabled={s === target.state}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Ghi chú (tuỳ chọn)" value={note} onChange={(e) => setNote(e.target.value)} multiline rows={2} fullWidth />
            <TextField label="Lý do (bắt buộc với 1 số vai trò)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} fullWidth />
            {needsApproval && (
              <TextField
                label="Mã người phê duyệt (perId của Hiệu trưởng/cấp trên)"
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
          disabled={!toState || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang lưu...' : 'Xác nhận đổi trạng thái'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
