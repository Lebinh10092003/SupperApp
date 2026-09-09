/**
 * classStats.ts — Thống kê sự cố THEO LỚP HỌC (bên cạnh thống kê theo khu
 * vực vật lý ở `zoneStats.ts`), port 1-1 từ `classStats.js`. Tận dụng field
 * `class_name` đã có trên `incidents` (bảng NHÁP, xem `incidents.schema.ts`).
 *
 * Thống kê theo lớp NHẠY CẢM HƠN thống kê theo khu vực (dễ suy luận ra
 * đúng 1 học sinh cụ thể trong lớp nếu số vụ quá ít) — áp dụng NGUYÊN VẸN
 * cùng cơ chế ẩn/gộp số liệu k-anonymity ngưỡng
 * `catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN` (dùng chung với zoneStats.ts —
 * tên gọi hơi lệch ngữ nghĩa nhưng bản chất là ngưỡng ẩn dùng chung cho MỌI
 * kiểu breakdown theo nhóm nhỏ, không riêng gì "zone").
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/classStats.js
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as catalog from './catalog.js';
import { incidents } from './incidents.schema.js';
import { AppError } from './shared.js';

type Db = NodePgDatabase<Record<string, never>>;

// AppError dùng CHUNG (shared.ts) — xem giải thích ở zoneStats.ts (bug
// instanceof thật khi route check theo bản shared.ts). Re-export để
// `classStats.AppError` (test cũ) vẫn cùng 1 class.
export { AppError };

const VALID_RANGE_DAYS = [7, 30, 90];
const DEFAULT_RANGE_DAYS = 90;

function toJsDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  return new Date(v as string);
}

interface IncidentRow {
  incidentId: string;
  categoryCode: string;
  priority: string;
  className: string | null;
  createdAt: Date;
}

export interface ComputeClassStatsFilter {
  campusId?: string;
  categoryCodes?: string[];
  rangeDays?: number;
}

export interface ClassStatsEntry {
  class_name: string;
  total_count: number | '<5';
  breakdown_hidden: boolean;
  by_priority: Record<string, number> | null;
  by_category: Record<string, number> | null;
  trend: Record<string, number> | null;
  severity_flag: boolean;
}

export interface ComputeClassStatsResult {
  campus_id: string;
  range_days: number;
  category_filter: string[] | null;
  unassigned_count: number;
  total_incidents_campus: number;
  classes: ClassStatsEntry[];
}

/**
 * computeClassStats — thống kê sự cố theo lớp học cho 1 cơ sở, trong
 * khoảng `rangeDays` (mặc định/chỉ 7|30|90), lọc tuỳ chọn theo
 * `categoryCodes`. `opts.now` cho phép test cố định mốc thời gian.
 */
