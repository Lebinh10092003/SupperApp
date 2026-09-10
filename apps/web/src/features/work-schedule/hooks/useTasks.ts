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
  collaboratorPerIds: string[];
  dueAt: string;
  status: string;
  evidenceUrl: string;
  acceptanceNote: string;
  cancellationReason: string | null;
  createdByPerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UseTasksParams {
  campusId?: string;
  assigneePerId?: string;
  statuses?: string[];
}

export function useTasks(params: UseTasksParams = {}) {
  const [items, setItems] = useState<WorkTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (params.campusId) q.set('campusId', params.campusId);
    if (params.assigneePerId) q.set('assigneePerId', params.assigneePerId);
    if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
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
