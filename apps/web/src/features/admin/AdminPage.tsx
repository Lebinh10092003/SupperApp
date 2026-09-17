import { useState } from 'react';
import { Button, Alert, CircularProgress } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { SafetyUsersSection } from './SafetyUsersSection';

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
        title="Quản trị & Phân quyền — Trường THCS Giảng Võ"
        subtitle="Quản lý người dùng — 1 vai trò dùng chung cho toàn hệ thống (module An toàn, Lịch công tác...), và đồng bộ dữ liệu tổng thể"
        icon={<AdminPanelSettingsIcon />}
        action={
          <Button
            variant="contained"
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon sx={{ fontSize: 16 }} />}
            onClick={sync}
            disabled={syncing}
            sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 2 }}
          >
            {syncing ? 'Đang đồng bộ...' : 'Chạy Full Sync Google Workspace'}
          </Button>
        }
      />

      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 3, borderRadius: 2 }}>
          {toast.text}
        </Alert>
      )}

      <SafetyUsersSection />
    </>
  );
}
