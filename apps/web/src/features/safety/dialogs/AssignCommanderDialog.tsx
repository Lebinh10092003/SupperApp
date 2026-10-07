/**
 * AssignCommanderDialog.tsx — chỉ định/đổi chỉ huy hồ sơ, port UI cho
 * `POST /api/safety/incidents/:id/commander` (`assignCommander`). Dùng
 * `PersonPicker` để chọn đúng `perId` thay vì gõ tay (tránh gõ sai mã).
 */
import { useState } from 'react';
import { api } from '../../../services/api';
import { PersonPicker, type PersonOption } from '../PersonPicker';
import { isApprovalRequiredMessage } from './dialog-utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  onChanged: (result: { incidentId: string; commanderPerId: string; commanderName: string }) => void;
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
    if (!target || !commander || !reason.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const result = await api.post<{ incidentId: string; commanderPerId: string }>(`/api/safety/incidents/${target.incidentId}/commander`, {
        commanderPerId: commander.perId,
        reason: reason.trim() || undefined,
        approvedBy: approvedBy.trim() || undefined
      });
      // Server chỉ trả `commanderPerId` (`assignCommander`, xem
      // safety-incidents.routes.ts), không có tên — lấy `commander.name` từ
      // `PersonPicker` đã chọn ngay trước đó để hiện đúng tên trong thông
      // báo thành công ở nơi gọi (`IncidentDetailPage.tsx`).
      onChanged({ ...result, commanderName: commander.name });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Chỉ định chỉ huy hồ sơ</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong>
              {target.commanderName ? (
                <>
                  {' '}
                  — chỉ huy hiện tại: <strong>{target.commanderName}</strong>
                </>
              ) : (
                ' — chưa có chỉ huy.'
              )}
            </p>
            <PersonPicker label="Chỉ huy mới" value={commander} onChange={setCommander} />
            {/* Lý do giờ LUÔN bắt buộc ở frontend (Sin chốt 2026-10-02) dù
                backend chỉ bắt buộc theo vai trò — chặt hơn cần thiết với
                1 số vai trò nhưng không sai, tránh nhãn mơ hồ "tuỳ vai trò". */}
            <div>
              <Label htmlFor="assign-commander-reason" className="mb-1.5 block">
                Lý do *
              </Label>
              <Textarea id="assign-commander-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            {needsApproval && (
              <div>
                <Label htmlFor="assign-commander-approved-by" className="mb-1.5 block">
                  Mã người phê duyệt (perId của cấp trên)
                </Label>
                <Input id="assign-commander-approved-by" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} autoFocus />
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
          <Button disabled={!commander || !reason.trim() || submitting} onClick={handleSubmit}>
            {submitting ? 'Đang lưu...' : 'Xác nhận chỉ định'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
