/**
 * incident-stats.ts — tính toán thuần (không đụng DB/HTTP) cho
 * `GET /stats/incidents`: lọc theo khoảng thời gian + xu hướng số vụ theo
 * thời gian (`trend`) — trước đây trang Tổng quan An toàn chỉ hiện được
 * tổng cộng toàn thời gian, không lọc được theo khoảng và không có biểu
 * đồ xu hướng (Sin phản hồi 09/10/2026). Hỗ trợ 2 cách lọc:
 *  - `rangeDays` (7|30|90|365, cùng bộ giá trị đã dùng ở
 *    classStats.ts/AnalyticsPage.tsx) — "N ngày gần đây tính đến hôm nay".
 *  - `fromDate`/`toDate` ('YYYY-MM-DD', lịch Việt Nam) — mốc do người dùng
 *    tự chọn (Sin phản hồi 09/10/2026: "cho lọc theo cả mốc thời gian
 *    mình muốn, ngày bắt đầu kết thúc"). Có ưu tiên hơn `rangeDays` khi cả
 *    2 cùng được truyền.
 * `undefined`/không truyền gì cả = toàn bộ thời gian.
 *
 * Tách thành hàm thuần (nhận sẵn mảng `rows` đã fetch) để test được không
 * cần DATABASE_URL thật, cùng tinh thần `classStats.ts` nhưng gọn hơn vì
 * không cần k-anonymity (dữ liệu hiển thị ở đây đã ở mức tổng hợp toàn
 * trường/cơ sở, không theo lớp/học sinh).
 */
import { fromVnParts, isoDateVn, toVnParts } from './vntime.js';
import * as catalog from './catalog.js';

export const RANGE_DAYS_OPTIONS = [7, 30, 90, 365] as const;
export type RangeDays = (typeof RANGE_DAYS_OPTIONS)[number];

export function isValidRangeDays(v: unknown): v is RangeDays {
  return typeof v === 'number' && (RANGE_DAYS_OPTIONS as readonly number[]).includes(v);
}

const DATE_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isValidDateKey(v: unknown): v is string {
  return typeof v === 'string' && DATE_KEY_RE.test(v);
}

export interface IncidentStatsRow {
  incidentId: string;
  campusId: string;
  categoryCode: string;
  priority: string | null;
  state: string;
  createdAt: Date;
  closedAt: Date | null;
}

export interface TrendPoint {
  period: string;
  count: number;
}

export interface ComputeIncidentStatsFilter {
  rangeDays?: RangeDays | null;
  /** 'YYYY-MM-DD' (lịch Việt Nam), bao gồm cả ngày này. Ưu tiên hơn `rangeDays` nếu có. */
  fromDate?: string | null;
  /** 'YYYY-MM-DD' (lịch Việt Nam), bao gồm cả ngày này — mặc định hôm nay nếu có `fromDate` mà thiếu `toDate`. */
  toDate?: string | null;
}

export interface ComputeIncidentStatsResult {
  rangeDays: RangeDays | null;
  fromDate: string | null;
  toDate: string | null;
  rangeFrom: string | null;
  rangeTo: string;
  totalIncidents: number;
  openCount: number;
  closedInRange: number;
  byPriority: Record<string, number>;
  byState: Record<string, number>;
  byCategory: Record<string, number>;
  byCampus: Record<string, number>;
  trend: TrendPoint[];
  trendBucket: 'day' | 'month';
}

function monthKeyVn(date: Date): string {
  const p = toVnParts(date);
  return `${p.year}-${String(p.month + 1).padStart(2, '0')}`;
}

function parseDateKey(key: string): { year: number; month: number; day: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { year: y!, month: m! - 1, day: d! };
}

/** Mốc 00:00 giờ Việt Nam của ngày `key`. */
function dateKeyStartMs(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return fromVnParts({ year, month, day, hour: 0, minute: 0, second: 0 }).getTime();
}

/** Mốc 23:59:59 giờ Việt Nam của ngày `key` (bao gồm trọn ngày đó). */
function dateKeyEndMs(key: string): number {
  const { year, month, day } = parseDateKey(key);
  return fromVnParts({ year, month, day, hour: 23, minute: 59, second: 59 }).getTime();
}

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + deltaDays));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y! * 12 + (m! - 1) + deltaMonths;
  const y2 = Math.floor(total / 12);
  const m2 = total - y2 * 12 + 1;
  return `${y2}-${String(m2).padStart(2, '0')}`;
}

/**
 * Bucket theo NGÀY khi khoảng xem đủ ngắn để từng ngày còn đọc được trên
 * biểu đồ (<=90 ngày, tính theo SỐ NGÀY THẬT của khoảng — không chỉ dựa
 * vào rangeDays, vì mốc tự chọn cũng phải áp đúng cùng ngưỡng), còn lại
 * gộp theo THÁNG để trục X không bị dồn nét chữ chồng lên nhau.
 */
function pickTrendBucket(spanDays: number): 'day' | 'month' {
  return spanDays <= 90 ? 'day' : 'month';
}

