/**
 * MobileLoginPage.tsx — bản đăng nhập native cho điện thoại (antd-mobile),
 * thay cho việc tái sử dụng LoginPage.tsx (desktop) vốn là kiểu "card giữa
 * màn hình trên nền gradient" — Sin: "phần login chưa phù hợp trên đt lắm".
 * Logo lớn (72px) + tiêu đề h4 chiếm quá nhiều chỗ trước khi chạm tới nút
 * đăng nhập trên màn hình hẹp. Bản này rút gọn phần hero, đưa nút "Đăng
 * nhập với Google" lên gần đầu màn hình, dùng NGUYÊN logic từ
 * `useLoginController()` (không lặp code với bản desktop).
 */
import { useState } from 'react';
import { Button as AntButton, Input, Dialog as AntDialog, Toast } from 'antd-mobile';
import { EyeOutline, EyeInvisibleOutline } from 'antd-mobile-icons';
import { Navigate } from 'react-router-dom';
import { useLoginController } from '../../features/login/useLoginController';

export default function MobileLoginPage() {
  const {
    profile,
    loading,
    email,
    setEmail,
    password,
    setPassword,
    error,
    googleLoading,
    passwordLoading,
    forgotOpen,
    setForgotOpen,
    forgotEmail,
    setForgotEmail,
    forgotSending,
    forgotError,
    forgotSent,
    handleForgotPassword,
    closeForgotDialog,
    handleGoogleLogin,
    handlePasswordSubmit
  } = useLoginController();
  const [showPassword, setShowPassword] = useState(false);

  if (profile) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#f8fafc',
          color: '#64748b',
          fontSize: 14,
          fontWeight: 600
        }}
      >
        Đang xác thực đăng nhập...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: '#f8fafc',
        paddingTop: 'max(env(safe-area-inset-top), 28px)',
        paddingBottom: 'max(env(safe-area-inset-bottom), 20px)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px 20px' }}>
        <img src="/logo-truong-transparent.png" alt="Logo trường" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <div style={{ fontWeight: 800, fontSize: 17, color: '#0f172a', letterSpacing: '-0.02em' }}>Trường THCS Giảng Võ</div>
      </div>

      <div style={{ flex: 1, padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontWeight: 800, fontSize: 24, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 4 }}>Đăng nhập</div>
        <div style={{ fontSize: 13.5, color: '#64748b', marginBottom: 20 }}>
          Dùng tài khoản Google Workspace do nhà trường cấp, hoặc email/mật khẩu đã được cấp quyền.
        </div>

        {error && (
          <div
            style={{
              background: '#fef2f2',
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
              padding: '10px 12px',
              borderRadius: 10,
              marginBottom: 14
            }}
          >
            {error}
          </div>
        )}

        <AntButton
          block
          color="primary"
          loading={googleLoading}
          onClick={handleGoogleLogin}
          style={{ '--background-color': '#2563eb', fontWeight: 700, fontSize: 15, height: 46, borderRadius: 12 }}
        >
          {googleLoading ? 'Đang đăng nhập...' : 'Đăng nhập với Google'}
        </AntButton>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Hoặc bằng email
          </div>
          <div style={{ flex: 1, height: 1, background: '#e2e8f0' }} />
        </div>

        <form
          onSubmit={handlePasswordSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Email</div>
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="ten@thcsgiangvo.edu.vn"
              autoComplete="username"
              style={{ '--font-size': '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }}
            />
          </div>
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#475569', marginBottom: 5 }}>Mật khẩu</div>
            <div style={{ position: 'relative' }}>
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                autoComplete="current-password"
                style={{ '--font-size': '15px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 40px 10px 12px' }}
              />
              <div
                onClick={() => setShowPassword((v) => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: 18 }}
              >
                {showPassword ? <EyeInvisibleOutline /> : <EyeOutline />}
              </div>
            </div>
          </div>

          <AntButton
            type="submit"
            block
            loading={passwordLoading}
            style={{ fontWeight: 700, fontSize: 15, height: 44, borderRadius: 12, marginTop: 4 }}
          >
            {passwordLoading ? 'Đang xử lý...' : 'Đăng nhập'}
          </AntButton>
        </form>

        <div style={{ textAlign: 'center', fontSize: 12.5, color: '#94a3b8', marginTop: 16 }}>
          <span style={{ color: '#2563eb', fontWeight: 700 }} onClick={() => { setForgotEmail(email); setForgotOpen(true); }}>
            Quên mật khẩu?
          </span>{' '}
          Chưa được cấp quyền? Liên hệ Quản trị viên hệ thống.
        </div>

        <div style={{ flex: 1 }} />

        <a
          href="/safety/report"
          style={{ textAlign: 'center', color: '#dc2626', fontWeight: 700, fontSize: 13, textDecoration: 'none', padding: '16px 0 4px' }}
        >
          ← Quay lại báo cáo sự cố an toàn
        </a>
      </div>

      <AntDialog
        visible={forgotOpen}
        onClose={closeForgotDialog}
        title="Quên mật khẩu"
        content={
          forgotSent ? (
            <div style={{ fontSize: 13.5, color: '#15803d' }}>
              Đã gửi email đặt lại mật khẩu tới <strong>{forgotEmail}</strong> (nếu email này có tài khoản). Kiểm tra hộp thư (kể cả mục Spam).
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10 }}>
                Nhập email đã đăng ký bằng mật khẩu (không áp dụng cho tài khoản chỉ đăng nhập Google).
              </div>
              {forgotError && (
                <div style={{ background: '#fef2f2', color: '#b91c1c', fontSize: 12.5, fontWeight: 600, padding: '8px 10px', borderRadius: 8, marginBottom: 10 }}>
                  {forgotError}
                </div>
              )}
              <Input type="email" value={forgotEmail} onChange={setForgotEmail} placeholder="Email" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px' }} />
            </div>
          )
        }
        actions={
          forgotSent
            ? [[{ key: 'close', text: 'Đóng', onClick: closeForgotDialog }]]
            : [
                [
                  { key: 'cancel', text: 'Huỷ', onClick: closeForgotDialog },
                  {
                    key: 'send',
                    text: forgotSending ? 'Đang gửi...' : 'Gửi email',
                    bold: true,
                    disabled: forgotSending || !forgotEmail.trim(),
                    onClick: async () => {
                      await handleForgotPassword();
                      Toast.show({ content: 'Đã gửi (nếu email hợp lệ)' });
                    }
                  }
                ]
              ]
        }
      />
    </div>
  );
}
