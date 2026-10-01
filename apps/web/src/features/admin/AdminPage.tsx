import { useState } from 'react';
import { Loader2, RotateCw, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { SafetyUsersSection } from './SafetyUsersSection';

const SEVERITY_CLASS: Record<'success' | 'info' | 'error', string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  info: 'border-blue-200 bg-secondary text-blue-800',
  error: 'border-red-200 bg-red-50 text-red-700'
};

export default function AdminPage() {
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null);

  const sync = async () => {
    setSyncing(true);
    setToast({ text: 'Đang tiến hành đồng bộ toàn diện từ Google Workspace...', severity: 'info' });
    try {
      const res = await api<any>('/api/admin/full-sync', { method: 'POST' });
      setToast({ text: `Đã hoàn tất đồng bộ! Khóa học: ${res?.classroom?.courses || 0}`, severity: 'success' });
    } catch (e: any) {
      setToast({ text: `Lỗi khi đồng bộ: ${e.message}`, severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Quản trị & phân quyền"
        icon={<ShieldCheck />}
        action={
          <Button onClick={sync} disabled={syncing} className="rounded-lg font-bold">
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
            {syncing ? 'Đang đồng bộ...' : 'Chạy Full Sync Google Workspace'}
          </Button>
        }
      />

      {toast && (
        <div className={cn('mb-6 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-sm', SEVERITY_CLASS[toast.severity])}>
          <span>{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Đóng">
            <X className="size-4" />
          </button>
        </div>
      )}

      <SafetyUsersSection />
    </>
  );
}
