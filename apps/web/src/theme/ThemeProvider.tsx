import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontScale = 'sm' | 'md' | 'lg';

const FONT_SCALE_MULT: Record<FontScale, number> = { sm: 0.9, md: 1, lg: 1.15 };
const THEME_KEY = 'appTheme';
const FONT_SCALE_KEY = 'appFontScale';

interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function readStoredFontScale(): FontScale {
  const v = localStorage.getItem(FONT_SCALE_KEY);
  return v === 'sm' || v === 'md' || v === 'lg' ? v : 'md';
}

/** Theo dõi dark/sáng + cỡ chữ cho toàn app — thay class `.dark` trên
 * <html> (xem styles.css, @custom-variant dark dựa vào class này, KHÔNG
 * dựa vào prefers-color-scheme trực tiếp) và biến CSS `--font-scale-mult`.
 * Lựa chọn của người dùng lưu localStorage, áp dụng lại ngay khi mở app
 * (không có màn hình "nhấp nháy sai theme" vì index.html chạy 1 đoạn script
 * nhỏ gắn class trước khi React mount — xem index.html). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(readStoredTheme);
  const [fontScale, setFontScaleState] = useState<FontScale>(readStoredFontScale);

  useEffect(() => {
    const root = document.documentElement;
    const applyResolved = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const resolved = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
      root.classList.toggle('dark', resolved === 'dark');
    };
    applyResolved();
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyResolved);
    return () => mq.removeEventListener('change', applyResolved);
  }, [theme]);

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale-mult', String(FONT_SCALE_MULT[fontScale]));
  }, [fontScale]);

  const setTheme = (t: ThemeMode) => {
    localStorage.setItem(THEME_KEY, t);
    setThemeState(t);
  };
  const setFontScale = (s: FontScale) => {
    localStorage.setItem(FONT_SCALE_KEY, s);
    setFontScaleState(s);
  };

  return <ThemeContext.Provider value={{ theme, setTheme, fontScale, setFontScale }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải dùng bên trong <ThemeProvider>');
  return ctx;
}
