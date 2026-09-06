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
        <Alert severity={msg.type} sx={{ my: 2.5, borderRadius: '6px' }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* Overview Card */}
      <Card sx={{ mb: 3, bgcolor: '#ffffff', border: '1px solid #e4e4e7', borderRadius: '8px', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ p: 1.25, bgcolor: '#18181b', color: '#fff', borderRadius: '8px', display: 'grid', placeItems: 'center' }}>
              <SchoolIcon fontSize="medium" />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={700} color="#09090b" sx={{ letterSpacing: '-0.01em' }}>
                Số lượng khóa học Google Classroom thực tế đã đồng bộ: {status?.syncedCoursesCount ?? 0} lớp
              </Typography>
              <Typography variant="body2" color="#71717a" sx={{ fontSize: '0.8125rem' }}>
                Tất cả dữ liệu điểm danh, bài tập, điểm số và học sinh đều được tải trực tiếp từ máy chủ Google API theo thời gian thực (SSOT).
              </Typography>
            </Box>
            <Chip
              label={status?.syncedCoursesCount > 0 ? 'Dữ liệu trực tiếp' : 'Sẵn sàng kết nối'}
              size="small"
              sx={{
                bgcolor: status?.syncedCoursesCount > 0 ? '#ecfdf5' : '#f4f4f5',
                color: status?.syncedCoursesCount > 0 ? '#059669' : '#71717a',
                border: status?.syncedCoursesCount > 0 ? '1px solid #a7f3d0' : '1px solid #e4e4e7',
                fontWeight: 600,
                fontSize: '0.75rem'
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Mode A */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: '8px', height: '100%', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <CloudDoneIcon sx={{ color: '#09090b', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700} color="#09090b">
                  Chế Độ A: Google OAuth Cá Nhân
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                Dành cho Ban Giám hiệu hoặc Giáo viên kết nối tài khoản Google để kéo các lớp học mà tài khoản đó tham gia hoặc giảng dạy.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#fafafa', borderRadius: '6px', border: '1px solid #e4e4e7', mb: 2.5 }}>
                <Typography variant="caption" fontWeight={600} color="#71717a" display="block" gutterBottom sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Trạng thái kết nối OAuth:
                </Typography>
                <Chip
                  label={status?.modeA?.connected ? `ĐÃ KẾT NỐI: ${status?.modeA?.email}` : 'CHƯA KẾT NỐI OAUTH'}
                  size="small"
                  sx={{
                    bgcolor: status?.modeA?.connected ? '#ecfdf5' : '#f4f4f5',
                    color: status?.modeA?.connected ? '#059669' : '#71717a',
                    border: status?.modeA?.connected ? '1px solid #a7f3d0' : '1px solid #e4e4e7',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                />
              </Box>

              <Button
                variant="contained"
                onClick={handleConnectOAuth}
                disabled={loading}
                fullWidth
                sx={{
                  bgcolor: '#18181b',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#27272a' },
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  py: 1,
                  borderRadius: '6px',
                  mb: 2.5
                }}
              >
                🔐 Đăng nhập Google để cấp quyền Classroom
              </Button>

              <Divider sx={{ my: 2, borderColor: '#e4e4e7', fontSize: '0.75rem', color: '#a1a1aa' }}>
                HOẶC DÁN ACCESS TOKEN TRỰC TIẾP
              </Divider>

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
                  sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '6px', py: 0.9 }}
                >
                  Xác nhận Token & Đồng bộ ngay
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Mode B */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: '8px', height: '100%', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <VpnKeyIcon sx={{ color: '#09090b', fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700} color="#09090b">
                  Chế Độ B: Google Workspace DWD Toàn Trường
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                Sử dụng Service Account ủy quyền toàn miền (Domain-Wide Delegation) để đồng bộ tự động 100% lớp học của toàn bộ giáo viên và học sinh trên tên miền trường.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#fafafa', borderRadius: '6px', border: '1px solid #e4e4e7', mb: 2.5 }}>
                <Typography variant="caption" fontWeight={600} color="#71717a" display="block" gutterBottom sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Trạng thái Service Account DWD:
                </Typography>
                <Chip
                  label={status?.modeB?.configured ? `ĐÃ CẤU HÌNH DWD (${status?.modeB?.serviceAccount})` : 'CHƯA CÓ FILE SERVICE-ACCOUNT.JSON'}
                  size="small"
                  sx={{
                    bgcolor: status?.modeB?.configured ? '#eff6ff' : '#fffbeb',
                    color: status?.modeB?.configured ? '#1d4ed8' : '#b45309',
                    border: status?.modeB?.configured ? '1px solid #bfdbfe' : '1px solid #fde68a',
                    fontWeight: 600,
                    fontSize: '0.75rem'
                  }}
                />
                <Typography variant="caption" display="block" sx={{ mt: 1, color: '#71717a' }}>
                  Tên miền Workspace: <strong style={{ color: '#09090b' }}>{status?.modeB?.domain || 'thcsgiangvo.edu.vn'}</strong>
                </Typography>
              </Box>

              <Typography variant="caption" fontWeight={600} color="#71717a" gutterBottom display="block" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                onClick={handleSaveServiceAccount}
                disabled={syncing || !saJson.trim()}
                fullWidth
                sx={{
                  bgcolor: '#18181b',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#27272a' },
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  py: 1,
                  borderRadius: '6px'
                }}
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
