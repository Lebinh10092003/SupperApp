/**
 * ReasonPromptDialog.tsx — dialog dùng chung cho MỌI hành động bắt buộc
 * nhập lý do (bổ sung 2026-09-22): tham gia/rời sự vụ, yêu cầu huỷ tiếp
 * nhận, yêu cầu mở lại hồ sơ. Chỉ nhận `onSubmit` gọi API thật, dialog
 * không tự biết endpoint nào — nơi gọi tự quyết định.
 */
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function ReasonPromptDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  confirmVariant = 'default',
  onClose,
  onSubmit
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: 'default' | 'destructive';
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
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && <p className="text-sm text-slate-500">{description}</p>}
        <div>
          <Label htmlFor="reason-prompt-input" className="mb-1.5 block">
            Lý do (bắt buộc)
          </Label>
          <Textarea id="reason-prompt-input" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="text-slate-500">
            Hủy
          </Button>
          <Button variant={confirmVariant} disabled={!reason.trim() || submitting} onClick={handleSubmit}>
            {submitting ? 'Đang gửi...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
