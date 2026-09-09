/**
 * campus-comparison-stats.ts — Thống kê so sánh 3 cơ sở theo tháng, CHỈ
 * dành cho Hiệu trưởng (Phó Hiệu trưởng KHÔNG được cấp — phạm vi tổ chức
 * của Phó HT giới hạn 1 cơ sở, còn action này hiển thị cả 3 cơ sở cùng
 * lúc, xem `authz.ts`), port 1-1 từ `campusComparisonStats.js`.
 *
 * Theo đúng khuôn `zoneStats.ts`: nhận `db` làm tham số đầu, tái dùng
 * `catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN` (= 5) làm ngưỡng k-anonymity.
 *
 * k-anonymity 2 TẦNG (đúng thứ tự, không đảo):
 *  1) Tổng số vụ TOÀN RANGE của 1 cơ sở < ngưỡng -> ẩn TOÀN BỘ breakdown.
 *  2) Cơ sở đã qua ngưỡng: từng NHÓM SỰ CỐ có tổng TOÀN RANGE < ngưỡng ->
 *     gộp vào "khac_it_gap" trong top_categories, và KHÔNG có mặt trong
 *     monthly_trend_by_category.
 *
 * Tháng dùng lịch VIỆT NAM (`vntime.ts`) — nhất quán với `sla.ts`/toàn dự
 * án, KHÔNG dùng `getFullYear()`/`getMonth()` trực tiếp trên `Date`.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/campusComparisonStats.js
 */

import { eq } from 'drizzle-orm';
import * as catalog from './catalog.js';
import { toVnParts, fromVnParts } from './vntime.js';
import { incidents } from './incidents.schema.js';
import { AppError, type Db } from './shared.js';

// 3 cơ sở CỐ ĐỊNH — hard-code theo đúng spec đã duyệt, KHÔNG suy từ dữ
// liệu (tránh 1 cơ sở tạm thời không có hồ sơ nào bị "biến mất" khỏi so
// sánh).
export const CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const;

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** monthKeyOf — 'YYYY-MM' theo lịch Việt Nam của 1 Date. */
export function monthKeyOf(date: Date): string {
  const p = toVnParts(date);
  return p.year + '-' + pad2(p.month + 1); // p.month là 0-based
}

function parseMonthKey(key: string): { year: number; month: number } {
  const parts = String(key).split('-');
  return { year: Number(parts[0]), month: Number(parts[1]) }; // month 1-based
}

/** shiftMonthKey — cộng/trừ `delta` tháng vào 1 'YYYY-MM', xử lý tràn năm. */
export function shiftMonthKey(key: string, delta: number): string {
  const { year, month } = parseMonthKey(key);
  const totalMonths = year * 12 + (month - 1) + delta;
  const y2 = Math.floor(totalMonths / 12);
  const m2 = totalMonths - y2 * 12 + 1;
  return y2 + '-' + pad2(m2);
}

/** monthRangeArray — mảng 'YYYY-MM' TĂNG DẦN từ fromKey đến toKey (bao gồm cả 2 đầu). */
export function monthRangeArray(fromKey: string, toKey: string): string[] {
  const months: string[] = [];
  let cursor = fromKey;
  let guard = 0;
  for (;;) {
    months.push(cursor);
    if (cursor === toKey) break;
    cursor = shiftMonthKey(cursor, 1);
    guard += 1;
    if (guard > 1200) {
      throw new AppError('invalid_input', 'Khoảng thời gian fromMonth/toMonth quá lớn hoặc không hợp lệ.');
    }
  }
  return months;
}

/** monthStartDate — Date UTC thật, tương ứng 00:00 ngày 1 của tháng `key` THEO GIỜ VIỆT NAM. */
function monthStartDate(key: string): Date {
  const { year, month } = parseMonthKey(key);
  return fromVnParts({ year, month: month - 1, day: 1, hour: 0, minute: 0, second: 0 });
}

/** monthEndExclusiveDate — 00:00 ngày 1 của tháng KẾ TIẾP (mốc kết thúc loại trừ). */
function monthEndExclusiveDate(key: string): Date {
  return monthStartDate(shiftMonthKey(key, 1));
}

/**
 * resolveMonthRange — chốt fromMonth/toMonth hiệu lực. Mặc định 6 tháng
 * gần nhất (tính đến tháng hiện tại theo `now`) nếu KHÔNG truyền gì. Nếu
 * chỉ truyền 1 trong 2 mốc, mốc còn lại tự suy để vẫn ra đúng 6 tháng.
 */
