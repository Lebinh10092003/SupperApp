import { useCallback, useEffect, useState } from 'react';
import { api } from '../../../services/api';

/**
 * Dùng chung bởi IncidentsListPage và EmergencyCockpitPage (lọc P0/P1 ở
 * client, KHÔNG có endpoint riêng cho cockpit) — xem plan Phase 1 §3/§4.
 */
export interface UseIncidentsParams {
  campusId?: string;
  categoryCodes?: string[];
  priorities?: string[];
  states?: string[];
  searchText?: string;
  onlyMine?: boolean;
  fromDate?: string;
  toDate?: string;
  limit?: number;
}

export interface IncidentSlaClock {
  deadlineAt: string;
  status: string;
  paused: boolean;
}

/**
 * Superset của mọi field mà GET /api/safety/incidents có thể trả — khi
 * `redacted === true`, server CHỈ trả 5 field bắt buộc dưới đây, mọi field
 * khác sẽ là `undefined` (không phải lỗi, đúng thiết kế che giấu theo mức
 * bí mật — xem safety-query.routes.ts).
 */
export interface IncidentListItem {
  incidentId: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  confidentiality: 'C1' | 'C2' | 'C3' | 'C4';
  state: string;
  campusId: string;
  redacted?: boolean;
  categoryCode?: string;
  categoryLabel?: string | null;
  className?: string | null;
  content?: string;
  commanderPerId?: string | null;
  commanderName?: string | null;
  slaClocks?: Record<string, IncidentSlaClock> | null;
  updatedAt?: string;
  createdAt?: string;
}

function buildQueryString(params: UseIncidentsParams): string {
  const q = new URLSearchParams();
  if (params.campusId) q.set('campusId', params.campusId);
  if (params.categoryCodes?.length) q.set('categoryCodes', params.categoryCodes.join(','));
  if (params.priorities?.length) q.set('priorities', params.priorities.join(','));
  if (params.states?.length) q.set('states', params.states.join(','));
  if (params.searchText) q.set('searchText', params.searchText);
  if (params.onlyMine) q.set('onlyMine', 'true');
  if (params.fromDate) q.set('fromDate', params.fromDate);
  if (params.toDate) q.set('toDate', params.toDate);
  if (params.limit) q.set('limit', String(params.limit));
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function useIncidents(params: UseIncidentsParams) {
  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const paramsKey = JSON.stringify(params);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<IncidentListItem[]>(`/api/safety/incidents${buildQueryString(params)}`)
      .then((rows) => setItems(rows || []))
      .catch((e: any) => setError(e.message || 'Không tải được danh sách hồ sơ sự cố.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { items, loading, error, refetch };
}
