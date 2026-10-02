/**
 * EmergencyCockpitPage.tsx — Chunk B. Danh sách hồ sơ P0/P1 đang mở, style
 * khẩn cấp (banner đỏ/cam, nút to). Route: `/safety/cockpit`. Phase 1
 * KHÔNG có SLA countdown live/websocket (theo chốt của Hestia) — chỉ hiện
 * tĩnh `slaClocks.deadlineAt`, tự poll lại danh sách mỗi 30s.
 *
 * Dùng `useIncidents` thật (`./hooks/useIncidents`, Chunk A/Hestia,
 * PR #12) — trước đó dùng `useIncidentsTemp` tạm thời cùng interface,
 * đã xoá sau khi Chunk A merge.
 */
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TriangleAlert, Loader2 } from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { useIncidents } from './hooks/useIncidents';
import { CAMPUS_LABEL, SLA_CLOCK_LABEL } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateTime } from '@/lib/utils';

export default function EmergencyCockpitPage() {
  const { items, loading, error, refetch } = useIncidents({ priorities: ['P0', 'P1'] });

  // Poll lại mỗi 30s — Phase 1 chưa có websocket/live update.
  useEffect(() => {
    const timer = setInterval(refetch, 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = items.filter((it) => it.state !== 'Đã đóng' && it.state !== 'Trùng' && it.state !== 'Tin rác');

  return (
    <>
      <PageHeader title="Cockpit khẩn cấp" icon={<TriangleAlert />} />

      {error && (
        <Alert className="mb-5 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid p-8 place-items-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      ) : open.length === 0 ? (
        <div className="rounded-xl border border-slate-200 py-12 text-center">
          <p className="font-bold text-[#0f172a]">Không có hồ sơ P0/P1 nào đang mở</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {open.map((it) => (
            <Link
              key={it.incidentId}
              to={`/safety/incidents/${it.incidentId}`}
              className={cn(
                'block rounded-xl border border-slate-200 border-l-4 p-5 no-underline transition-shadow hover:shadow-[0_1px_3px_rgba(15,23,42,0.08)]',
                it.priority === 'P0' ? 'border-l-red-600 bg-red-50' : 'border-l-orange-600 bg-orange-50'
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <PriorityChip priority={it.priority} compact />
                <StatusChip state={it.state} />
                <Badge variant="outline" className="border-transparent bg-slate-50 text-slate-700">
                  {CAMPUS_LABEL[it.campusId] || it.campusId}
                </Badge>
              </div>
              <p className="font-bold text-[#0f172a]">
                {it.incidentId} {it.categoryLabel ? `— ${it.categoryLabel}` : ''}
              </p>
              <p className="text-sm text-slate-500">
                {it.className ? `Lớp ${it.className} — ` : ''}Chỉ huy: {it.commanderName || 'Chưa chỉ định'}
              </p>
              {it.slaClocks && Object.keys(it.slaClocks).length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  {Object.entries(it.slaClocks)
                    .map(([label, c]) => `${SLA_CLOCK_LABEL[label] || label}: hạn ${formatDateTime(c.deadlineAt)}`)
                    .join(' · ')}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
