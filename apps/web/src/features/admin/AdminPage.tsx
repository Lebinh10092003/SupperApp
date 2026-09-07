import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  Avatar,
  Box,
  Alert,
  CircularProgress
} from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import PersonAddIcon from '@mui/icons-material/PersonAddRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

const roleOptions = [
  { value: 'SYSTEM_ADMIN', label: 'Quản trị hệ thống (Full Admin)' },
  { value: 'PRINCIPAL', label: 'Hiệu trưởng' },
  { value: 'VICE_PRINCIPAL', label: 'Phó Hiệu trưởng' },
  { value: 'DEPARTMENT_HEAD', label: 'Tổ trưởng chuyên môn' },
  { value: 'HOMEROOM', label: 'Giáo viên chủ nhiệm' },
  { value: 'TEACHER', label: 'Giáo viên bộ môn' },
  { value: 'VIEWER', label: 'Người xem (Chỉ đọc)' }
];

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('TEACHER');
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null);

  const load = () => {
    setLoadingUsers(true);
    api<any>('/api/admin/access')
      .then((x) => {
        setUsers(x.users || []);
      })
      .catch(() => {
        setUsers([]);
      })
      .finally(() => setLoadingUsers(false));
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!email.trim() || !email.includes('@')) {
      setToast({ text: 'Vui lòng nhập địa chỉ email hợp lệ!', severity: 'error' });
      return;
    }
    try {
      await api('/api/admin/access', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), role, active: true })
      });
      setToast({ text: `Đã cấp quyền ${role} cho email ${email}!`, severity: 'success' });
      setEmail('');
      load();
    } catch (e: any) {
      setToast({ text: `Lỗi cấp quyền: ${e.message}`, severity: 'error' });
    }
  };

  const sync = async () => {
    setSyncing(true);
    setToast({ text: 'Đang tiến hành đồng bộ toàn diện từ Google Workspace...', severity: 'info' });
    try {
      const res = await api<any>('/api/admin/full-sync', { method: 'POST' });
      setToast({ text: `Đã hoàn tất đồng bộ! Khóa học: ${res?.classroom?.courses || 0}`, severity: 'success' });
      load();
    } catch (e: any) {
      setToast({ text: `Lỗi khi đồng bộ: ${e.message}`, severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Quản trị & Phân quyền — THCS Giảng Võ"
        subtitle="Quản lý danh sách tài khoản truy cập, gán vai trò chức năng và đồng bộ dữ liệu tổng thể"
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

      <Grid container spacing={3}>
        {/* Grant Access Card */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonAddIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ letterSpacing: '-0.01em' }}>
                  Cấp quyền truy cập mới
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '0.8125rem' }}>
                Thêm tài khoản Google Workspace và phân quyền vai trò tương ứng trong hệ thống.
              </Typography>

              <Stack spacing={2}>
                <TextField
                  fullWidth
                  size="small"
                  label="Email Google Workspace"
                  placeholder="giaovien@thcs-giangvo.edu.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />

                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Vai trò (Role)"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  {roleOptions.map((r) => (
                    <MenuItem key={r.value} value={r.value}>
                      {r.label}
                    </MenuItem>
                  ))}
                </TextField>

                <Button
                  variant="contained"
                  fullWidth
                  onClick={save}
                  sx={{
                    py: 1.2,
                    bgcolor: '#2563eb',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#1d4ed8' },
                    fontWeight: 700,
                    fontSize: '0.84rem',
                    textTransform: 'none',
                    borderRadius: 2
                  }}
                >
                  Lưu & Cấp quyền
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* User List Table */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)', overflow: 'hidden', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Danh sách tài khoản đã phân quyền
                </Typography>
                <Chip
                  label={`${users.length} tài khoản`}
                  size="small"
                  sx={{
                    bgcolor: '#eff6ff',
                    color: '#1d4ed8',
                    border: '1px solid #bfdbfe',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    px: 0.5
                  }}
                />
              </Box>

              <TableContainer sx={{ maxHeight: 420 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tài khoản</TableCell>
                      <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Vai trò</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loadingUsers ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center' }}>
                          <CircularProgress size={24} />
                        </TableCell>
                      </TableRow>
                    ) : users.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ py: 4, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">
                            Chưa có tài khoản phân quyền đặc thù. Hệ thống áp dụng vai trò mặc định cho người dùng Google Workspace đăng nhập.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      users.map((u) => (
                        <TableRow key={u.uid || u.email} hover sx={{ '&:hover': { bgcolor: 'rgba(239, 246, 255, 0.6) !important' } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                              <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#2563eb', color: '#fff', fontWeight: 700 }}>
                                {(u.displayName || u.email)?.[0]?.toUpperCase() || 'U'}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                                  {u.displayName || u.email}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {u.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={u.role}
                              size="small"
                              sx={{
                                bgcolor: u.role?.includes('ADMIN') ? '#fef2f2' : '#eff6ff',
                                color: u.role?.includes('ADMIN') ? '#dc2626' : '#1d4ed8',
                                border: u.role?.includes('ADMIN') ? '1px solid #fecaca' : '1px solid #bfdbfe',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                height: 22
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={u.active ? 'Hoạt động' : 'Tạm khóa'}
                              size="small"
                              sx={{
                                bgcolor: u.active ? '#ecfdf5' : '#f8fafc',
                                color: u.active ? '#059669' : '#64748b',
                                border: u.active ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                height: 22
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}