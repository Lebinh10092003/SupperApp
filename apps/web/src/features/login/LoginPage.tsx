import { useState, useRef, useEffect } from 'react';
import { Box, Button, Card, CardContent, Typography, Stack, Divider, TextField, Alert, CircularProgress, InputAdornment, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import VisibilityOffRoundedIcon from '@mui/icons-material/VisibilityOffRounded';
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
  const { profile, loading, login, loginWithPassword, resetPasswordEmail, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Chrome/Safari tự điền email+mật khẩu đã lưu THẲNG vào DOM khi tải lại
  // trang, không bắn sự kiện onChange của React — nên state (và nút "Đăng
  // nhập" khoá theo state) không hay biết gì, trông như nút bị "kẹt" disable
  // cho tới khi người dùng bấm/gõ lại. Đọc thẳng giá trị DOM ngay sau khi
  // mount để đồng bộ lại state, khớp với autofill.
  useEffect(() => {
    const t = setTimeout(() => {
      if (emailInputRef.current?.value) setEmail(emailInputRef.current.value);
      if (passwordInputRef.current?.value) setPassword(passwordInputRef.current.value);
    }, 300);
    return () => clearTimeout(t);
  }, []);

  // Kết quả đăng nhập Google (signInWithRedirect) chỉ có được SAU KHI trang
  // tải lại — AuthProvider tự kiểm tra qua getRedirectResult() và đẩy lỗi
  // (nếu có) ra đây qua context, vì handleGoogleLogin() bên dưới không còn
  // "chờ được" tới lúc xong như kiểu popup cũ nữa.
  useEffect(() => {
    if (authError) {
      setError(friendlyAuthError(authError.startsWith('auth/') ? { code: authError } : { message: authError }));
      clearAuthError();
    }
  }, [authError, clearAuthError]);

  const handleForgotPassword = async () => {
    if (!forgotEmail.trim()) return;
    setForgotError('');
    setForgotSending(true);
    try {
      await resetPasswordEmail(forgotEmail.trim());
      setForgotSent(true);
    } catch (e: any) {
      setForgotError(friendlyAuthError(e));
    } finally {
      setForgotSending(false);
    }
  };

  const closeForgotDialog = () => {
    setForgotOpen(false);
    setForgotEmail('');
    setForgotError('');
    setForgotSent(false);
  };

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
    const emailVal = emailInputRef.current?.value ?? email;
    const passwordVal = passwordInputRef.current?.value ?? password;
    if (!emailVal.trim() || !passwordVal) return;
    setError('');
    setInfo('');
    setPasswordLoading(true);
    try {
      await loginWithPassword(emailVal.trim(), passwordVal);
    } catch (e: any) {
      setError(friendlyAuthError(e));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (profile) {
    return <Navigate to="/" replace />;
  }

  // AuthProvider đang xử lý (thường là vừa quay lại từ signInWithRedirect —
  // trang tải lại từ đầu, googleLoading của component này reset về false dù
  // Google đã đăng nhập xong, đang chờ getRedirectResult()+bootstrap phía
  // sau) — hiện loading toàn màn hình thay vì để trơ ra y hệt lúc chưa đăng
  // nhập, tránh cảm giác bị đứng máy trong lúc redirect xử lý (10-15s).
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'radial-gradient(ellipse at 50% -10%, #dbeafe 0%, #eff6ff 40%, #f8fafc 100%)'
        }}
      >
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
            Đang xác thực đăng nhập...
          </Typography>
        </Stack>
      </Box>
    );
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
            component="img"
            src="/logo-truong-transparent.png"
            alt="Logo trường"
            sx={{
              display: 'inline-block',
              width: 'auto',
              height: 72,
              objectFit: 'contain',
              mb: 2
            }}
          />
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
            Trường THCS Giảng Võ
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
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap'
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
                    inputRef={emailInputRef}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    type={showPassword ? 'text' : 'password'}
                    label="Mật khẩu"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    inputRef={passwordInputRef}
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end" tabIndex={-1}>
                              {showPassword ? <VisibilityOffRoundedIcon fontSize="small" /> : <VisibilityRoundedIcon fontSize="small" />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }
                    }}
                  />
                  <Button
                    type="submit"
                    variant="outlined"
                    fullWidth
                    disabled={passwordLoading}
                    startIcon={passwordLoading ? <CircularProgress size={16} /> : undefined}
                    sx={{
                      py: 1.1,
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      textTransform: 'none',
                      borderRadius: 2
                    }}
                  >
                    {passwordLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                  </Button>
                </Stack>
              </Box>

              <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.72rem', textAlign: 'center' }}>
                <Box
                  component="span"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  sx={{ color: '#2563eb', fontWeight: 700, cursor: 'pointer' }}
                >
                  Quên mật khẩu?
                </Box>{' '}
                Chưa được cấp quyền? Liên hệ Quản trị viên hệ thống.
              </Typography>
            </Stack>
          </CardContent>
        </Card>

        <Typography variant="body2" sx={{ textAlign: 'center', mt: 2.5 }}>
          <RouterLink
            to="/safety/report"
            style={{ color: '#dc2626', fontWeight: 700, textDecoration: 'none', fontSize: '0.84rem' }}
          >
            ← Quay lại báo cáo sự cố an toàn
          </RouterLink>
        </Typography>

      </Box>

      <Dialog open={forgotOpen} onClose={closeForgotDialog} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Quên mật khẩu</DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {forgotSent ? (
              <Alert severity="success">
                Đã gửi email đặt lại mật khẩu tới <strong>{forgotEmail}</strong> (nếu email này có tài khoản). Kiểm tra hộp thư (kể cả mục Spam) và làm theo hướng dẫn trong email.
              </Alert>
            ) : (
              <>
                <Typography variant="body2" color="text.secondary">
                  Nhập email đã đăng ký bằng mật khẩu (không áp dụng cho tài khoản chỉ đăng nhập Google) — hệ thống sẽ gửi link đặt lại mật khẩu qua email.
                </Typography>
                {forgotError && <Alert severity="error">{forgotError}</Alert>}
                <TextField
                  label="Email"
                  type="email"
                  size="small"
                  fullWidth
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  autoFocus
                />
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={closeForgotDialog} sx={{ textTransform: 'none', color: '#64748b' }}>
            {forgotSent ? 'Đóng' : 'Huỷ'}
          </Button>
          {!forgotSent && (
            <Button
              variant="contained"
              disabled={forgotSending || !forgotEmail.trim()}
              onClick={handleForgotPassword}
              sx={{ bgcolor: '#2563eb', color: '#fff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
            >
              {forgotSending ? 'Đang gửi...' : 'Gửi email đặt lại'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
