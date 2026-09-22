import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

/**
 * Danh tính thật của actor đang đăng nhập (`GET /api/safety/me`, port của
 * `loadActorContext` phía server) — dùng để ẩn/hiện nút hành động phía
 * client (VD "Tiếp nhận xử lý" chỉ hiện khi chưa có chỉ huy, "Thêm người xử
 * lý" chỉ hiện với đúng chỉ huy hiện tại). CHỈ là gợi ý hiển thị — phân
 * quyền thật luôn ở server (authz.ts 9 bước), y hệt bản dùng chung ở
 * `work-schedule/hooks/useActor.ts`.
 */
export interface Actor {
  perId: string;
  roles: Array<{ roleId: string; campusId: string | null; domain: string | null }>;
  onDutyNow: boolean;
}

export function useActor() {
  const [actor, setActor] = useState<Actor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Actor>('/api/safety/me')
      .then(setActor)
      .catch(() => setActor(null))
      .finally(() => setLoading(false));
  }, []);

  return { actor, loading };
}
