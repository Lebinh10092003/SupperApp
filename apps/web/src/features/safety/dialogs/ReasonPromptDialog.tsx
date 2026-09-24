/**
 * ReasonPromptDialog.tsx — dialog dùng chung cho MỌI hành động bắt buộc
 * nhập lý do (bổ sung 2026-09-22): tham gia/rời sự vụ, yêu cầu huỷ tiếp
 * nhận, yêu cầu mở lại hồ sơ. Chỉ nhận `onSubmit` gọi API thật, dialog
 * không tự biết endpoint nào — nơi gọi tự quyết định.
 */
import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

export function ReasonPromptDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  confirmColor = '#2563eb',
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmColor?: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setReason('');
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(reason.trim());
      handleClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
          <TextField autoFocus label="Lý do (bắt buộc)" value={reason} onChange={(e) => setReason(e.target.value)} multiline rows={3} fullWidth />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={handleClose} sx={{ textTransform: 'none', color: '#64748b' }}>
          Hủy
        </Button>
        <Button
          variant="contained"
          disabled={!reason.trim() || submitting}
          onClick={handleSubmit}
          sx={{ bgcolor: confirmColor, color: '#fff', '&:hover': { filter: 'brightness(0.92)' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
        >
          {submitting ? 'Đang gửi...' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
