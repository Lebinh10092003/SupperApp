import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Định dạng ngày giờ dùng chung cho mọi bảng/trang — chỉ giờ:phút, không
 * hiện giây (Sin yêu cầu 2026-10-02: hiện cả giây không cần thiết, rối mắt). */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('vi-VN');
  const timePart = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return `${timePart} ${datePart}`;
}
