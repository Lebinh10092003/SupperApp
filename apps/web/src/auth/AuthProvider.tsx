import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
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
  loginDemo: (role?: string, name?: string, email?: string) => void;
  logout: () => Promise<void>;
};

const C = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const saved = localStorage.getItem('gv_dev_profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
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

  const loginDemo = (
    role = 'SYSTEM_ADMIN',
    name = 'Ban Giám Hiệu — THCS Giảng Võ',
    email = 'bgh@thcs-giangvo.edu.vn'
  ) => {
    const devProfile: Profile = {
      uid: 'demo-user-gv',
      email,
      role,
      active: true,
      displayName: name
    };
    localStorage.setItem('gv_dev_profile', JSON.stringify(devProfile));
    localStorage.setItem('gv_dev_token', `dev:${email}:${role}`);
    setProfile(devProfile);
  };

  const logout = async () => {
    localStorage.removeItem('gv_dev_profile');
    localStorage.removeItem('gv_dev_token');
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

  const login = async () => {
    if (!hasValidFirebaseConfig) {
      loginDemo('SYSTEM_ADMIN');
      return;
    }
    await signInWithPopup(auth, googleProvider);
  };

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      loginDemo,
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