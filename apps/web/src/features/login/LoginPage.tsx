import { useState } from 'react';
import { Box, Button, Card, CardContent, Typography, Stack, Divider, TextField, Alert, CircularProgress } from '@mui/material';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import GoogleIcon from '@mui/icons-material/Google';
import { useAuth } from '../../auth/AuthProvider';

function friendlyAuthError(e: any): string {
  const code = e?.code || '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Email hoặc mật khẩu không đúng.';
    case 'auth/too-many-requests':
      return 'Đã thử sai quá nhiều lần, vui lòng đợi ít phút rồi thử lại.';
    case 'auth/popup-closed-by-user':
      return 'Cửa sổ đăng nhập Google đã bị đóng trước khi hoàn tất.';
    case 'auth/user-disabled':
      return 'Tài khoản đã bị vô hiệu hóa.';
    case 'auth/email-already-in-use':
      return 'Email này đã có tài khoản — hãy đăng nhập thay vì tạo mới.';
    case 'auth/weak-password':
      return 'Mật khẩu quá ngắn — cần tối thiểu 6 ký tự.';
    case 'auth/invalid-email':
      return 'Địa chỉ email không hợp lệ.';
    default:
      // Lỗi từ backend bootstrap (VD "Tài khoản chưa được cấp quyền") đã là
      // tiếng Việt, thân thiện sẵn — không có `.code` (không phải lỗi
      // Firebase) nên hiển thị thẳng message thay vì rơi vào câu chung
      // chung ở dưới.
      return e?.message && !code ? e.message : 'Đăng nhập không thành công. Vui lòng thử lại.';
  }
}

export default function LoginPage() {
  const { profile, login, loginWithPassword, registerWithPassword } = useAuth();
  const [mode, setMode] = useState<'signin' | 'register'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setInfo('');
    setGoogleLoading(true);
    try {
      await login();
    } catch (e: any) {
      setError(friendlyAuthError(e));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setError('');
    setInfo('');
    setPasswordLoading(true);
    try {
      if (mode === 'register') {
        await registerWithPassword(email.trim(), password);
      } else {
        await loginWithPassword(email.trim(), password);
      }
    } catch (e: any) {
      if (mode === 'register' && e?.message && !e?.code) {
        // Tài khoản Firebase (email+mật khẩu) đã tạo thành công, chỉ là
        // chưa nằm trong accessAllowlist — báo rõ để người dùng biết cần
        // làm gì tiếp, không hiểu nhầm là "tạo tài khoản thất bại".
        setInfo('Đã tạo tài khoản, nhưng email này chưa được cấp quyền truy cập. Liên hệ Quản trị viên hệ thống để được duyệt, sau đó quay lại đăng nhập.');
        setMode('signin');
      } else {
        setError(friendlyAuthError(e));
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  if (profile) {
    return <Navigate to="/" replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at 50% -10%, #dbeafe 0%, #eff6ff 40%, #f8fafc 100%)',
        p: 2
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 440 }}>
        {/* Brand Header */}
        <Box sx={{ textAlign: 'center', mb: 3.5 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 52,
              height: 52,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
              color: '#ffffff',
              mb: 2,
              boxShadow: '0 6px 16px rgba(37, 99, 235, 0.3)'
            }}
          >
            <SchoolIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            THCS Giảng Võ
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#2563eb', mt: 0.5, fontSize: '1rem', letterSpacing: '-0.01em' }}>
            School Intelligence Portal
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, fontSize: '0.84rem' }}>
            Nền tảng quản trị điều hành lớp học số & phân tích sư phạm thông minh
          </Typography>
        </Box>

        {/* Card */}
        <Card
          sx={{
            borderRadius: 3,
            border: '1px solid #e2e8f0',
            boxShadow: '0 4px 15px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
            bgcolor: '#ffffff',
            overflow: 'hidden'
          }}
        >
          <CardContent sx={{ p: { xs: 3, sm: 3.5 } }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Đăng nhập tài khoản
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.84rem' }}>
                  Sử dụng tài khoản Google Workspace do nhà trường cấp, hoặc email/mật khẩu đã được cấp quyền.
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}
              {info && <Alert severity="info">{info}</Alert>}

              <Button
                variant="contained"
                fullWidth
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                startIcon={googleLoading ? <CircularProgress size={16} color="inherit" /> : <GoogleIcon sx={{ fontSize: 18 }} />}
                sx={{
                  py: 1.25,
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  textTransform: 'none',
                  borderRadius: 2,
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)',
                  '&:hover': { bgcolor: '#1d4ed8' }
                }}
              >
                {googleLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
              </Button>

              <Box sx={{ position: 'relative', my: 0.5 }}>
                <Divider sx={{ borderColor: '#e2e8f0' }} />
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    bgcolor: '#ffffff',
                    px: 1.5,
                    color: '#94a3b8',
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}
                >
                  Hoặc bằng email/mật khẩu
                </Typography>
              </Box>

              <Box component="form" onSubmit={handlePasswordSubmit}>
                <Stack spacing={1.25}>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type="password"
                    label="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    helperText={mode === 'register' ? 'Tối thiểu 6 ký tự' : ' '}
                  />
                  <Button
                    type="submit"
                    variant="outlined"
                    fullWidth
                    disabled={passwordLoading || !email.trim() || !password}
                    startIcon={passwordLoading ? <CircularProgress size={16} /> : undefined}
                    sx={{
                      py: 1.1,
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      textTransform: 'none',
                      borderRadius: 2
                    }}
                  >
                    {passwordLoading ? 'Đang xử lý...' : mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập'}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', textAlign: 'center' }}>
                {mode === 'signin' ? (
                  <>
                    Chưa có tài khoản email/mật khẩu?{' '}
                    <Box
                      component="span"
                      onClick={() => {
                        setMode('register');
                        setError('');
                        setInfo('');
                      }}
                      sx={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Tạo tài khoản mới
                    </Box>
                    . Quên mật khẩu hoặc chưa được cấp quyền? Liên hệ Quản trị viên hệ thống.
                  </>
                ) : (
                  <>
                    Tạo tài khoản xong vẫn cần Quản trị viên hệ thống duyệt quyền truy cập.{' '}
                    <Box
                      component="span"
                      onClick={() => {
                        setMode('signin');
                        setError('');
                        setInfo('');
                      }}
                      sx={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                    >
                      Quay lại đăng nhập
                    </Box>
                  </>
                )}
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="body2" sx={{ textAlign: 'center', mt: 2.5 }}>
          <RouterLink
            to="/safety/report"
            style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none', fontSize: '0.84rem' }}
          >
            ← Quay lại báo cáo sự cố an toàn (không cần đăng nhập)
          </RouterLink>
        </Typography>

        {/* Footer */}
        <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', mt: 1.5, color: '#64748b', fontSize: '0.75rem' }}>
          Trường THCS Giảng Võ — Ba Đình, Hà Nội • School Intelligence System
        </Typography>
      </Box>
    </Box>
  );
}