export function resolveMonthRange(input: { fromMonth?: string | null; toMonth?: string | null }, now: Date): { fromMonth: string; toMonth: string } {
  const currentMonthKey = monthKeyOf(now);
  let from = input.fromMonth;
  let to = input.toMonth;

  if (!from && !to) {
    to = currentMonthKey;
    from = shiftMonthKey(to, -5);
  } else if (from && !to) {
    to = currentMonthKey;
  } else if (!from && to) {
    from = shiftMonthKey(to, -5);
  }

  if (!from || !to || !MONTH_KEY_RE.test(from) || !MONTH_KEY_RE.test(to)) {
    throw new AppError('invalid_input', 'fromMonth/toMonth phải đúng định dạng "YYYY-MM".');
  }
  if (from > to) {
    throw new AppError('invalid_input', 'fromMonth phải trước hoặc bằng toMonth.');
  }
  return { fromMonth: from, toMonth: to };
}

interface IncidentRow {
  incidentId: string;
  campusId: string;
  categoryCode: string;
  priority: string;
  createdAt: Date;
}

export interface CampusStatsEntry {
  total_count: number | '<5';
  breakdown_hidden: boolean;
  by_priority: Record<string, number> | null;
  p0_p1_rate: number | null;
  top_categories: Array<{ category_code: string; label: string; count: number }> | null;
  monthly_trend: Array<{ month: string; total_count: number }> | null;
  monthly_trend_by_category: Record<string, Array<{ month: string; count: number }>> | null;
  compare_to_previous_month: {
    previous_month: string;
    previous_total: number;
    latest_month: string;
    latest_total: number;
    delta: number;
    direction: 'improved' | 'worsened' | 'flat';
  } | null;
}

export interface CampusComparisonResult {
  from_month: string;
  to_month: string;
  months: string[];
  category_filter: string[] | null;
  campuses: Record<string, CampusStatsEntry>;
  ranking: {
    highest_p0_p1_rate_campus: string | null;
    most_improved_campus: string | null;
    most_worsened_campus: string | null;
  };
  disclaimer: string;
}

