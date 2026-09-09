/**
 * report-filters.ts — Lọc THUẦN (không đụng DB), port 1-1 từ
 * `reportFilters.js`, dùng chung cho `listPendingReports`/`listIncidents`.
 * Field dùng camelCase (khớp shape Drizzle/route trả về) — bản gốc
 * Firestore dùng snake_case cho `filterIncidentItems` vì thao tác trực
 * tiếp trên document thô, ở đây route đã convert sang camelCase trước khi
 * gọi nên đổi theo cho nhất quán với toàn bộ phần còn lại của dự án.
 */

import { toJsDate } from './shared.js';
import { normalizeForMatch } from './zoneStats.js';

function parseDateInput(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * inDateRange — so `fieldValue` với khoảng [fromDate, toDate] (chuỗi ISO, 1
 * trong 2 đầu có thể bỏ trống). `toDate` so theo NGÀY (cộng tới hết ngày
 * 23:59:59.999) để "đến ngày X" bao trọn cả ngày X — đúng cách input
 * type="date" trên UI mong đợi.
 */
export function inDateRange(fieldValue: unknown, fromDate?: string | null, toDate?: string | null): boolean {
  if (!fromDate && !toDate) return true;
  const value = fieldValue ? toJsDate(fieldValue as Date | string) : null;
  if (!value) return false;
  if (fromDate) {
    const from = parseDateInput(fromDate);
    if (from && value.getTime() < from.getTime()) return false;
  }
  if (toDate) {
    const to = parseDateInput(toDate);
    if (to) {
      const toEndOfDay = new Date(to.getTime());
      toEndOfDay.setHours(23, 59, 59, 999);
      if (value.getTime() > toEndOfDay.getTime()) return false;
    }
  }
  return true;
}

export interface ReportListItem {
  reportId?: string;
  publicCode?: string;
  campusId?: string;
  categoryCode?: string;
  content?: string | null;
  stillDangerous?: boolean;
  occurredAt?: Date | string | null;
  [key: string]: unknown;
}

export interface ReportFilterInput {
  campusId?: string;
  categoryCodes?: string[];
  searchText?: string;
  stillDangerous?: boolean;
  fromDate?: string;
  toDate?: string;
}

/** filterReportItems — `stillDangerous` (tuỳ chọn) có truyền thì CHỈ giữ đúng giá trị đó; không truyền = giữ tất cả. */
export function filterReportItems<T extends ReportListItem>(items: T[] | null | undefined, input: ReportFilterInput = {}): T[] {
  let out = items || [];
  if (input.campusId) out = out.filter((it) => it.campusId === input.campusId);
  if (Array.isArray(input.categoryCodes) && input.categoryCodes.length > 0) {
    out = out.filter((it) => !!it.categoryCode && input.categoryCodes!.includes(it.categoryCode));
  }
  if (typeof input.stillDangerous === 'boolean') {
    out = out.filter((it) => !!it.stillDangerous === input.stillDangerous);
  }
  if (input.fromDate || input.toDate) {
    out = out.filter((it) => inDateRange(it.occurredAt, input.fromDate, input.toDate));
  }
  if (input.searchText && input.searchText.trim()) {
    const norm = normalizeForMatch(input.searchText);
    const lowerSearch = input.searchText.toLowerCase();
    out = out.filter(
      (it) =>
        normalizeForMatch(it.content ?? '').includes(norm) ||
        String(it.reportId).toLowerCase().includes(lowerSearch) ||
        String(it.publicCode).toLowerCase().includes(lowerSearch)
    );
  }
  return out;
}

/**
 * sortReportItemsDefault — tin "còn nguy hiểm" lên đầu bất kể tiêu chí lọc
 * khác, trong cùng nhóm mới nhất trước — quyết định UX 2026-08-25 (tin
 * khẩn không được chìm dưới tin thường nếu chỉ sắp theo thời gian).
 */
export function sortReportItemsDefault<T extends ReportListItem>(items: T[] | null | undefined): T[] {
  return (items || []).slice().sort((a, b) => {
    const dangerDiff = (b.stillDangerous ? 1 : 0) - (a.stillDangerous ? 1 : 0);
    if (dangerDiff !== 0) return dangerDiff;
    const at = (a.occurredAt ? toJsDate(a.occurredAt) : null)?.getTime() ?? 0;
    const bt = (b.occurredAt ? toJsDate(b.occurredAt) : null)?.getTime() ?? 0;
    return bt - at;
  });
}

export interface IncidentListItem {
  incidentId?: string;
  campusId?: string;
  priority?: string;
  state?: string;
  // Hồ sơ bị "redacted" (trần bí mật thấp hơn) không còn các field này —
  // để optional thay vì bắt buộc, giống hệt bản gốc JS không typed cứng.
  categoryCode?: string;
  className?: string | null;
  createdAt?: Date | string | null;
  assignedTaskPerIds?: string[] | null;
  [key: string]: unknown;
}

export interface IncidentFilterInput {
  campusId?: string;
  categoryCodes?: string[];
  priorities?: string[];
  states?: string[];
  searchText?: string;
  onlyMinePerId?: string | null;
  fromDate?: string;
  toDate?: string;
}

/**
 * filterIncidentItems — `onlyMinePerId` (Pha 2 "Việc của tôi") lọc THÊM, áp
 * SAU CÙNG, chỉ giữ hồ sơ có đúng perId này trong `assignedTaskPerIds` —
 * `items` truyền vào đây PHẢI đã được authz xác định actor có quyền xem từ
 * trước, hàm này chỉ lọc HIỂN THỊ trong tập đã hợp lệ, không tự mở rộng quyền.
 */
export function filterIncidentItems<T extends IncidentListItem>(items: T[] | null | undefined, input: IncidentFilterInput = {}): T[] {
  let out = items || [];
  if (input.campusId) out = out.filter((it) => it.campusId === input.campusId);
  if (Array.isArray(input.categoryCodes) && input.categoryCodes.length) out = out.filter((it) => !!it.categoryCode && input.categoryCodes!.includes(it.categoryCode));
  if (Array.isArray(input.priorities) && input.priorities.length) out = out.filter((it) => !!it.priority && input.priorities!.includes(it.priority));
  if (Array.isArray(input.states) && input.states.length) out = out.filter((it) => !!it.state && input.states!.includes(it.state));
  if (input.fromDate || input.toDate) {
    out = out.filter((it) => inDateRange(it.createdAt, input.fromDate, input.toDate));
  }
  if (input.searchText && input.searchText.trim()) {
    const lowerSearch = input.searchText.toLowerCase();
    out = out.filter((it) => (it.incidentId ?? '').toLowerCase().includes(lowerSearch) || (!!it.className && it.className.toLowerCase().includes(lowerSearch)));
  }
  if (input.onlyMinePerId) {
    out = out.filter((it) => Array.isArray(it.assignedTaskPerIds) && it.assignedTaskPerIds.includes(input.onlyMinePerId!));
  }
  return out;
}
