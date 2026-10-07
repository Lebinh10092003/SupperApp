import { Laptop, Moon, Settings, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type FontScale, type ThemeMode } from '../theme/ThemeProvider';

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Sáng', icon: Sun },
  { value: 'dark', label: 'Tối', icon: Moon },
  { value: 'system', label: 'Hệ thống', icon: Laptop }
];

const FONT_SCALE_OPTIONS: { value: FontScale; label: string }[] = [
  { value: 'sm', label: 'Nhỏ' },
  { value: 'md', label: 'Vừa' },
  { value: 'lg', label: 'Lớn' }
];

/** Nút cài đặt giao diện ở Topbar — chọn Sáng/Tối/Theo hệ thống + cỡ chữ,
 * lưu localStorage qua ThemeProvider.tsx (xem file đó). Không cần backend —
 * đây là tuỳ chọn hiển thị cá nhân, không phải dữ liệu nghiệp vụ. */
export function AppearanceSettings() {
  const { theme, setTheme, fontScale, setFontScale } = useTheme();

  return (
        <div className="max-w-xl space-y-5">
          <div>
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Giao diện</p>
            <div className="grid grid-cols-3 gap-1.5">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs font-semibold transition-colors',
                    theme === value
                      ? 'border-primary bg-secondary text-primary'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  <Icon className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500 dark:text-slate-400">Cỡ chữ</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FONT_SCALE_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFontScale(value)}
                  className={cn(
                    'rounded-lg border px-2 py-2 text-xs font-semibold transition-colors',
                    fontScale === value
                      ? 'border-primary bg-secondary text-primary'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
  );
}

export function SettingsPanel({ onOpen }: { onOpen: () => void }) {
  return <button type="button" onClick={onOpen} className="flex size-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Cài đặt"><Settings className="size-[18px]" /></button>;
}
