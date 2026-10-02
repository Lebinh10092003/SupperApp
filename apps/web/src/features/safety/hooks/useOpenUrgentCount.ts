import { useEffect, useState } from 'react';
import { api } from '../../../services/api';
import { TERMINAL_STATES } from '../constants';

interface IncidentRow {
  state: string;
}

/** Số hồ sơ P0/P1 ĐANG MỞ — dùng cho badge sidebar "Cần xử lý ngay" (Sin
 * chốt 2026-10-02: badge tĩnh "P0/P1" vô nghĩa, phải là số thật).
 *
 * CỐ Ý KHÔNG dùng `byPriority` của /api/safety/stats/incidents — field đó
 * đếm MỌI hồ sơ từng có mức P0/P1 kể cả đã đóng/trùng/rác (Sin phát hiện
 * 2026-10-02: sidebar hiện 5 nhưng trang "Cần xử lý ngay" chỉ có 4 hồ sơ
 * thật sự còn mở) — gọi thẳng GET /incidents?priorities=P0,P1 rồi tự lọc
 * TERMINAL_STATES, khớp Y HỆT logic `open` của EmergencyCockpitPage.tsx.
 * Poll mỗi 60s, không auth → trả null, badge tự ẩn (không hiện số sai). */
export function useOpenUrgentCount(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      api
        .get<IncidentRow[]>('/api/safety/incidents?priorities=P0,P1&limit=500')
        .then((rows) => {
          if (cancelled) return;
          const open = (rows || []).filter((it) => !TERMINAL_STATES.includes(it.state));
          setCount(open.length);
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
