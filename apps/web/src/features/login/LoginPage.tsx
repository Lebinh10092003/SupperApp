import { useState, useRef, useEffect } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-[18px]">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-1.6 4.5-5.9 7.6-11.3 7.6-6.8 0-12.3-5.5-12.3-12.3s5.5-12.3 12.3-12.3c3.1 0 5.9 1.2 8.1 3.1l5.4-5.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20.1-7.6 20.1-21 0-1.2-.1-2.4-.5-3.5z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 5.9 4.3C13.9 15.2 18.6 12 24 12c3.1 0 5.9 1.2 8.1 3.1l5.4-5.4C34.6 6.1 29.6 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-2.1 14.2-5.5l-6.5-5.5C29.7 34.8 27 35.8 24 35.8c-5.3 0-9.8-3.3-11.3-8l-6.1 4.7C9.6 39.6 16.3 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20.4H24v7.2h11.3c-.8 2.2-2.2 4-3.9 5.3l6.5 5.5C40.5 36.3 44 30.7 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

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
      <div className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_50%_-10%,#dbeafe_0%,#eff6ff_40%,#f8fafc_100%)]">
        <div className="flex flex-col items-center gap-2.5">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-slate-500">Đang xác thực đăng nhập...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(ellipse_at_50%_-10%,#dbeafe_0%,#eff6ff_40%,#f8fafc_100%)] p-4">
      <div className="w-full max-w-[440px]">
        {/* Brand Header */}
        <div className="mb-7 text-center">
          <img src="/logo-truong-transparent.png" alt="Logo trường" className="mb-4 inline-block h-[72px] w-auto object-contain" />
          <h1 className="text-[1.875rem] leading-tight font-extrabold tracking-tight text-[#0f172a]">Trường THCS Giảng Võ</h1>
        </div>

        {/* Card */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_15px_-1px_rgba(15,23,42,0.06),0_2px_4px_-2px_rgba(15,23,42,0.04)]">
          <div className="p-6 sm:p-7">
            <div className="flex flex-col gap-5">
              <div>
                <p className="font-bold tracking-tight text-[#0f172a]">Đăng nhập tài khoản</p>
                <p className="text-[0.84rem] text-slate-500">Sử dụng tài khoản Google Workspace do nhà trường cấp, hoặc email/mật khẩu đã được cấp quyền.</p>
              </div>

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}
              {info && (
                <Alert className="border-blue-200 bg-secondary">
                  <AlertDescription className="text-blue-800">{info}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full py-5 font-bold shadow-[0_2px_6px_rgba(37,99,235,0.25)]"
              >
                {googleLoading ? <Loader2 className="size-4 animate-spin" /> : <GoogleLogo />}
                {googleLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
              </Button>

              <div className="relative my-0.5">
                <Separator />
                <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs font-bold tracking-wide text-slate-400 uppercase">
                  Hoặc bằng email/mật khẩu
                </span>
              </div>

              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
                <div>
                  <Label htmlFor="login-email" className="mb-1.5 block">
                    Email
                  </Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="username"
                    ref={emailInputRef}
                  />
                </div>
                <div>
                  <Label htmlFor="login-password" className="mb-1.5 block">
                    Mật khẩu
                  </Label>
                  <div className="relative">
                    <Input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      ref={passwordInputRef}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" variant="outline" disabled={passwordLoading} className="w-full py-5 font-bold">
                  {passwordLoading && <Loader2 className="size-4 animate-spin" />}
                  {passwordLoading ? 'Đang xử lý...' : 'Đăng nhập'}
                </Button>
              </form>

              <p className="text-center text-xs text-slate-400">
                <span
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="cursor-pointer font-bold text-primary"
                >
                  Quên mật khẩu?
                </span>{' '}
                Chưa được cấp quyền? Liên hệ Quản trị viên hệ thống.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-5 text-center text-sm">
          <RouterLink to="/safety/report" className="font-bold text-red-600 no-underline">
            ← Quay lại báo cáo sự cố an toàn
          </RouterLink>
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(open) => !open && closeForgotDialog()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Quên mật khẩu</DialogTitle>
          </DialogHeader>
          {forgotSent ? (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-700">
                Đã gửi email đặt lại mật khẩu tới <strong>{forgotEmail}</strong> (nếu email này có tài khoản). Kiểm tra hộp thư (kể cả mục Spam) và
                làm theo hướng dẫn trong email.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">
                Nhập email đã đăng ký bằng mật khẩu (không áp dụng cho tài khoản chỉ đăng nhập Google) — hệ thống sẽ gửi link đặt lại mật khẩu qua
                email.
              </p>
              {forgotError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{forgotError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="forgot-email" className="mb-1.5 block">
                  Email
                </Label>
                <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} autoFocus />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={closeForgotDialog} className="text-slate-500">
              {forgotSent ? 'Đóng' : 'Huỷ'}
            </Button>
            {!forgotSent && (
              <Button disabled={forgotSending || !forgotEmail.trim()} onClick={handleForgotPassword} className="font-bold">
                {forgotSending ? 'Đang gửi...' : 'Gửi email đặt lại'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
