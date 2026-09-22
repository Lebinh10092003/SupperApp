/**
 * trend-alerts.ts — Pha 1 dashboard: phát hiện xu hướng ngắn hạn ("N vụ
 * CÙNG nhóm sự cố tại CÙNG 1 cơ sở trong X ngày gần nhất") và sinh cảnh
 * báo chủ động cho Hiệu trưởng/Phó HT, port 1-1 từ `trendAlerts.js`.
 * Ngưỡng lấy từ `catalog.TREND_ALERT_THRESHOLDS`.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/trendAlerts.js
 */

import * as catalog from './catalog.js';
import { incidents } from './incidents.schema.js';
import type { Db } from './shared.js';

function toJsDate(v: unknown): Date {
  if (v instanceof Date) return v;
  return new Date(v as string);
}

export interface TrendAlert {
  campus_id: string;
  category_code: string;
  count: number;
  window_days: number;
  severity: 'critical' | 'warning';
}

/**
 * computeTrendAlerts — trả về mảng cảnh báo xu hướng cho các cơ sở trong
 * `campusIds` (phạm vi actor được xem — TỰ TRUYỀN VÀO, hàm này không tự
 * kiểm tra quyền, xem route `getTrendAlerts`).
 */
export async function computeTrendAlerts(db: Db, filter: { campusIds?: string[] } = {}, opts?: { now?: Date }): Promise<TrendAlert[]> {
  const now = opts?.now || new Date();
  const nowMs = now.getTime();
  const allowedCampusIds = Array.isArray(filter.campusIds) && filter.campusIds.length ? filter.campusIds : null;

  const rows = await db.select().from(incidents);
  // Đếm riêng theo 2 khung cửa sổ (5 ngày cho nhóm nặng, 7 ngày cho nhóm
  // nhẹ) — 1 lượt quét, đếm vào cả 2 "giỏ" cùng lúc, chỉ khác mốc cắt.
  const countsHigh = new Map<string, number>();
  const countsLow = new Map<string, number>();
  const highThresholdMs = nowMs - catalog.TREND_ALERT_THRESHOLDS.HIGH_SEVERITY.windowDays * 24 * 3600 * 1000;
  const lowThresholdMs = nowMs - catalog.TREND_ALERT_THRESHOLDS.LOW_SEVERITY.windowDays * 24 * 3600 * 1000;

  for (const it of rows) {
    if (allowedCampusIds && allowedCampusIds.indexOf(it.campusId) === -1) continue;
    const categoryMeta = catalog.CATEGORY_CATALOG[it.categoryCode];
    if (!categoryMeta) continue; // nhóm sự cố không nhận diện được -> bỏ qua, không đếm sai giỏ
    const isHigh = (catalog.TREND_ALERT_THRESHOLDS.HIGH_SEVERITY.priorities as string[]).indexOf(categoryMeta.suggestedPriority) !== -1;
    const createdMs = toJsDate(it.createdAt).getTime();
    const key = it.campusId + '|' + it.categoryCode;
    if (isHigh) {
      if (createdMs >= highThresholdMs) countsHigh.set(key, (countsHigh.get(key) || 0) + 1);
    } else {
      if (createdMs >= lowThresholdMs) countsLow.set(key, (countsLow.get(key) || 0) + 1);
    }
  }

  const alerts: TrendAlert[] = [];
  function collectAlerts(counts: Map<string, number>, spec: { count: number; windowDays: number }, severity: 'critical' | 'warning') {
    counts.forEach((count, key) => {
      if (count < spec.count) return;
      const [campusId, categoryCode] = key.split('|') as [string, string];
      alerts.push({ campus_id: campusId, category_code: categoryCode, count, window_days: spec.windowDays, severity });
    });
  }
  collectAlerts(countsHigh, catalog.TREND_ALERT_THRESHOLDS.HIGH_SEVERITY, 'critical');
  collectAlerts(countsLow, catalog.TREND_ALERT_THRESHOLDS.LOW_SEVERITY, 'warning');

  // Nghiêm trọng trước, rồi nhiều vụ hơn trước — cảnh báo đáng lo nhất
  // luôn hiện đầu danh sách trên giao diện.
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return b.count - a.count;
  });

  return alerts;
}
