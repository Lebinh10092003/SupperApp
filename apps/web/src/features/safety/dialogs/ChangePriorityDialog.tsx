/**
 * ChangePriorityDialog.tsx — đổi mức ưu tiên hồ sơ, port UI cho
 * `PATCH /api/safety/incidents/:id/priority` (`changeIncidentPriority`).
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 — Đỏ (nguy hiểm tức thời tính mạng/sức khỏe)' },
  { value: 'P1', label: 'P1 — Cam (nguy cơ nghiêm trọng / leo thang nhanh)' },
  { value: 'P2', label: 'P2 — Vàng (cần phối hợp, không nguy hiểm tức thời)' },
  { value: 'P3', label: 'P3 — Xanh (nguy cơ thông thường / phòng ngừa)' }
];

export interface ChangePriorityTarget {
  incidentId: string;
  priority: string;
}

export function ChangePriorityDialog({
  target,
  onClose,
  onChanged
}: {
  target: ChangePriorityTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; priority: string }) => void;
}) {
  const [toPriority, setToPriority] = useState('');
  const [reason, setReason] = useState('');
  const [approvedBy, setApprovedBy] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setToPriority('');
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
    if (!target || !toPriority) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.patch<{ incidentId: string; priority: string }>(`/api/safety/incidents/${target.incidentId}/priority`, {
        toPriority,
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
      <DialogTitle sx={{ fontWeight: 700 }}>Đổi mức ưu tiên hồ sơ</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong> — ưu tiên hiện tại: <strong>{target.priority}</strong>
            </Typography>
            <TextField select label="Mức ưu tiên mới" value={toPriority} onChange={(e) => setToPriority(e.target.value)} fullWidth>
              {PRIORITY_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value} disabled={p.value === target.priority}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
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
          disabled={!toPriority || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang lưu...' : 'Xác nhận đổi ưu tiên'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
