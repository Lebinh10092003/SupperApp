/**
 * AuditTrailPanel.tsx — panel "Lịch sử" nhúng vào dialog chi tiết lịch
 * công tác/công việc, đọc `GET /api/work-schedule/audit-logs`. Dùng
 * chung cho cả `EventDetailDialog` (EventsListPage.tsx) và
 * `TaskDetailDialog` (TasksListPage.tsx) — đặt file riêng thay vì viết
 * lặp lại 2 lần.
 */
import { useEffect, useState } from 'react';
import { ChevronDown, History, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EVENT_STATUS_LABEL, TASK_STATUS_LABEL, formatScheduleDateTime } from './constants';

export interface AuditLogEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorPerId: string;
  actorLabel?: string;
  before: unknown;
  after: unknown;
  createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  'event.created': 'Tạo lịch',
  'event.updated_for_revision': 'Sửa lại sau khi bị yêu cầu chỉnh sửa',
  'event.status_changed': 'Đổi trạng thái',
  'event.published': 'Ban hành (duyệt xong)',
  'event.approval_step': 'Duyệt 1 bước (chờ bước tiếp theo)',
  'task.created': 'Giao việc',
  'task.status_changed': 'Đổi trạng thái',
  'task.accepted': 'Nghiệm thu',
  'task.returned': 'Trả lại'
};

/**
 * Tóm tắt thay đổi trạng thái từ `before`/`after` (nguyên 2 bản ghi đầy đủ
 * do `writeAuditLog` bên backend ghi lại — xem work-schedule.service.ts) —
 * CHỈ đọc trường `status` sẵn có, không suy diễn/thêm dữ liệu backend
 * không trả về. Trả '—' nếu không có đủ dữ liệu để so sánh.
 */
function summarizeChange(entityType: 'event' | 'task', log: AuditLogEntry): string {
  const label = entityType === 'event' ? EVENT_STATUS_LABEL : TASK_STATUS_LABEL;
  const beforeStatus = (log.before as { status?: string } | null)?.status;
  const afterStatus = (log.after as { status?: string } | null)?.status;
  if (afterStatus && beforeStatus && beforeStatus !== afterStatus) {
    return `${label[beforeStatus] || beforeStatus} → ${label[afterStatus] || afterStatus}`;
  }
  if (afterStatus && !beforeStatus) {
    return label[afterStatus] || afterStatus;
  }
  return '—';
}

export function AuditTrailPanel({
  entityType,
  entityId,
  refreshKey
}: {
  entityType: 'event' | 'task';
  entityId: string;
  /** Tăng giá trị này (VD đếm số lần đã thao tác thành công) để buộc tải
   * lại lịch sử — Collapsible KHÔNG unmount khi thu gọn/mở lại, nên nếu
   * chỉ phụ thuộc [entityType, entityId] (không đổi khi đổi trạng thái
   * trong cùng 1 phiên mở dialog), danh sách hiển thị sẽ bị CŨ sau khi
   * thực hiện hành động mà không đóng-mở lại dialog (Sin phản hồi
   * 2026-09-11, phát hiện qua verify thật: Lịch sử (3) không đổi sau 2
   * hành động, dù backend đã ghi đủ (5) — chỉ đóng-mở lại dialog mới
   * đúng). */
  refreshKey?: number | string;
}) {
  const [items, setItems] = useState<AuditLogEntry[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setError('');
    api
      .get<{ items: AuditLogEntry[] }>(`/api/work-schedule/audit-logs?entityType=${entityType}&entityId=${entityId}`)
      .then((res) => {
        if (!cancelled) setItems(res.items || []);
      })
      .catch((e: any) => {
        if (!cancelled) setError(e.message || 'Không tải được lịch sử.');
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, refreshKey]);

  return (
    <Collapsible className="rounded-lg border border-slate-200">
      <CollapsibleTrigger className="group flex w-full items-center justify-between p-3 text-left">
        <div className="flex items-center gap-1.5">
          <History className="size-4 text-slate-500" />
          <p className="text-sm font-bold">Lịch sử{items ? ` (${items.length})` : ''}</p>
        </div>
        <ChevronDown className="size-4 shrink-0 text-slate-500 transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!items && !error && (
          <div className="flex justify-center py-2">
            <Loader2 className="size-[18px] animate-spin text-slate-400" />
          </div>
        )}
        {items && items.length === 0 && <p className="text-sm text-slate-500">Chưa có nhật ký nào.</p>}
        {items && items.length > 0 && (
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Thay đổi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">{formatScheduleDateTime(log.createdAt)}</TableCell>
                    <TableCell>{log.actorLabel || log.actorPerId}</TableCell>
                    <TableCell>{ACTION_LABEL[log.action] || log.action}</TableCell>
                    <TableCell>{summarizeChange(entityType, log)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
