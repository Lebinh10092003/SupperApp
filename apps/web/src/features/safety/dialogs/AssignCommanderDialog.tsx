/**
 * AssignCommanderDialog.tsx — chỉ định/đổi chỉ huy hồ sơ, port UI cho
 * `POST /api/safety/incidents/:id/commander` (`assignCommander`). Dùng
 * `PersonPicker` để chọn đúng `perId` thay vì gõ tay (tránh gõ sai mã).
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { PersonPicker, type PersonOption } from '../PersonPicker';
import { isApprovalRequiredMessage } from './dialog-utils';

export interface AssignCommanderTarget {
  incidentId: string;
  commanderPerId?: string | null;
  commanderName?: string | null;
}

export function AssignCommanderDialog({
  target,
  onClose,
  onChanged
}: {
  target: AssignCommanderTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; commanderPerId: string }) => void;
}) {
  const [commander, setCommander] = useState<PersonOption | null>(null);
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setCommander(null);
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
    if (!target || !commander) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ incidentId: string; commanderPerId: string }>(`/api/safety/incidents/${target.incidentId}/commander`, {
        commanderPerId: commander.perId,
        reason: reason.trim() || undefined,
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
      <DialogTitle sx={{ fontWeight: 700 }}>Chỉ định chỉ huy hồ sơ</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong>
              {target.commanderName ? (
                <>
                  {' '}
                  — chỉ huy hiện tại: <strong>{target.commanderName}</strong>
                </>
              ) : (
                ' — chưa có chỉ huy.'
              )}
            </Typography>
            <PersonPicker label="Chỉ huy mới" value={commander} onChange={setCommander} />
            <TextField label="Lý do (tuỳ chọn)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} fullWidth />
            {needsApproval && (
              <TextField
                label="Mã người phê duyệt (perId của cấp trên)"
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
          disabled={!commander || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang lưu...' : 'Xác nhận chỉ định'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
