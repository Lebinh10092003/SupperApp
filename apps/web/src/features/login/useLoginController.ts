import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';

/**
 * Toàn bộ state + logic đăng nhập — trích xuất từ LoginPage.tsx (bản
 * desktop) để dùng CHUNG với MobileLoginPage.tsx (mới, antd-mobile) —
 * sửa 1 nơi, 2 bản hiển thị không lệch nhau. Không import MUI/antd-mobile
 * ở đây — file này phải "sạch" để LoginPage.tsx (import TĨNH, luôn nằm
 * trong bundle chính vì ai ghé /login cũng cần, kể cả trước khi biết
 * màn hình rộng/hẹp) không vô tình kéo theo antd-mobile.
 */
export function friendlyAuthError(e: any): string {
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
      return e?.message && !code ? e.message : 'Đăng nhập không thành công. Vui lòng thử lại.';
  }
}

export function useLoginController() {
  const { profile, loading, login, loginWithPassword, resetPasswordEmail, authError, clearAuthError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handlePasswordSubmit = async (e: { preventDefault: () => void }) => {
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

  return {
    profile,
    loading,
    email,
    setEmail,
    password,
    setPassword,
    error,
    info,
    googleLoading,
    passwordLoading,
    forgotOpen,
    setForgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotSending,
    forgotError,
    forgotSent,
    emailInputRef,
    passwordInputRef,
    handleForgotPassword,
    closeForgotDialog,
    handleGoogleLogin,
    handlePasswordSubmit
  };
}
