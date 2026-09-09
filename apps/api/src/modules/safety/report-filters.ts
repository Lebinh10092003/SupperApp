/**
 * report-filters.ts — Lọc THUẦN (không đụng DB) dùng chung cho
 * `listPendingReports`/`listIncidents`, port 1-1 từ `reportFilters.js`.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/reportFilters.js
 */

import { normalizeForMatch } from './zoneStats.js';

function toJsDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v as string);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * inDateRange — so `fieldValue` với khoảng [fromDate, toDate] (chuỗi
 * ISO, 1 trong 2 đầu có thể bỏ trống). `toDate` so theo NGÀY (tự cộng
 * tới hết ngày 23:59:59.999) để "đến ngày X" bao trọn cả ngày X, không bị
 * cắt ở 00:00 — đúng cách người dùng chọn ngày trên UI mong đợi.
 */
function inDateRange(fieldValue: unknown, fromDate?: string | null, toDate?: string | null): boolean {
  if (!fromDate && !toDate) return true;
  const value = toJsDate(fieldValue);
  if (!value) return false; // không có mốc thời gian -> không khớp được khoảng lọc
  if (fromDate) {
    const from = toJsDate(fromDate);
    if (from && value.getTime() < from.getTime()) return false;
  }
  if (toDate) {
    const to = toJsDate(toDate);
    if (to) {
      const toEndOfDay = new Date(to.getTime());
      toEndOfDay.setHours(23, 59, 59, 999);
      if (value.getTime() > toEndOfDay.getTime()) return false;
    }
  }
  return true;
}

export interface ReportItemLike {
  reportId?: string;
  publicCode?: string;
  campusId?: string;
  categoryCode?: string;
  content?: string;
  stillDangerous?: boolean;
  occurredAt?: unknown;
}

export interface FilterReportItemsInput {
  campusId?: string;
  categoryCodes?: string[];
  searchText?: string;
  stillDangerous?: boolean;
  fromDate?: string | null;
  toDate?: string | null;
}

/**
 * filterReportItems — lọc mảng report đã map (dạng trả về của
 * listPendingReports). `stillDangerous` (tuỳ chọn) — có truyền thì CHỈ
 * giữ đúng giá trị đó; không truyền = giữ tất cả (mặc định).
 */
export function filterReportItems<T extends ReportItemLike>(items: T[] | null | undefined, filter: FilterReportItemsInput = {}): T[] {
  let out = items || [];
  if (filter.campusId) out = out.filter((it) => it.campusId === filter.campusId);
  if (Array.isArray(filter.categoryCodes) && filter.categoryCodes.length > 0) {
    out = out.filter((it) => filter.categoryCodes!.indexOf(it.categoryCode as string) !== -1);
  }
  if (typeof filter.stillDangerous === 'boolean') {
    out = out.filter((it) => !!it.stillDangerous === filter.stillDangerous);
  }
  if (filter.fromDate || filter.toDate) {
    out = out.filter((it) => inDateRange(it.occurredAt, filter.fromDate, filter.toDate));
  }
  if (filter.searchText && filter.searchText.trim()) {
    const norm = normalizeForMatch(filter.searchText);
    const lowerSearch = filter.searchText.toLowerCase();
    out = out.filter(
      (it) =>
        normalizeForMatch(it.content).includes(norm) ||
        String(it.reportId).toLowerCase().includes(lowerSearch) ||
        String(it.publicCode).toLowerCase().includes(lowerSearch)
    );
  }
  return out;
}

/**
 * sortReportItemsDefault — sắp xếp mặc định của "Tin báo chờ xử lý": tin
 * "còn nguy hiểm" lên đầu, trong cùng nhóm còn/hết nguy hiểm thì mới nhất
 * trước. UI vẫn cho đổi sắp xếp thủ công qua header cột — đây chỉ là thứ
 * tự BAN ĐẦU.
 */
export function sortReportItemsDefault<T extends ReportItemLike>(items: T[] | null | undefined): T[] {
  return (items || []).slice().sort((a, b) => {
    const dangerDiff = (b.stillDangerous ? 1 : 0) - (a.stillDangerous ? 1 : 0);
    if (dangerDiff !== 0) return dangerDiff;
    const at = (toJsDate(a.occurredAt) || new Date(0)).getTime();
    const bt = (toJsDate(b.occurredAt) || new Date(0)).getTime();
    return bt - at;
  });
}

export interface IncidentItemLike {
  incident_id?: string;
  campus_id?: string;
  category_code?: string;
  priority?: string;
  state?: string;
  class_name?: string | null;
  assigned_task_per_ids?: string[];
  created_at?: unknown;
}

export interface FilterIncidentItemsInput {
  campusId?: string;
  categoryCodes?: string[];
  priorities?: string[];
  states?: string[];
  searchText?: string;
  onlyMinePerId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
}

/**
 * filterIncidentItems — lọc mảng incident (schema snake_case gốc
 * Firestore). `onlyMinePerId` (Pha 2 "Việc của tôi") — lọc THÊM, áp SAU
 * CÙNG, chỉ giữ hồ sơ có đúng perId này trong `assigned_task_per_ids` (đã
 * được authz xác định actor CÓ QUYỀN xem từ trước khi mảng `items`
 * truyền vào đây — hàm này chỉ lọc HIỂN THỊ trong tập đã hợp lệ).
 */
export function filterIncidentItems<T extends IncidentItemLike>(items: T[] | null | undefined, filter: FilterIncidentItemsInput = {}): T[] {
  let out = items || [];
  if (filter.campusId) out = out.filter((it) => it.campus_id === filter.campusId);
  if (Array.isArray(filter.categoryCodes) && filter.categoryCodes.length) out = out.filter((it) => filter.categoryCodes!.indexOf(it.category_code as string) !== -1);
  if (Array.isArray(filter.priorities) && filter.priorities.length) out = out.filter((it) => filter.priorities!.indexOf(it.priority as string) !== -1);
  if (Array.isArray(filter.states) && filter.states.length) out = out.filter((it) => filter.states!.indexOf(it.state as string) !== -1);
  if (filter.fromDate || filter.toDate) {
    out = out.filter((it) => inDateRange(it.created_at, filter.fromDate, filter.toDate));
  }
  if (filter.searchText && filter.searchText.trim()) {
    const lowerSearch = filter.searchText.toLowerCase();
    out = out.filter((it) => (it.incident_id || '').toLowerCase().includes(lowerSearch) || (!!it.class_name && it.class_name.toLowerCase().includes(lowerSearch)));
  }
  if (filter.onlyMinePerId) {
    out = out.filter((it) => Array.isArray(it.assigned_task_per_ids) && it.assigned_task_per_ids.indexOf(filter.onlyMinePerId as string) !== -1);
  }
  return out;
}
