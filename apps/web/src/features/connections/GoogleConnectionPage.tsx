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
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  IconButton
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import CloudDoneIcon from '@mui/icons-material/CloudDoneRounded';
import VpnKeyIcon from '@mui/icons-material/VpnKeyRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNewRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded';
import SettingsIcon from '@mui/icons-material/SettingsRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutlineRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useAuth } from '../../auth/AuthProvider';

const CLASSROOM_SCOPES_STRING = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails'
].join(' ');

export default function GoogleConnectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();

  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [copiedScopes, setCopiedScopes] = useState(false);
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Mode A inputs
  const [customToken, setCustomToken] = useState('');
  const [customRefreshToken, setCustomRefreshToken] = useState('');
  const [tokenEmail, setTokenEmail] = useState('');

  // OAuth Credentials Configuration
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [savingOAuth, setSavingOAuth] = useState(false);

  // Mode B input
  const [saJson, setSaJson] = useState('');

  const loadStatus = async () => {
    try {
      setLoading(true);
      const res = await api<any>('/api/connections/status');
      setStatus(res);
      if (res?.oauthConfig?.clientId) {
        setClientId(res.oauthConfig.clientId);
      }
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

  // 1. Kiểm tra tham số callback từ URL (oauth_success / oauth_error)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const emailParam = params.get('email');
    const countParam = params.get('count');

    if (oauthSuccess) {
      setMsg({
        text: `Đăng nhập Google OAuth thành công! Đã kết nối tài khoản ${emailParam || ''} và đồng bộ ${countParam || 0} khóa học từ Google Classroom.`,
        type: 'success'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (oauthError) {
      setMsg({
        text: `Lỗi đăng nhập Google OAuth: ${decodeURIComponent(oauthError)}`,
        type: 'error'
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    loadStatus();
  }, [location.search]);

  // 2. Điền sẵn email người dùng nếu chưa nhập
  useEffect(() => {
    if (!tokenEmail) {
      setTokenEmail(profile?.email || '09.levanbinh2003@gmail.com');
    }
  }, [profile, tokenEmail]);

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(CLASSROOM_SCOPES_STRING);
    setCopiedScopes(true);
    setTimeout(() => setCopiedScopes(false), 2500);
  };

  const handleCopyRedirect = () => {
    const redirectUrl = status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback';
    navigator.clipboard.writeText(redirectUrl);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2500);
  };

  const handleConnectOAuth = async () => {
    try {
      const res = await api<any>('/api/connections/oauth/url');
      if (res?.url) {
        window.location.href = res.url;
      } else {
        setMsg({ text: res?.message || 'Không thể lấy URL kết nối Google OAuth.', type: 'error' });
      }
    } catch (e: any) {
      setMsg({
        text: e.message || 'Chưa cấu hình Google OAuth Client ID. Bạn có thể mở mục "Cấu hình Google OAuth 2.0 Client ID" bên dưới hoặc Dán Access Token trực tiếp.',
        type: 'error'
      });
    }
  };

  const handleSaveOAuthCredentials = async () => {
    if (!clientId.trim()) {
      setMsg({ text: 'Vui lòng nhập Client ID hợp lệ từ Google Cloud Console', type: 'error' });
      return;
    }
    setSavingOAuth(true);
    try {
      const res = await api<any>('/api/connections/oauth-config', {
        method: 'POST',
        body: JSON.stringify({
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
          redirectUri: status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback'
        })
      });
      setMsg({ text: res.message || 'Đã lưu cấu hình Google OAuth Credentials thành công!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi lưu OAuth Credentials', type: 'error' });
    } finally {
      setSavingOAuth(false);
    }
  };

  const handleSaveDirectToken = async () => {
    if (!customToken.trim()) {
      setMsg({ text: 'Vui lòng dán Google Access Token hợp lệ (chuỗi bắt đầu bằng ya29...)', type: 'error' });
      return;
    }
    setSyncing(true);
    try {
      const res = await api<any>('/api/connections/token', {
        method: 'POST',
        body: JSON.stringify({
          token: customToken.trim(),
          refreshToken: customRefreshToken.trim() || undefined,
          email: tokenEmail.trim() || undefined
        })
      });
      setMsg({ text: res.message || 'Đã kết nối tài khoản và đồng bộ thành công dữ liệu từ Google Classroom!', type: 'success' });
      setCustomToken('');
      setCustomRefreshToken('');
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi xác thực hoặc đồng bộ qua Access Token', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      const res = await api<any>('/api/connections/refresh', { method: 'POST' });
      setMsg({ text: res.message || 'Đã làm mới token thành công!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi làm mới token', type: 'error' });
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Bạn có chắc muốn ngắt kết nối tài khoản Google hiện tại không?')) return;
    try {
      await api('/api/connections/disconnect', { method: 'POST' });
      setMsg({ text: 'Đã ngắt kết nối tài khoản Google thành công.', type: 'info' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi ngắt kết nối', type: 'error' });
    }
  };

  const handleLoadDemoSeed = async () => {
    setSeedLoading(true);
    try {
      const res = await api<any>('/api/connections/demo-seed', { method: 'POST' });
      setMsg({ text: res.message || 'Đã nạp thành công bộ lớp học mẫu THCS Giảng Võ!', type: 'success' });
      loadStatus();
    } catch (err: any) {
      setMsg({ text: err.message || 'Lỗi khi nạp dữ liệu mẫu', type: 'error' });
    } finally {
      setSeedLoading(false);
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
      setMsg({ text: err.message || 'Lỗi khi kích hoạt đồng bộ Google Classroom', type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Quản Lý Kết Nối Google Classroom & Dữ Liệu Thực Tế"
        subtitle="Cung cấp quyền truy cập để hệ thống tự động nạp 100% dữ liệu thực tế từ Google Classroom cho THCS Giảng Võ"
        action={
          <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
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
            <Button
              variant="outlined"
              color="secondary"
              startIcon={seedLoading ? <CircularProgress size={16} color="inherit" /> : <PlayCircleOutlineIcon />}
              onClick={handleLoadDemoSeed}
              disabled={seedLoading}
              sx={{ fontWeight: 600 }}
            >
              Nạp lớp học mẫu THCS Giảng Võ
            </Button>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadStatus} disabled={loading}>
              Làm mới
            </Button>
          </Stack>
        }
      />

      {msg && (
        <Alert severity={msg.type} sx={{ my: 2.5, borderRadius: '8px' }} onClose={() => setMsg(null)}>
          {msg.text}
        </Alert>
      )}

      {/* Overview Card */}
      <Card sx={{ mb: 3, bgcolor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ p: 1.5, background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#fff', borderRadius: '10px', display: 'grid', placeItems: 'center', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}>
              <SchoolIcon fontSize="medium" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ letterSpacing: '-0.01em' }}>
                Số lượng khóa học Google Classroom đã nạp vào CSDL: {status?.syncedCoursesCount ?? 0} lớp
              </Typography>
              <Typography variant="body2" color="#64748b" sx={{ fontSize: '0.8125rem' }}>
                Tất cả dữ liệu điểm danh, bài tập, sĩ số học sinh và điểm số được đồng bộ trực tiếp từ máy chủ Google API theo chuẩn SSOT.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              {status?.syncedCoursesCount > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/classroom')}
                  sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', borderRadius: '8px' }}
                >
                  Xem danh sách lớp học ({status.syncedCoursesCount})
                </Button>
              )}
              <Chip
                label={status?.syncedCoursesCount > 0 ? 'Đã có dữ liệu lớp học' : 'Chưa có lớp học'}
                size="small"
                sx={{
                  bgcolor: status?.syncedCoursesCount > 0 ? '#ecfdf5' : '#fef2f2',
                  color: status?.syncedCoursesCount > 0 ? '#059669' : '#dc2626',
                  border: status?.syncedCoursesCount > 0 ? '1px solid #a7f3d0' : '1px solid #fecaca',
                  fontWeight: 600,
                  fontSize: '0.75rem'
                }}
              />
            </Stack>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Mode A */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: '12px', height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                  <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                    <CloudDoneIcon sx={{ fontSize: 20 }} />
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                    Chế Độ A: Google OAuth Cá Nhân
                  </Typography>
                </Box>
                {status?.modeA?.connected && (
                  <Tooltip title="Ngắt kết nối tài khoản này">
                    <IconButton size="small" color="error" onClick={handleDisconnect}>
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>

              <Typography variant="body2" color="#64748b" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                Dành cho Ban Giám hiệu hoặc Giáo viên kết nối tài khoản Google để kéo các lớp học mà tài khoản đó tham gia hoặc giảng dạy.
              </Typography>

              {/* Status Badge */}
              <Box sx={{ p: 2, bgcolor: status?.modeA?.connected ? '#f0fdf4' : '#f8fafc', borderRadius: '8px', border: status?.modeA?.connected ? '1px solid #bbf7d0' : '1px solid #e2e8f0', mb: 2.5 }}>
                <Typography variant="caption" fontWeight={600} color="#64748b" display="block" gutterBottom sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Trạng thái kết nối OAuth:
                </Typography>
                <Chip
                  icon={status?.modeA?.connected ? <CheckCircleIcon sx={{ fontSize: '16px !important' }} /> : undefined}
                  label={
                    status?.modeA?.connected
                      ? (status?.modeA?.hasRefreshToken
                          ? `ĐÃ KẾT NỐI VĨNH VIỄN (Refresh Token): ${status?.modeA?.email}`
                          : `ĐÃ KẾT NỐI: ${status?.modeA?.email}`)
                      : 'CHƯA KẾT NỐI OAUTH'
                  }
                  size="small"
                  sx={{
                    bgcolor: status?.modeA?.connected ? '#ecfdf5' : '#f1f5f9',
                    color: status?.modeA?.connected ? '#059669' : '#64748b',
                    border: status?.modeA?.connected ? '1px solid #a7f3d0' : '1px solid #cbd5e1',
                    fontWeight: 700,
                    fontSize: '0.75rem'
                  }}
                />
                {status?.modeA?.connected && (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: '#15803d' }}>
                      Cập nhật lần cuối: {new Date(status.modeA.connectedAt || Date.now()).toLocaleString('vi-VN')}
                      {status.modeA.hasRefreshToken ? ' • Tự động gia hạn vĩnh viễn' : ' • Hạn Access Token 1 giờ'}
                    </Typography>
                    {status.modeA.hasRefreshToken && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRefreshToken}
                        disabled={refreshing}
                        startIcon={refreshing ? <CircularProgress size={12} /> : <SyncIcon sx={{ fontSize: 13 }} />}
                        sx={{ fontSize: '0.7rem', textTransform: 'none', py: 0.2, px: 1, color: '#166534', borderColor: '#bbf7d0', '&:hover': { bgcolor: '#dcfce7' } }}
                      >
                        {refreshing ? 'Đang làm mới...' : 'Thử làm mới Token ngay'}
                      </Button>
                    )}
                  </Box>
                )}
              </Box>

              {/* Button Login OAuth */}
              <Button
                variant="contained"
                onClick={handleConnectOAuth}
                disabled={loading}
                fullWidth
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  py: 1.1,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  mb: 2.5
                }}
              >
                🔐 Đăng nhập Google để cấp quyền Classroom
              </Button>

              {/* Accordion: Quick Guide for OAuth Playground */}
              <Accordion sx={{ mb: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="body2" fontWeight={700} color="#1e293b">
                    ⚡ Cách lấy Access Token nhanh trong 30 giây (OAuth Playground)
                  </Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Typography variant="body2" color="#475569" sx={{ fontSize: '0.8125rem', mb: 1.5 }}>
                    Nếu bạn chưa thiết lập Google Cloud OAuth Client ID, hãy dùng Google OAuth Playground để lấy Access Token dùng ngay:
                  </Typography>
                  <Stack spacing={1} sx={{ fontSize: '0.8125rem', color: '#334155' }}>
                    <Box>
                      <strong>Bước 1:</strong> Mở trang{' '}
                      <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        Google OAuth 2.0 Playground <OpenInNewIcon sx={{ fontSize: 13 }} />
                      </a>
                    </Box>
                    <Box>
                      <strong>Bước 2:</strong> Bấm nút dưới để copy danh sách Scopes Google Classroom:
                      <Box sx={{ mt: 0.5 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                          onClick={handleCopyScopes}
                          sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.4 }}
                        >
                          {copiedScopes ? 'Đã sao chép Scopes!' : 'Sao chép Scopes Classroom'}
                        </Button>
                      </Box>
                    </Box>
                    <Box>
                      <strong>Bước 3:</strong> Tại Playground, cuộn xuống mục <em>"Input your own scopes"</em> ở cột bên trái, dán scopes vào và bấm <strong>Authorize APIs</strong>. Chọn tài khoản Google của bạn (<code>09.levanbinh2003@gmail.com</code>).
                    </Box>
                    <Box>
                      <strong>Bước 4:</strong> Bấm <strong>Exchange authorization code for tokens</strong>, copy dòng <strong>Access token</strong> (bắt đầu bằng <code>ya29...</code>) rồi dán vào ô bên dưới.
                    </Box>
                    <Box sx={{ p: 1.25, bgcolor: '#eff6ff', borderRadius: '6px', border: '1px solid #bfdbfe', fontSize: '0.78rem', color: '#1e40af' }}>
                      💡 <strong>Lưu ý về thời hạn:</strong> Access Token của Google mặc định có thời hạn <strong>1 giờ (3600 giây)</strong>. Để giữ kết nối lâu dài / tự động làm mới vĩnh viễn, bạn hãy copy thêm ô <strong>Refresh token</strong> ở Bước 2 trên Playground và dán vào ô bên dưới.
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              <Divider sx={{ my: 2, borderColor: '#e2e8f0', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                HOẶC DÁN ACCESS TOKEN TRỰC TIẾP
              </Divider>

              <Stack spacing={1.75}>
                <TextField
                  size="small"
                  label="Email tài khoản Google"
                  placeholder="09.levanbinh2003@gmail.com"
                  value={tokenEmail}
                  onChange={(e) => setTokenEmail(e.target.value)}
                  fullWidth
                  helperText="Tài khoản Google chứa các lớp học cần đồng bộ"
                />
                <TextField
                  size="small"
                  label="Google Access Token (Bearer)"
                  placeholder="Dán token bắt đầu bằng ya29... vào đây (thời hạn 1 giờ)"
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  multiline
                  rows={2}
                  fullWidth
                  helperText="Bắt buộc: Token được bảo mật và xác thực trực tiếp với Google API"
                />
                <TextField
                  size="small"
                  label="Google Refresh Token (Tùy chọn — Tự động gia hạn vĩnh viễn)"
                  placeholder="Dán Refresh token từ Bước 2 của Playground nếu muốn tự động làm mới mãi mãi"
                  value={customRefreshToken}
                  onChange={(e) => setCustomRefreshToken(e.target.value)}
                  fullWidth
                  helperText="Tùy chọn: Giúp hệ thống tự động làm mới token mỗi khi hết hạn mà không cần nhập lại"
                />
                <Button
                  variant="outlined"
                  onClick={handleSaveDirectToken}
                  disabled={syncing || !customToken.trim()}
                  startIcon={syncing ? <CircularProgress size={14} /> : undefined}
                  sx={{ fontWeight: 700, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '8px', py: 1 }}
                >
                  {syncing ? 'Đang xác thực và đồng bộ...' : 'Xác nhận Token & Đồng bộ ngay'}
                </Button>
              </Stack>

              {/* Accordion: OAuth Credentials Settings */}
              <Accordion sx={{ mt: 3, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px !important', '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SettingsIcon sx={{ fontSize: 16, color: '#64748b' }} />
                    <Typography variant="caption" fontWeight={700} color="#475569" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Cấu hình Google OAuth 2.0 Credentials (Tùy chọn)
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 0 }}>
                  <Typography variant="body2" color="#64748b" sx={{ fontSize: '0.775rem', mb: 1.5 }}>
                    Dán OAuth Client ID từ Google Cloud Console để bật tính năng bấm 1-click nút "Đăng nhập Google" không cần copy token thủ công.
                  </Typography>
                  <Stack spacing={1.5}>
                    <TextField
                      size="small"
                      label="OAuth Client ID"
                      placeholder="...apps.googleusercontent.com"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      fullWidth
                    />
                    <TextField
                      size="small"
                      label="OAuth Client Secret (Tùy chọn)"
                      placeholder="GOCSPX-..."
                      type="password"
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      fullWidth
                    />
                    <Box sx={{ p: 1, bgcolor: '#ffffff', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.75rem', color: '#64748b' }}>
                      <strong>Redirect URI hợp lệ:</strong> {status?.oauthConfig?.redirectUri || 'http://localhost:8080/api/connections/oauth/callback'}
                      <Button size="small" onClick={handleCopyRedirect} sx={{ ml: 1, textTransform: 'none', fontSize: '0.7rem', p: 0 }}>
                        {copiedRedirect ? 'Đã copy' : 'Copy'}
                      </Button>
                    </Box>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={handleSaveOAuthCredentials}
                      disabled={savingOAuth || !clientId.trim()}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8125rem', alignSelf: 'flex-start' }}
                    >
                      {savingOAuth ? 'Đang lưu...' : 'Lưu cấu hình OAuth'}
                    </Button>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            </CardContent>
          </Card>
        </Grid>

        {/* Mode B */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ borderRadius: '12px', height: '100%', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                  <VpnKeyIcon sx={{ fontSize: 20 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                  Chế Độ B: Google Workspace DWD Toàn Trường
                </Typography>
              </Box>
              <Typography variant="body2" color="#64748b" sx={{ mb: 2, fontSize: '0.8125rem' }}>
                Sử dụng Service Account ủy quyền toàn miền (Domain-Wide Delegation) để đồng bộ tự động 100% lớp học của toàn bộ giáo viên và học sinh trên tên miền trường.
              </Typography>

              <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', mb: 2.5 }}>
                <Typography variant="caption" fontWeight={600} color="#64748b" display="block" gutterBottom sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                <Typography variant="caption" display="block" sx={{ mt: 1, color: '#64748b' }}>
                  Tên miền Workspace: <strong style={{ color: '#0f172a' }}>{status?.modeB?.domain || 'thcsgiangvo.edu.vn'}</strong>
                </Typography>
              </Box>

              <Typography variant="caption" fontWeight={600} color="#64748b" gutterBottom display="block" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
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
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  py: 1.1,
                  borderRadius: '8px',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
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
