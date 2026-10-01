/**
 * ChangeStatusDialog.tsx — đổi trạng thái hồ sơ, port UI cho
 * `PATCH /api/safety/incidents/:id/status` (`transitionIncidentStatus`).
 * 12 giá trị trạng thái là CHUỖI TIẾNG VIỆT NGUYÊN VĂN (khớp `catalog.ts`
 * STATE.*), không phải mã — gửi thẳng chuỗi lên server.
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';
import { ALLOWED_STATE_TRANSITIONS, STATE_OPTIONS } from '../constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi trạng thái hồ sơ</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong> — trạng thái hiện tại: <strong>{target.state}</strong>
            </p>
            <div>
              <Label className="mb-1.5 block">Trạng thái mới</Label>
              <Select value={toState} onValueChange={setToState}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  {STATE_OPTIONS.map((s) => {
                    const allowed = (ALLOWED_STATE_TRANSITIONS[target.state] || []).includes(s);
                    return (
                      <SelectItem key={s} value={s} disabled={s === target.state || !allowed}>
                        {s}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-slate-500">Chỉ những trạng thái chuyển được hợp lệ từ trạng thái hiện tại mới bấm được.</p>
            </div>
            <div>
              <Label htmlFor="change-status-note" className="mb-1.5 block">
                Ghi chú (tuỳ chọn)
              </Label>
              <Textarea id="change-status-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="change-status-reason" className="mb-1.5 block">
                Lý do (bắt buộc với 1 số vai trò)
              </Label>
              <Textarea id="change-status-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {needsApproval && (
              <div>
                <Label htmlFor="change-status-approved-by" className="mb-1.5 block">
                  Mã người phê duyệt (perId của Hiệu trưởng/cấp trên)
                </Label>
                <Input id="change-status-approved-by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} autoFocus />
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
          <Button disabled={!toState || submitting} onClick={handleSubmit} className="font-bold">
            {submitting ? 'Đang lưu...' : 'Xác nhận đổi trạng thái'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
