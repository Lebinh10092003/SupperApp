import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

/**
 * Danh tính/vai trò thật của actor (hệ 16 role `R.*`, đọc qua
 * `loadActorContext` phía server) — DÙNG CHUNG với module An toàn, không
 * phải hệ role riêng cho Lịch công tác. Tái dùng thẳng
 * `GET /api/safety/me` thay vì tạo endpoint `/api/work-schedule/me` mới,
 * vì đây là dữ liệu identity dùng chung, không riêng module nào.
 */
export interface ActorRole {
  roleId: string;
  campusId: string | null;
  domain: string | null;
}

export interface Actor {
  perId: string;
  roles: ActorRole[];
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

  const hasRole = (roleId: string, campusId?: string | null) =>
    !!actor?.roles.some((r) => r.roleId === roleId && (!campusId || !r.campusId || r.campusId === campusId));

  return { actor, loading, hasRole };
}