export async function computeClassStats(db: Db, filter: ComputeClassStatsFilter = {}, opts?: { now?: Date }): Promise<ComputeClassStatsResult> {
  const { campusId, categoryCodes, rangeDays } = filter;
  if (!campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
  const now = opts?.now || new Date();

  const effectiveRangeDays = VALID_RANGE_DAYS.includes(rangeDays as number) ? (rangeDays as number) : DEFAULT_RANGE_DAYS;

  const rawIncidents = await db.select().from(incidents).where(eq(incidents.campusId, campusId));
  const nowMs = now.getTime();
  const rangeThresholdMs = nowMs - effectiveRangeDays * 24 * 3600 * 1000;

  const allIncidents = (rawIncidents as unknown as IncidentRow[]).map((it) => ({
    ...it,
    _createdMs: (toJsDate(it.createdAt) || new Date(0)).getTime()
  }));

  const filtered = allIncidents.filter((it) => {
    if (it._createdMs < rangeThresholdMs) return false;
    if (Array.isArray(categoryCodes) && categoryCodes.length > 0 && categoryCodes.indexOf(it.categoryCode) === -1) return false;
    return true;
  });

  let unassignedCount = 0;
  const byClass = new Map<string, typeof filtered>();
  const uniqueIncidentIdsFiltered = new Set<string>();
  filtered.forEach((it) => {
    if (it.incidentId) uniqueIncidentIdsFiltered.add(it.incidentId);
    const className = it.className;
    if (!className) {
      unassignedCount += 1;
      return;
    }
    if (!byClass.has(className)) byClass.set(className, []);
    byClass.get(className)!.push(it);
  });

  // trend luôn tính ĐỘC LẬP với rangeDays/categoryCodes input, dùng TOÀN BỘ
  // hồ sơ của lớp đó (allIncidents, không phải filtered).
  const allByClass = new Map<string, typeof allIncidents>();
  allIncidents.forEach((it) => {
    const className = it.className;
    if (!className) return;
    if (!allByClass.has(className)) allByClass.set(className, []);
    allByClass.get(className)!.push(it);
  });

  function computeTrend(className: string): Record<string, number> {
    const classAll = allByClass.get(className) || [];
    const trend: Record<string, number> = {};
    [7, 30, 90].forEach((d) => {
      const thresholdMs = nowMs - d * 24 * 3600 * 1000;
      trend['last_' + d + 'd'] = classAll.filter((it) => it._createdMs >= thresholdMs).length;
    });
    return trend;
  }

  const classes: ClassStatsEntry[] = Array.from(byClass.entries()).map(([className, items]) => {
    const totalCount = items.length;
    const severityFlag = items.some((it) => it.priority === catalog.PRIORITY.P0 || it.priority === catalog.PRIORITY.P1);

    if (totalCount < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN) {
      return {
        class_name: className,
        total_count: totalCount > 0 ? '<5' : 0,
        breakdown_hidden: true,
        by_priority: null,
        by_category: null,
        trend: null,
        severity_flag: severityFlag
      };
    }

    const byPriority: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const rawByCategory: Record<string, number> = {};
    items.forEach((it) => {
      const cur = byPriority[it.priority];
      if (cur !== undefined) byPriority[it.priority] = cur + 1;
      rawByCategory[it.categoryCode] = (rawByCategory[it.categoryCode] || 0) + 1;
    });

    const byCategory: Record<string, number> = {};
    let hiddenSum = 0;
    Object.entries(rawByCategory).forEach(([code, count]) => {
      if (count < catalog.MIN_ZONE_COUNT_FOR_BREAKDOWN) {
        hiddenSum += count;
      } else {
        byCategory[code] = count;
      }
    });
    if (hiddenSum > 0) byCategory.khac_it_gap = hiddenSum;

    return {
      class_name: className,
      total_count: totalCount,
      breakdown_hidden: false,
      by_priority: byPriority,
      by_category: byCategory,
      trend: computeTrend(className),
      severity_flag: severityFlag
    };
  });

  return {
    campus_id: campusId,
    range_days: effectiveRangeDays,
    category_filter: Array.isArray(categoryCodes) && categoryCodes.length > 0 ? categoryCodes : null,
    unassigned_count: unassignedCount,
    total_incidents_campus: uniqueIncidentIdsFiltered.size,
    classes
  };
}

// ---------------------------------------------------------------------------
// Nhận diện tên lớp nhắc tới trong nội dung mô tả tự do — cùng nguyên tắc
// "AI chỉ gợi ý, không tự quyết" như suggestZoneIdsFromContent (zoneStats.ts).
// ---------------------------------------------------------------------------

// Quy ước tên lớp THCS Việt Nam phổ biến: 1 chữ số khối (6-9) + 1 chữ cái
// (A-Z) + 1-2 chữ số thứ tự (VD "8A2", "7B1", "9A10", "6C3"). ƯỚC LƯỢNG cho
// quy ước phổ biến nhất — KHÔNG bao quát mọi biến thể.
const CLASS_NAME_REGEX = /\b([6-9]\d?[A-Z]\d{1,2})\b/gi;

/**
 * detectClassNamesFromContent — CHỈ LÀ GỢI Ý regex-matching thuần, KHÔNG
 * hiểu ngữ cảnh. KHÔNG BAO GIỜ được dùng để tự động gán `class_name` chính
 * thức — chỉ hiển thị cho người xử lý xác nhận thủ công.
 */
export function detectClassNamesFromContent(content: string | null | undefined): string[] {
  if (!content) return [];
  const matches = String(content).toUpperCase().match(CLASS_NAME_REGEX) || [];
  return Array.from(new Set(matches));
}
