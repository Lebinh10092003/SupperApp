/**
 * CorrectClassificationDialog.tsx — sửa lớp liên quan của 1 hồ sơ ĐÃ TẠO,
 * port UI cho `PATCH /api/safety/incidents/:id/classification`
 * (`updateIncidentClassification`) — hàm này đã có backend đầy đủ từ đầu
 * nhưng CHƯA từng có UI gọi tới (chỉ gọi được qua curl/API trực tiếp).
 * Lý do LUÔN bắt buộc (server validate `reason_required` vô điều kiện,
 * không phụ thuộc vai trò) — khác 4 dialog khác trong thư mục này.
 */
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { api } from '../../../services/api';

export interface CorrectClassificationTarget {
  incidentId: string;
  currentClassName: string | null;
}

export function CorrectClassificationDialog({
  target,
  onClose,
  onChanged
}: {
  target: CorrectClassificationTarget | null;
  onClose: () => void;
  onChanged: (result: { incidentId: string; className: string | null }) => void;
}) {
  const [className, setClassName] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setClassName('');
    setReason('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const open = Boolean(target);

  useEffect(() => {
    if (target) setClassName(target.currentClassName || '');
  }, [target?.incidentId]);

  const handleSubmit = async () => {
    if (!target || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.patch<{ incidentId: string; className: string | null }>(`/api/safety/incidents/${target.incidentId}/classification`, {
        className: className.trim(),
        reason: reason.trim()
      });
      onChanged(result);
      handleClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Sửa lớp liên quan</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        {target && (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Hồ sơ <strong>{target.incidentId}</strong> — lớp hiện tại: <strong>{target.currentClassName || 'Chưa gắn lớp'}</strong>
            </Typography>
            <TextField label="Lớp liên quan (VD: 8A2)" value={className} onChange={(e) => setClassName(e.target.value)} fullWidth />
            <TextField label="Lý do sửa (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={2} fullWidth required />
            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Hủy
        </Button>
        <Button variant="contained" disabled={!reason.trim() || submitting} onClick={handleSubmit} sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
          {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
