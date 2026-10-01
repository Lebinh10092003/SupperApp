/**
 * ReopenIncidentDialog.tsx — mở lại hồ sơ đã đóng, port UI cho
 * `POST /api/safety/incidents/:id/reopen` (`reopenIncident`). CHỈ nên hiện
 * nút này khi `incident.state === 'Đã đóng'` (kiểm tra ở nơi gọi, xem
 * IncidentDetailPage.tsx) — dialog không tự kiểm tra lại điều kiện đó.
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mở lại hồ sơ đã đóng</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong> sẽ chuyển về trạng thái <strong>Mở lại</strong>.
            </p>
            <div>
              <Label htmlFor="reopen-reason" className="mb-1.5 block">
                Lý do mở lại (bắt buộc)
              </Label>
              <Textarea id="reopen-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
            {needsApproval && (
              <div>
                <Label htmlFor="reopen-approved-by" className="mb-1.5 block">
                  Mã người phê duyệt (perId của Hiệu trưởng)
                </Label>
                <Input id="reopen-approved-by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} autoFocus />
              </div>
            )}
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="text-slate-500">
            Hủy
          </Button>
          <Button variant="destructive" disabled={!reason.trim() || submitting} onClick={handleSubmit}>
            {submitting ? 'Đang xử lý...' : 'Xác nhận mở lại hồ sơ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
