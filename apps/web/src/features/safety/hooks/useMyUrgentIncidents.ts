import { useMemo } from 'react';
import { useIncidents, type IncidentListItem } from './useIncidents';
import { TERMINAL_STATES } from '../constants';
import { getSlaClockTone, type SlaClockVisualTone } from '../constants';

export interface UrgentIncidentsResult {
  tone: 'overdue' | 'approaching' | null;
  count: number;
  /** Hồ sơ cần bấm "Xử lý ngay" — quá hạn nhiều nhất (hạn xa nhất trong quá
   * khứ) nếu có hồ sơ quá hạn, không thì hồ sơ sắp đến hạn SỚM NHẤT. */
  worstIncidentId: string | null;
}

const EMPTY: UrgentIncidentsResult = { tone: null, count: 0, worstIncidentId: null };

/** Sự vụ bạn là chỉ huy HOẶC tham gia, đang mở, có mốc thời hạn (tiếp nhận
 * hoặc phân công) đã quá hạn hoặc sắp đến hạn — dùng cho banner cảnh báo
 * toàn site dưới navbar (Sin chốt 2026-10-02). Tái dùng `onlyMine` đã có
 * sẵn, không gọi API riêng. */
export function useMyUrgentIncidents(): UrgentIncidentsResult {
  const { items } = useIncidents({ onlyMine: true, limit: 500 });

  return useMemo(() => {
    const now = new Date();
    type Scored = { incidentId: string; tone: SlaClockVisualTone; worstDeadlineMs: number };
    const scored: Scored[] = [];

    for (const it of items as IncidentListItem[]) {
      if (TERMINAL_STATES.includes(it.state)) continue;
      if (!it.slaClocks) continue;
      let incidentTone: SlaClockVisualTone = 'normal';
      let worstDeadlineMs = Infinity;
      for (const clock of Object.values(it.slaClocks)) {
        const tone = getSlaClockTone(clock, now);
        const deadlineMs = new Date(clock.deadlineAt).getTime();
        if (tone === 'overdue') {
          if (incidentTone !== 'overdue' || deadlineMs < worstDeadlineMs) {
            incidentTone = 'overdue';
            worstDeadlineMs = deadlineMs;
          }
        } else if (tone === 'approaching' && incidentTone !== 'overdue') {
          if (incidentTone !== 'approaching' || deadlineMs < worstDeadlineMs) {
            incidentTone = 'approaching';
            worstDeadlineMs = deadlineMs;
          }
        }
      }
      if (incidentTone === 'overdue' || incidentTone === 'approaching') {
        scored.push({ incidentId: it.incidentId, tone: incidentTone, worstDeadlineMs });
      }
    }

    if (scored.length === 0) return EMPTY;

    const overdueOnes = scored.filter((s) => s.tone === 'overdue');
    const pool = overdueOnes.length > 0 ? overdueOnes : scored;
    // Quá hạn: hạn xa nhất trong quá khứ (deadlineMs nhỏ nhất) = nghiêm
    // trọng nhất. Sắp đến hạn: hạn gần nhất (deadlineMs nhỏ nhất) = gấp nhất.
    pool.sort((a, b) => a.worstDeadlineMs - b.worstDeadlineMs);

    return {
      tone: overdueOnes.length > 0 ? 'overdue' : 'approaching',
      count: scored.length,
      worstIncidentId: pool[0]!.incidentId
    };
  }, [items]);
}
