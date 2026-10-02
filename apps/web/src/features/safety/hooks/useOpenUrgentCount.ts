import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

interface IncidentStats {
  byPriority: Record<string, number>;
}

/** Số hồ sơ P0/P1 đang mở — dùng cho badge sidebar "Cần xử lý ngay" (Sin
 * chốt 2026-10-02: badge tĩnh "P0/P1" vô nghĩa, phải là số thật). Poll mỗi
 * 60s, không auth → trả null, badge tự ẩn (không hiện số sai). */
export function useOpenUrgentCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<IncidentStats>('/api/safety/stats/incidents')
        .then((s) => {
          if (!cancelled) setCount((s.byPriority.P0 || 0) + (s.byPriority.P1 || 0));
        })
        .catch(() => {
          if (!cancelled) setCount(null);
        });
    };
    load();
    const timer = setInterval(load, 60000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return count;
}
