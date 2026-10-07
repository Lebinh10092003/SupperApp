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
  endAt: string | null;
  location: string;
  chairPerId: string;
  chairName?: string | null;
  chairRoleLabel?: string | null;
  chairLabel?: string;
  participantPerIds: string[];
  participantLabels?: string[];
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
  // Backend đã gắn sẵn từ trước (attachTaskProgress, work-schedule.service.ts)
  // nhưng frontend chưa từng khai báo/hiển thị — Sin yêu cầu 2026-10-05:
  // "thanh progress nên hiển thị ở ngoài cho dễ nhìn", đưa ra bảng danh
  // sách thay vì chỉ nằm trong dialog chi tiết.
  taskCount?: number;
  taskCompletedCount?: number;
  taskProgressPercent?: number | null;
}

export interface UseEventsParams {
  campusId?: string;
  statuses?: string[];
  includeSchoolWide?: boolean;
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
    if (params.includeSchoolWide === false) q.set('includeSchoolWide', 'false');
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
