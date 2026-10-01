import type { ReactNode } from 'react';

/** Tiêu đề đầu trang dùng chung — y hệt PageHeader cũ (bản MUI), dùng ở 24
 * trang feature khác nhau nên GIỮ NGUYÊN đúng API (title/subtitle/action/
 * icon), chỉ đổi lớp hiển thị sang Tailwind. `action` thường vẫn chứa
 * Button/component MUI từ trang gọi — không vấn đề gì khi đặt cạnh layout
 * Tailwind ở đây, 2 hệ thống style không xung đột. */
export function PageHeader({
  title,
  subtitle,
  action,
  icon
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col items-start justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3.5">
        {icon && (
          <div className="grid size-[42px] shrink-0 place-items-center rounded-lg border border-blue-200 bg-gradient-to-br from-secondary to-blue-100 text-primary shadow-[0_2px_5px_rgba(37,99,235,0.08)]">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-xl leading-tight font-extrabold tracking-tight text-[#0f172a]">{title}</h1>
          {subtitle && <p className="mt-1 text-[0.84rem] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto">{action}</div>}
    </div>
  );
}
