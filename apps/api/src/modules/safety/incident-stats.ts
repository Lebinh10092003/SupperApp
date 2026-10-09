/**
 * incident-stats.ts — tính toán thuần (không đụng DB/HTTP) cho
 * `GET /stats/incidents`: lọc theo khoảng thời gian (`rangeDays`, cùng bộ
 * giá trị 7|30|90|365 đã dùng ở classStats.ts/AnalyticsPage.tsx,
 * `undefined` = toàn bộ thời gian) + xu hướng số vụ theo thời gian
 * (`trend`) — trước đây trang Tổng quan An toàn chỉ hiện được tổng cộng
 * toàn thời gian, không lọc được theo khoảng và không có biểu đồ xu hướng
 * (Sin phản hồi 09/10/2026).
 *
 * Tách thành hàm thuần (nhận sẵn mảng `rows` đã fetch) để test được không
 * cần DATABASE_URL thật, cùng tinh thần `classStats.ts` nhưng gọn hơn vì
 * không cần k-anonymity (dữ liệu hiển thị ở đây đã ở mức tổng hợp toàn
 * trường/cơ sở, không theo lớp/học sinh).
 */
import { isoDateVn, toVnParts } from './vntime.js';
import * as catalog from './catalog.js';

export const RANGE_DAYS_OPTIONS = [7, 30, 90, 365] as const;
export type RangeDays = (typeof RANGE_DAYS_OPTIONS)[number];

export function isValidRangeDays(v: unknown): v is RangeDays {
  return typeof v === 'number' && (RANGE_DAYS_OPTIONS as readonly number[]).includes(v);
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

export interface ComputeIncidentStatsResult {
  rangeDays: RangeDays | null;
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
 * biểu đồ (<=90 ngày), còn lại gộp theo THÁNG (365 ngày/toàn bộ thời gian)
 * để trục X không bị dồn nét chữ chồng lên nhau.
 */
function pickTrendBucket(rangeDays: RangeDays | null): 'day' | 'month' {
  if (rangeDays !== null && rangeDays <= 90) return 'day';
  return 'month';
}

export function computeIncidentStats(
  rows: IncidentStatsRow[],
  filter: { rangeDays?: RangeDays | null } = {},
  opts?: { now?: Date }
): ComputeIncidentStatsResult {
  const now = opts?.now || new Date();
  const rangeDays = filter.rangeDays ?? null;
  const nowMs = now.getTime();
  const rangeThresholdMs = rangeDays !== null ? nowMs - rangeDays * 24 * 3600 * 1000 : null;

  const inRange = rangeThresholdMs === null ? rows : rows.filter((r) => r.createdAt.getTime() >= rangeThresholdMs);

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
    if (rangeThresholdMs !== null && closedMs < rangeThresholdMs) continue;
    if (closedMs > nowMs) continue;
    closedInRange += 1;
  }

  const trendBucket = pickTrendBucket(rangeDays);
  const rangeFrom = rangeThresholdMs !== null ? isoDateVn(new Date(rangeThresholdMs)) : inRange.reduce<string | null>((min, r) => {
    const k = isoDateVn(r.createdAt);
    return min === null || k < min ? k : min;
  }, null);
  const rangeTo = isoDateVn(now);

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
      const fromMonth = monthKeyVn(new Date(rangeThresholdMs ?? Date.parse(rangeFrom + 'T00:00:00+07:00')));
      const toMonth = monthKeyVn(now);
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
