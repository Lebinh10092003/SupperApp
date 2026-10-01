import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

const EMERGENCY_NUMBERS = [
  { num: '112', label: 'Khẩn cấp' },
  { num: '113', label: 'Công an' },
  { num: '114', label: 'PCCC' },
  { num: '115', label: 'Cấp cứu' },
  { num: '111', label: 'Trẻ em' }
];

/** Nút nổi liên hệ khẩn cấp — dính bên cạnh màn hình khi CUỘN (khác banner
 * tĩnh 1 lần đầu trang). Mỗi số LUÔN kèm nhãn ngắn để biết đúng số nào gọi
 * việc gì, không chỉ có icon mập mờ — Sin phản hồi 2026-09-11: "phải đủ
 * thông tin rút gọn để biết số nào số nào chứ không phải để mỗi số". */
function EmergencyFab() {
  return (
    <nav
      aria-label="Số điện thoại khẩn cấp"
      className="fixed top-[60%] right-0 z-40 flex -translate-y-1/2 flex-col overflow-hidden rounded-l-[14px] bg-gradient-to-b from-red-500 to-red-700 shadow-[-3px_4px_16px_rgba(0,0,0,0.28)]"
    >
      {EMERGENCY_NUMBERS.map((e, i) => (
        <a
          key={e.num}
          href={`tel:${e.num}`}
          className={cn(
            'flex min-h-11 min-w-[54px] flex-col items-center justify-center px-2 py-1.5 text-white no-underline active:bg-white/20',
            i < EMERGENCY_NUMBERS.length - 1 && 'border-b border-white/20'
          )}
        >
          <span className="text-base leading-tight font-extrabold">{e.num}</span>
          <span className="text-[0.56rem] leading-tight font-semibold opacity-95">{e.label}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Chrome tối thiểu cho 2 trang công khai (không đăng nhập) — không AppShell/
 * sidebar, cùng tinh thần LoginPage.tsx (full-bleed Box riêng).
 */
export function PublicLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="relative min-h-screen bg-[radial-gradient(ellipse_at_50%_-10%,#dbeafe_0%,#eff6ff_40%,#f8fafc_100%)] px-4 py-5 md:py-8">
      <EmergencyFab />
      <div className="absolute top-2.5 right-3 md:top-3.5 md:right-6">
        <Link to="/login" className="text-xs font-semibold text-slate-500 no-underline hover:underline">
          Đăng nhập nội bộ →
        </Link>
      </div>
      <div className="mx-auto max-w-[720px]">
        <div className="mb-3 text-center">
          <img src="/logo-truong-transparent.png" alt="Logo trường" className="mb-2 inline-block h-11 w-auto object-contain" />
          <h1 className="text-lg leading-tight font-extrabold tracking-tight text-[#0f172a]">Trường THCS Giảng Võ</h1>
          <p className="mt-0.5 text-[0.9rem] font-bold text-red-600">{title}</p>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}
