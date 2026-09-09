/**
 * vntime.ts — Quy đổi giờ Việt Nam (UTC+7, không có giờ mùa hè) TƯỜNG MINH,
 * không dựa vào múi giờ hệ thống của server. Port 1-1 từ `vntime.js`.
 */

export const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

export interface VnParts {
  year: number;
  month: number; // 0-based
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0 = Chủ nhật
}

/** Các thành phần ngày giờ theo "đồng hồ treo tường" ở Việt Nam. */
export function toVnParts(date: Date): VnParts {
  const shifted = new Date(date.getTime() + VN_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay()
  };
}

/** Dựng lại Date (thời điểm UTC thật) từ các thành phần giờ Việt Nam. */
export function fromVnParts(parts: { year: number; month: number; day: number; hour?: number; minute?: number; second?: number }): Date {
  const ms = Date.UTC(parts.year, parts.month, parts.day, parts.hour || 0, parts.minute || 0, parts.second || 0);
  return new Date(ms - VN_OFFSET_MS);
}

export function isoDateVn(date: Date): string {
  const p = toVnParts(date);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}
