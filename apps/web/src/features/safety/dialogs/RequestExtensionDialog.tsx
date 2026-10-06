/**
 * RequestExtensionDialog.tsx — chỉ huy hồ sơ (bất kỳ cấp nào) xin gia hạn
 * "Hạn xử lý sự vụ", bắt buộc lý do + hạn mới đề xuất (2026-10-05, Sin:
 * "người chỉ huy mà tk cấp thấp thì cũng có thể xin gia hạn nhưng cần có
 * lý do và có thể duyệt ở trên app"). `POST
 * /api/safety/incidents/:id/resolution-deadline/request-extension`
 * (`requestResolutionExtension`).
 */
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function RequestExtensionDialog({
  open,
  onClose,
  onSubmit
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string, proposedDeadlineAt: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [proposedDeadlineAt, setProposedDeadlineAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setReason('');
    setProposedDeadlineAt('');
    setError('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason.trim() || !proposedDeadlineAt) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(reason.trim(), new Date(proposedDeadlineAt).toISOString());
      handleClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Xin gia hạn xử lý sự vụ</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="extension-proposed-deadline" className="mb-1.5 block">
            Hạn mới đề xuất *
          </Label>
          <input
            id="extension-proposed-deadline"
            type="datetime-local"
            value={proposedDeadlineAt}
            onChange={(e) => setProposedDeadlineAt(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="extension-reason" className="mb-1.5 block">
            Lý do *
          </Label>
          <Textarea id="extension-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
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
          <Button disabled={!reason.trim() || !proposedDeadlineAt || submitting} onClick={handleSubmit}>
            {submitting ? 'Đang gửi...' : 'Gửi yêu cầu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
