/**
 * SetResolutionDeadlineDialog.tsx — người giao (Hiệu trưởng/Phó HT/Tổ
 * trưởng) đặt/điều chỉnh "Hạn xử lý sự vụ" trực tiếp, không cần lý do
 * (2026-10-05, Sin: "người giao có thể điều chỉnh được hạn xử lý").
 * `PATCH /api/safety/incidents/:id/resolution-deadline` (`setResolutionDeadline`).
 */
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SetResolutionDeadlineDialog({
  open,
  currentDeadlineAt,
  onClose,
  onSubmit
}: {
  open: boolean;
  currentDeadlineAt: string | null | undefined;
  onClose: () => void;
  onSubmit: (deadlineAt: string | null) => Promise<void>;
}) {
  const [value, setValue] = useState(() => toLocalInput(currentDeadlineAt));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setValue(toLocalInput(currentDeadlineAt));
      setError('');
      return;
    }
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(value ? new Date(value).toISOString() : null);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(null);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Đặt hạn xử lý sự vụ</DialogTitle>
        </DialogHeader>
        <div>
          <Label htmlFor="resolution-deadline-input" className="mb-1.5 block">
            Hạn xử lý
          </Label>
          <input
            id="resolution-deadline-input"
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
          />
        </div>
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter className="sm:justify-between">
          {currentDeadlineAt ? (
            <Button variant="ghost" disabled={submitting} onClick={handleClear} className="text-red-600">
              Bỏ hạn
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose} className="text-slate-500">
              Hủy
            </Button>
            <Button disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Đang lưu...' : 'Lưu'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
