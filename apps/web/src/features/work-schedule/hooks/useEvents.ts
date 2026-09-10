import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';

export interface EventApproval {
  role: string;
  perId: string;
  at?: string;
}

export interface WorkEvent {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  campusId: string;
  scope: string;
  startAt: string;
  endAt: string;
  location: string;
  chairPerId: string;
  participantPerIds: string[];
  status: string;
  conflictNote: string;
  revisionNote: string;
  cancellationNote: string | null;
  departmentDomain: string | null;
  approvals: EventApproval[];
  createdByPerId: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface UseEventsParams {
  campusId?: string;
  statuses?: string[];
}

export function useEvents(params: UseEventsParams = {}) {
  const [items, setItems] = useState<WorkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams();
    if (params.campusId) q.set('campusId', params.campusId);
    if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
    const qs = q.toString();
    api
      .get<{ items: WorkEvent[] }>(`/api/work-schedule/events${qs ? `?${qs}` : ''}`)
      .then((res) => setItems(res.items || []))
      .catch((e: any) => setError(e.message || 'Không tải được danh sách lịch công tác.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
