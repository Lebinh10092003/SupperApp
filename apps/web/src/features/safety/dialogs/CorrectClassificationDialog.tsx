/**
 * CorrectClassificationDialog.tsx — sửa lớp liên quan của 1 hồ sơ ĐÃ TẠO,
 * port UI cho `PATCH /api/safety/incidents/:id/classification`
 * (`updateIncidentClassification`) — hàm này đã có backend đầy đủ từ đầu
 * nhưng CHƯA từng có UI gọi tới (chỉ gọi được qua curl/API trực tiếp).
 * Lý do LUÔN bắt buộc (server validate `reason_required` vô điều kiện,
 * không phụ thuộc vai trò) — khác 4 dialog khác trong thư mục này.
 */
import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  onChanged: (result: { incidentId: string; className: string | null; notifiedPerIds: string[] }) => void;
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
      const result = await api.patch<{ incidentId: string; className: string | null; notifiedPerIds: string[] }>(`/api/safety/incidents/${target.incidentId}/classification`, {
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
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa lớp liên quan</DialogTitle>
        </DialogHeader>
        {target && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-500">
              Hồ sơ <strong>{target.incidentId}</strong> — lớp hiện tại: <strong>{target.currentClassName || 'Chưa gắn lớp'}</strong>
            </p>
            <div>
              <Label htmlFor="correct-class-name" className="mb-1.5 block">
                Lớp liên quan (VD: 8A2)
              </Label>
              <Input id="correct-class-name" value={className} onChange={(e) => setClassName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="correct-class-reason" className="mb-1.5 block">
                Lý do sửa (bắt buộc)
              </Label>
              <Textarea id="correct-class-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} required />
            </div>
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
          <Button disabled={!reason.trim() || submitting} onClick={handleSubmit}>
            {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