/** resolveRange — gộp 2 cách lọc (`rangeDays` / `fromDate`+`toDate`) thành 1 cặp mốc [startMs, endMs] thống nhất. `startMs === null` nghĩa là không giới hạn mốc đầu (toàn bộ lịch sử). */
function resolveRange(filter: ComputeIncidentStatsFilter, now: Date): { startMs: number | null; endMs: number; fromDate: string | null; toDate: string | null } {
  const nowMs = now.getTime();
  if (filter.fromDate || filter.toDate) {
    const fromDate = isValidDateKey(filter.fromDate) ? filter.fromDate : null;
    const toDate = isValidDateKey(filter.toDate) ? filter.toDate : isoDateVn(now);
    const startMs = fromDate ? dateKeyStartMs(fromDate) : null;
    const rawEndMs = dateKeyEndMs(toDate);
    // Không cho chọn mốc kết thúc ở TƯƠNG LAI — "đến hôm nay" là xa nhất.
    const endMs = Math.min(rawEndMs, nowMs);
    return { startMs, endMs, fromDate, toDate };
  }
  if (filter.rangeDays) {
    const startMs = nowMs - filter.rangeDays * 24 * 3600 * 1000;
    return { startMs, endMs: nowMs, fromDate: null, toDate: null };
  }
  return { startMs: null, endMs: nowMs, fromDate: null, toDate: null };
}

export function computeIncidentStats(rows: IncidentStatsRow[], filter: ComputeIncidentStatsFilter = {}, opts?: { now?: Date }): ComputeIncidentStatsResult {
  const now = opts?.now || new Date();
  const { startMs, endMs, fromDate, toDate } = resolveRange(filter, now);
  const rangeDays = fromDate || toDate ? null : (filter.rangeDays ?? null);

  const inRange = rows.filter((r) => {
    const t = r.createdAt.getTime();
    if (startMs !== null && t < startMs) return false;
    if (t > endMs) return false;
    return true;
  });

  const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  const byState: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byCampus: Record<string, number> = {};
  let openCount = 0;
  let closedInRange = 0;

  for (const r of inRange) {
    if (r.priority) {
      const cur = byPriority[r.priority];
      if (cur !== undefined) byPriority[r.priority] = cur + 1;
    }
    byState[r.state] = (byState[r.state] || 0) + 1;
    byCategory[r.categoryCode] = (byCategory[r.categoryCode] || 0) + 1;
    byCampus[r.campusId] = (byCampus[r.campusId] || 0) + 1;
    if (!catalog.isTerminal(r.state as catalog.IncidentState)) openCount += 1;
  }

  // "Đã đóng trong khoảng" tính theo `closedAt` (không phải `createdAt`) —
  // 1 vụ phát sinh TRƯỚC khoảng xem nhưng đóng TRONG khoảng vẫn phải tính,
  // nếu không số "đã đóng" sẽ luôn thấp giả tạo so với thực tế vận hành.
  for (const r of rows) {
    if (!r.closedAt) continue;
    const closedMs = r.closedAt.getTime();
    if (startMs !== null && closedMs < startMs) continue;
    if (closedMs > endMs) continue;
    closedInRange += 1;
  }

  const rangeFrom =
    startMs !== null
      ? isoDateVn(new Date(startMs))
      : inRange.reduce<string | null>((min, r) => {
          const k = isoDateVn(r.createdAt);
          return min === null || k < min ? k : min;
        }, null);
  const rangeTo = isoDateVn(new Date(endMs));

  const spanDays = rangeFrom ? Math.max(0, Math.round((dateKeyEndMs(rangeTo) - dateKeyStartMs(rangeFrom)) / (24 * 3600 * 1000))) : 0;
  const trendBucket = pickTrendBucket(spanDays);

  const trend: TrendPoint[] = [];
  if (rangeFrom) {
    if (trendBucket === 'day') {
      const counts = new Map<string, number>();
      for (const r of inRange) {
        const k = isoDateVn(r.createdAt);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      let cursor = rangeFrom;
      let guard = 0;
      while (cursor <= rangeTo && guard < 400) {
        trend.push({ period: cursor, count: counts.get(cursor) || 0 });
        if (cursor === rangeTo) break;
        cursor = shiftDayKey(cursor, 1);
        guard += 1;
      }
    } else {
      const counts = new Map<string, number>();
      for (const r of inRange) {
        const k = monthKeyVn(r.createdAt);
        counts.set(k, (counts.get(k) || 0) + 1);
      }
      const fromMonth = monthKeyVn(new Date(dateKeyStartMs(rangeFrom)));
      const toMonth = monthKeyVn(new Date(endMs));
      let cursor = fromMonth;
      let guard = 0;
      while (cursor <= toMonth && guard < 240) {
        trend.push({ period: cursor, count: counts.get(cursor) || 0 });
        if (cursor === toMonth) break;
        cursor = shiftMonthKey(cursor, 1);
        guard += 1;
      }
    }
  }

  return {
    rangeDays,
    fromDate,
    toDate,
    rangeFrom,
    rangeTo,
    totalIncidents: inRange.length,
    openCount,
    closedInRange,
    byPriority,
    byState,
    byCategory,
    byCampus,
    trend,
    trendBucket
  };
}
