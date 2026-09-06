import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  Chip,
  Grid,
  TextField,
  Divider,
  CircularProgress,
  Stack
} from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDoneRounded';
import VpnKeyIcon from '@mui/icons-material/VpnKeyRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function GoogleConnectionPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Mode A input
  const [customToken, setCustomToken] = useState('');
  const [tokenEmail, setTokenEmail] = useState('');

  // Mode B input
  const [saJson, setSaJson] = useState('');

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api<any>('/api/connections/status');
      setStatus(res);
    } catch {
      setStatus({
        modeA: { connected: false, email: null },
        modeB: { configured: false, domain: 'thcsgiangvo.edu.vn', serviceAccount: null },
        syncedCoursesCount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleConnectOAuth = async () => {
    try {
      const res = await api<any>('/api/connections/oauth/url');
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setMsg({ text: res?.message || 'Không thể lấy URL kết nối Google OAuth.', type: 'error' });
      }
    } catch (e: any) {
      setMsg({ text: e.message || 'Lỗi khi lấy URL đăng nhập Google OAuth', type: 'error' });
    }
  };

  const handleSaveDirectToken = async () => {
    if (!customToken.trim()) {
      setMsg({ text: 'Vui lòng dán Google Access Token hợp lệ', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api<any>('/api/connections/token', {
        method: 'POST',
        body: JSON.stringify({ token: customToken.trim(), email: tokenEmail.trim() || undefined })
      });
      setMsg({ text: res.message || 'Đã đồng bộ thành công dữ liệu từ Google Classroom!', type: 'success' });
      setCustomToken('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi đồng bộ qua Access Token', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveServiceAccount = async () => {
    if (!saJson.trim()) {
      setMsg({ text: 'Vui lòng dán nội dung file JSON của Service Account', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api<any>('/api/connections/service-account', {
        method: 'POST',
        body: JSON.stringify({ jsonContent: saJson.trim() })
      });
      setMsg({ text: res.message || 'Đã lưu Service Account và đồng bộ dữ liệu!', type: 'success' });
      setSaJson('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi lưu Service Account JSON', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      const res = await api<any>('/api/classroom/sync', { method: 'POST' });
      setMsg({ text: res.message || `Đã đồng bộ thành công ${res.success || 0} khóa học!`, type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi kích hoạt đồng bộ', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Quản Lý Kết Nối Google Classroom & Dữ Liệu Thực Tế"
        subtitle="Cung cấp quyền truy cập để hệ thống tự động nạp 100% dữ liệu thực tế từ Google Classroom (Không dùng dữ liệu giả lập)"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              color="primary"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleManualSync}
              disabled={syncing}
              sx={{ fontWeight: 700 }}
            >
              {syncing ? 'Đang đồng bộ...' : 'Đồng bộ Classroom ngay'}
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadStatus} disabled={loading}>
              Làm mới
            </Button>
          </Stack>
        }
      />

      {msg && (
        <Alert severity={msg.type} sx={{ my: 2 }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* Overview Card */}
      <Card sx={{ mb: 3, bgcolor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 3 }}>
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ p: 1.5, bgcolor: '#2563eb', color: '#fff', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
              <SchoolIcon fontSize="large" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" fontWeight={800} color="#1e3a8a">
                Số lượng khóa học Google Classroom thực tế đã đồng bộ: {status?.syncedCoursesCount ?? 0} lớp
              </Typography>
              <Typography variant="body2" color="#1d4ed8">
                Tất cả dữ liệu điểm danh, bài tập, điểm số và học sinh đều được tải trực tiếp từ máy chủ Google API theo thời gian thực.
              </Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Mode A */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CloudDoneIcon color="primary" />
                <Typography variant="h6" fontWeight={700}>
                  Chế Độ A: Google OAuth Cá Nhân
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Dành cho Ban Giám hiệu hoặc Giáo viên kết nối tài khoản Google để kéo các lớp học mà tài khoản đó tham gia hoặc giảng dạy.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 2.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                  TRẠNG THÁI KẾT NỐI OAUTH:
                </Typography>
                <Chip
                  label={status?.modeA?.connected ? `ĐÃ KẾT NỐI: ${status?.modeA?.email}` : 'CHƯA KẾT NỐI OAUTH'}
                  color={status?.modeA?.connected ? 'success' : 'default'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleConnectOAuth}
                disabled={loading}
                sx={{ textTransform: 'none', fontWeight: 700, mb: 2.5 }}
              >
                🔐 Đăng nhập Google để cấp quyền Classroom
              </Button>

              <Divider sx={{ my: 2 }}>HOẶC DÁN ACCESS TOKEN TRỰC TIẾP</Divider>

              <Stack spacing={1.5}>
                <TextField
                  size="small"
                  label="Email tài khoản Google"
                  placeholder="09.levanbinh2003@gmail.com"
                  value={tokenEmail}
                  onChange={(e) => setTokenEmail(e.target.value)}
                  fullWidth
                />
                <TextField
                  size="small"
                  label="Google Access Token (Bearer)"
                  placeholder="ya29.a0Ac..."
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                />
                <Button
                  variant="outlined"
                  onClick={handleSaveDirectToken}
                  disabled={syncing || !customToken.trim()}
                  sx={{ fontWeight: 700 }}
                >
                  Xác nhận Token & Đồng bộ ngay
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Mode B */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: 3, height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <VpnKeyIcon color="secondary" />
                <Typography variant="h6" fontWeight={700}>
                  Chế Độ B: Google Workspace DWD Toàn Trường
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Sử dụng Service Account ủy quyền toàn miền (Domain-Wide Delegation) để đồng bộ tự động 100% lớp học của toàn bộ giáo viên và học sinh trên tên miền trường.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, mb: 2.5 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" gutterBottom>
                  TRẠNG THÁI SERVICE ACCOUNT DWD:
                </Typography>
                <Chip
                  label={status?.modeB?.configured ? `ĐÃ CẤU HÌNH DWD (${status?.modeB?.serviceAccount})` : 'CHƯA CÓ FILE SERVICE-ACCOUNT.JSON'}
                  color={status?.modeB?.configured ? 'primary' : 'warning'}
                  sx={{ fontWeight: 700 }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1, color: 'text.secondary' }}>
                  Tên miền Workspace: <strong>{status?.modeB?.domain || 'thcsgiangvo.edu.vn'}</strong>
                </Typography>
              </Box>

              <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                Cung cấp nội dung file JSON Service Account:
              </Typography>
              <TextField
                size="small"
                placeholder='Dán toàn bộ nội dung file service-account.json (chứa "private_key" và "client_email")...'
                value={saJson}
                onChange={(e) => setSaJson(e.target.value)}
                multiline
                rows={4}
                fullWidth
                sx={{ mb: 2 }}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleSaveServiceAccount}
                disabled={syncing || !saJson.trim()}
                sx={{ fontWeight: 700 }}
              >
                Lưu Service Account & Đồng bộ toàn trường
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
