import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastState {
  message: string;
  severity: 'success' | 'error' | 'info';
}

const SEVERITY_CLASS: Record<ToastState['severity'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-blue-200 bg-secondary text-blue-800',
  error: 'border-red-200 bg-red-50 text-red-700'
};

/** Toast nổi góc dưới màn hình, tự ẩn sau 1 khoảng thời gian — thay cho
 * MUI `Snackbar` + `Alert` (3 trang dùng: ClassesPage, SyncRunsPage,
 * IncidentDetailPage). Hành vi y hệt bản cũ: tự đóng sau `autoHideDuration`
 * (mặc định 4000ms, khớp giá trị MUI cũ dùng ở cả 3 nơi), có nút đóng tay,
 * không chặn tương tác phía sau (không có overlay). */
export function Toast({
  toast,
  onClose,
  autoHideDuration = 4000
}: {
  toast: ToastState | null;
  onClose: () => void;
  autoHideDuration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, autoHideDuration);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast, autoHideDuration]);

  if (!toast) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4">
      <div className={cn('flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg', SEVERITY_CLASS[toast.severity])}>
        <span>{toast.message}</span>
        <button type="button" onClick={onClose} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Đóng">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
