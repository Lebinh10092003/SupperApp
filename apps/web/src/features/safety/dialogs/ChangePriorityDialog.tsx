/**
 * ChangePriorityDialog.tsx — đổi mức ưu tiên hồ sơ, port UI cho
 * `PATCH /api/safety/incidents/:id/priority` (`changeIncidentPriority`).
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { isApprovalRequiredMessage } from './dialog-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PRIORITY_OPTIONS = [
  { value: 'P0', label: 'P0 — Khẩn cấp (nguy hiểm tức thời tính mạng/sức khỏe)' },
  { value: 'P1', label: 'P1 — Nghiêm trọng (nguy cơ nghiêm trọng / leo thang nhanh)' },
  { value: 'P2', label: 'P2 — Cần xử lý (cần phối hợp, không nguy hiểm tức thời)' },
  { value: 'P3', label: 'P3 — Thông thường (nguy cơ thông thường / phòng ngừa)' }
];

export interface ChangePriorityTarget {
  incidentId: string;
  priority: string | null;
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
    <Dialog open={Boolean(target)} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Đổi mức ưu tiên hồ sơ</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong> — ưu tiên hiện tại: <strong>{target.priority || 'Chưa phân loại'}</strong>
            </p>
            <div>
              <Label className="mb-1.5 block">Mức ưu tiên mới</Label>
              <Select value={toPriority} onValueChange={setToPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn mức ưu tiên" />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value} disabled={p.value === target.priority}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="change-priority-reason" className="mb-1.5 block">
                Lý do (bắt buộc với 1 số vai trò)
              </Label>
              <Textarea id="change-priority-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {needsApproval && (
              <div>
                <Label htmlFor="change-priority-approved-by" className="mb-1.5 block">
                  Mã người phê duyệt (perId của Hiệu trưởng/cấp trên)
                </Label>
                <Input id="change-priority-approved-by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} autoFocus />
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
          <Button disabled={!toPriority || submitting} onClick={handleSubmit} className="font-bold">
            {submitting ? 'Đang lưu...' : 'Xác nhận đổi ưu tiên'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
