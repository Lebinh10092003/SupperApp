import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  type User
} from 'firebase/auth';
import { auth, googleProvider, hasValidFirebaseConfig } from '../config/firebase';
import { api } from '../services/api';

export type Profile = {
  uid: string;
  email: string;
  role: string;
  active: boolean;
  displayName?: string;
};

export type Ctx = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: () => Promise<void>;
  authError: string | null;
  clearAuthError: () => void;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  resetPasswordEmail: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    if (!hasValidFirebaseConfig) {
      // In local dev mode without live Firebase Auth credentials
      setLoading(false);
      return;
    }

    try {
      const unsub = onAuthStateChanged(
        auth,
        async (u) => {
          setUser(u);
          if (u) {
            try {
              await api('/api/session/bootstrap', { method: 'POST' });
              const me = await api<Profile>('/api/session/me');
              setProfile(me);
            } catch (err) {
              console.warn('Session init warning:', err);
            }
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.warn('Firebase auth state change notice:', error.message);
          setLoading(false);
        }
      );
      return () => unsub();
    } catch (e) {
      console.warn('Firebase auth init:', e);
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    setProfile(null);
    setUser(null);
    if (hasValidFirebaseConfig) {
      try {
        await signOut(auth);
      } catch {
        // ignore
      }
    }
  };

  // Xác thực Firebase (Google/email+mật khẩu) chỉ chứng minh DANH TÍNH —
  // còn có được vào hệ thống hay không do bootstrap quyết định (email phải
  // nằm trong accessAllowlist do Quản trị viên cấp qua trang /admin trước
  // đó). Gọi bootstrap ngay tại đây (thay vì chỉ dựa vào onAuthStateChanged)
  // để lỗi "chưa được cấp quyền" ném thẳng về đúng chỗ người dùng bấm nút
  // đăng nhập, không bị nuốt âm thầm trong listener nền — và đăng xuất luôn
  // tài khoản Firebase vừa tạo/đăng nhập nếu bị từ chối, tránh kẹt ở trạng
  // thái "đã có Firebase user nhưng không có profile".
  const completeLogin = async () => {
    try {
      await api('/api/session/bootstrap', { method: 'POST' });
      const me = await api<Profile>('/api/session/me');
      setProfile(me);
    } catch (e) {
      await signOut(auth).catch(() => {});
      setUser(null);
      throw e;
    }
  };

  // Bắt kết quả sau khi Google đưa trang quay lại (signInWithRedirect
  // không có promise "chờ tới lúc xong" như popup — phải tự kiểm tra ở đây
  // mỗi khi app tải lên). result === null nghĩa là trang tải bình thường,
  // không phải vừa quay về từ redirect đăng nhập — bỏ qua, không phải lỗi.
  useEffect(() => {
    if (!hasValidFirebaseConfig) return;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) return;
        try {
          await completeLogin();
        } catch (e: any) {
          console.error('[Auth] completeLogin() sau redirect thất bại:', e);
          setAuthError(e?.message && !e?.code ? e.message : e?.code || 'Đăng nhập không thành công.');
        }
      })
      .catch((e: any) => {
        console.error('[Auth] getRedirectResult() lỗi:', e);
        setAuthError(e?.code || e?.message || 'Đăng nhập không thành công.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Đổi từ signInWithPopup sang signInWithRedirect (Sin phản hồi 2026-09-14:
  // popup báo lỗi "đã bị đóng trước khi hoàn tất" — auth/popup-closed-by-user).
  // Nguyên nhân phổ biến: Chrome ngày càng chặn cookie bên thứ 3 theo mặc
  // định, mà popup của Firebase cần cookie đó để giao tiếp ngược lại tab
  // gốc. signInWithRedirect điều hướng thẳng cả trang, không cần cookie
  // bên thứ 3, nên không dính lỗi này — đánh đổi là rời trang tạm thời rồi
  // quay lại (thay vì mở cửa sổ con), xử lý kết quả ở effect bên dưới qua
  // getRedirectResult() khi trang tải lại sau khi Google trả về.
  const login = async () => {
    setAuthError(null);
    await signInWithRedirect(auth, googleProvider);
  };

  const loginWithPassword = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await completeLogin();
  };

  // Firebase tự gửi email đặt lại mật khẩu thật (không cần cấu hình SMTP
  // riêng — khác hẳn kênh thông báo tự viết của module An toàn) — chỉ hoạt
  // động cho tài khoản ĐÃ ĐĂNG KÝ bằng email/mật khẩu (không áp dụng cho
  // tài khoản chỉ đăng nhập Google).
  const resetPasswordEmail = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  // Đổi mật khẩu ngay trong phiên đang đăng nhập — Firebase yêu cầu
  // reauthenticate bằng mật khẩu hiện tại trước khi cho updatePassword nếu
  // phiên đăng nhập không còn "recent" (thường quá 5 phút), nên luôn xác
  // thực lại bằng mật khẩu hiện tại trước cho chắc, không phụ thuộc thời
  // gian phiên. Chỉ áp dụng cho tài khoản có provider email/mật khẩu (tài
  // khoản chỉ đăng nhập Google không có mật khẩu để đổi).
  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
      throw new Error('Không xác định được tài khoản đang đăng nhập.');
    }
    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  };

  const updateDisplayName = async (displayName: string) => {
    const updated = await api<Profile>('/api/session/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName })
    });
    setProfile(updated);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      authError,
      clearAuthError,
      loginWithPassword,
      resetPasswordEmail,
      changePassword,
      updateDisplayName,
      logout
    }),
    [user, profile, loading, authError]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useAuth = () => {
  const x = useContext(C);
  if (!x) throw new Error('Missing AuthProvider');
  return x;
};