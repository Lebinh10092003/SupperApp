import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';

export interface WorkTask {
  id: string;
  eventId: string | null;
  title: string;
  description: string;
  priority: string;
  campusId: string;
  assigneePerId: string;
  assigneeName: string | null;
  assigneeRoleLabel?: string | null;
  assigneeLabel?: string;
  collaboratorPerIds: string[];
  dueAt: string;
  status: string;
  evidenceUrl: string;
  acceptanceNote: string;
  cancellationReason: string | null;
  createdByPerId: string;
  createdByName: string | null;
  createdByRoleLabel?: string | null;
  createdByLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseTasksParams {
  campusId?: string;
  assigneePerId?: string;
  statuses?: string[];
  // "GIAO VIỆC" trong chi tiết lịch công tác (§9/§10 đặc tả) — danh sách
  // đầu việc gắn với đúng sự kiện này.
  eventId?: string;
  // false = không fetch (dùng khi dialog cha chưa mở/chưa có event — hook
  // vẫn phải gọi KHÔNG điều kiện ở component cha, chỉ tắt fetch qua đây).
  enabled?: boolean;
}

export function useTasks(params: UseTasksParams = {}) {
  const [items, setItems] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const enabled = params.enabled !== false;

  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (params.campusId) q.set('campusId', params.campusId);
    if (params.assigneePerId) q.set('assigneePerId', params.assigneePerId);
    if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
    if (params.eventId) q.set('eventId', params.eventId);
    const qs = q.toString();
    api
      .get<{ items: WorkTask[] }>(`/api/work-schedule/tasks${qs ? `?${qs}` : ''}`)
      .then((res) => setItems(res.items || []))
      .catch((e: any) => setError(e.message || 'Không tải được danh sách công việc.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
