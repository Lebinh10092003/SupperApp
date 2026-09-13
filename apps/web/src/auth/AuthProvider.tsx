import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, type User } from 'firebase/auth';
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
  loginWithPassword: (email: string, password: string) => Promise<void>;
  registerWithPassword: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

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

  const login = async () => {
    await signInWithPopup(auth, googleProvider);
    await completeLogin();
  };

  const loginWithPassword = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    await completeLogin();
  };

  const registerWithPassword = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password);
    await completeLogin();
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      loginWithPassword,
      registerWithPassword,
      logout
    }),
    [user, profile, loading]
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export const useAuth = () => {
  const x = useContext(C);
  if (!x) throw new Error('Missing AuthProvider');
  return x;
};