export async function computeCampusComparisonStats(
  db: Db,
  input: { fromMonth?: string | null; toMonth?: string | null; categoryCodes?: string[] } = {},
  opts?: { now?: Date }
): Promise<CampusComparisonResult> {
  const now = opts?.now || new Date();
  const resolved = resolveMonthRange(input, now);
  const effectiveFromMonth = resolved.fromMonth;
  const effectiveToMonth = resolved.toMonth;
  const months = monthRangeArray(effectiveFromMonth, effectiveToMonth);
  const previousMonthKey = shiftMonthKey(effectiveToMonth, -1);

  // Fetch bao gồm 1 tháng TRƯỚC fromMonth — chỉ để so sánh "tháng gần
  // nhất so với tháng liền trước" vẫn tính đúng ngay cả khi range yêu cầu
  // chỉ đúng 1 tháng.
  const fetchStart = monthStartDate(shiftMonthKey(effectiveFromMonth, -1));
  const fetchEndExclusive = monthEndExclusiveDate(effectiveToMonth);
  const fetchStartMs = fetchStart.getTime();
  const fetchEndMs = fetchEndExclusive.getTime();

  const hasCategoryFilter = Array.isArray(input.categoryCodes) && input.categoryCodes.length > 0;
  const categoryCodes = input.categoryCodes;

  const campuses: Record<string, CampusStatsEntry> = {};
  for (const campusId of CAMPUS_IDS) {
    const rawRows = (await db.select().from(incidents).where(eq(incidents.campusId, campusId))) as unknown as IncidentRow[];
    const rawItems = rawRows
      .map((it) => ({ ...it, _createdMs: it.createdAt.getTime() }))
      .filter((it) => it._createdMs >= fetchStartMs && it._createdMs < fetchEndMs)
      .map((it) => ({ ...it, _monthKey: monthKeyOf(it.createdAt) }));

    // Tập trong range yêu cầu (fromMonth..toMonth), đã áp categoryCodes
    // filter (nếu có) — dùng cho MỌI breakdown/k-anonymity.
    const itemsInRange = rawItems.filter((it) => {
      if (it._monthKey < effectiveFromMonth || it._monthKey > effectiveToMonth) return false;
      if (hasCategoryFilter && categoryCodes!.indexOf(it.categoryCode) === -1) return false;
      return true;
    });

    const totalCount = itemsInRange.length;
    const hidden = totalCount < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN;

    if (hidden) {
      campuses[campusId] = {
        total_count: totalCount > 0 ? '<5' : 0,
        breakdown_hidden: true,
        by_priority: null,
        p0_p1_rate: null,
        top_categories: null,
        monthly_trend: null,
        monthly_trend_by_category: null,
        compare_to_previous_month: null
      };
      continue;
    }

    const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const rawByCategory: Record<string, number> = {};
    itemsInRange.forEach((it) => {
      const cur = byPriority[it.priority];
      if (cur !== undefined) byPriority[it.priority] = cur + 1;
      rawByCategory[it.categoryCode] = (rawByCategory[it.categoryCode] || 0) + 1;
    });
    const p0p1Count = byPriority.P0! + byPriority.P1!;
    const p0P1Rate = totalCount > 0 ? Number((p0p1Count / totalCount).toFixed(4)) : 0;

    // Tầng 2 — ngưỡng theo TỪNG nhóm sự cố (tổng TOÀN RANGE, không phải/tháng).
    const passedCategories: Array<{ code: string; count: number }> = [];
    let hiddenSum = 0;
    Object.entries(rawByCategory).forEach(([code, count]) => {
      if (count < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN) {
        hiddenSum += count;
      } else {
        passedCategories.push({ code, count });
      }
    });
    passedCategories.sort((a, b) => b.count - a.count);
    const top3 = passedCategories.slice(0, 3);
    const remainderPassed = passedCategories.slice(3);
    remainderPassed.forEach((c) => {
      hiddenSum += c.count;
    });

    const topCategories = top3.map((c) => ({
      category_code: c.code,
      label: catalog.CATEGORY_CATALOG[c.code]?.label || c.code,
      count: c.count
    }));
    if (hiddenSum > 0) {
      topCategories.push({ category_code: 'khac_it_gap', label: 'Khác (ít gặp)', count: hiddenSum });
    }

    const monthlyTrend = months.map((m) => ({
      month: m,
      total_count: itemsInRange.filter((it) => it._monthKey === m).length
    }));

    // monthly_trend_by_category — CHỈ nhóm sự cố đã qua ngưỡng tổng TOÀN
    // RANGE (passedCategories, không giới hạn top 3 — khác top_categories).
    const monthlyTrendByCategory: Record<string, Array<{ month: string; count: number }>> = {};
    passedCategories.forEach(({ code }) => {
      monthlyTrendByCategory[code] = months.map((m) => ({
        month: m,
        count: itemsInRange.filter((it) => it._monthKey === m && it.categoryCode === code).length
      }));
    });

    // compare_to_previous_month — LUÔN so tháng gần nhất của range
    // (toMonth) với đúng tháng liền trước nó, áp CÙNG bộ lọc categoryCodes.
    const previousItems = rawItems.filter((it) => {
      if (it._monthKey !== previousMonthKey) return false;
      if (hasCategoryFilter && categoryCodes!.indexOf(it.categoryCode) === -1) return false;
      return true;
    });
    const previousTotal = previousItems.length;
    const latestTotal = itemsInRange.filter((it) => it._monthKey === effectiveToMonth).length;
    const delta = latestTotal - previousTotal;
    const direction = delta < 0 ? 'improved' : delta > 0 ? 'worsened' : 'flat';

    campuses[campusId] = {
      total_count: totalCount,
      breakdown_hidden: false,
      by_priority: byPriority,
      p0_p1_rate: p0P1Rate,
      top_categories: topCategories,
      monthly_trend: monthlyTrend,
      monthly_trend_by_category: monthlyTrendByCategory,
      compare_to_previous_month: {
        previous_month: previousMonthKey,
        previous_total: previousTotal,
        latest_month: effectiveToMonth,
        latest_total: latestTotal,
        delta,
        direction
      }
    };
  }

  const notHidden = CAMPUS_IDS.filter((id) => !campuses[id]!.breakdown_hidden);
  const highestP0P1RateCampus =
    notHidden.length > 0 ? notHidden.reduce<string | null>((best, id) => (best === null || campuses[id]!.p0_p1_rate! > campuses[best]!.p0_p1_rate!) ? id : best, null) : null;

  const withCompare = notHidden.filter((id) => campuses[id]!.compare_to_previous_month);
  const mostImprovedCampus =
    withCompare.length > 0
      ? withCompare.reduce<string | null>((best, id) => (best === null || campuses[id]!.compare_to_previous_month!.delta < campuses[best]!.compare_to_previous_month!.delta) ? id : best, null)
      : null;
  const mostWorsenedCampus =
    withCompare.length > 0
      ? withCompare.reduce<string | null>((best, id) => (best === null || campuses[id]!.compare_to_previous_month!.delta > campuses[best]!.compare_to_previous_month!.delta) ? id : best, null)
      : null;

  return {
    from_month: effectiveFromMonth,
    to_month: effectiveToMonth,
    months,
    category_filter: hasCategoryFilter ? categoryCodes! : null,
    campuses,
    ranking: {
      highest_p0_p1_rate_campus: highestP0P1RateCampus,
      most_improved_campus: mostImprovedCampus,
      most_worsened_campus: mostWorsenedCampus
    },
    disclaimer:
      'Xu hướng cải thiện/xấu đi so sánh 1 tháng gần nhất với tháng liền trước — chỉ mang tính tham khảo ngắn hạn, số liệu nhỏ dễ biến động, không phải kết luận thống kê chính thức.'
  };
}
