import { useMemo, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { EventDetailDialog, canApproveClientSide, EventStatusChip } from './EventsListPage';
import { TaskDetailDialog } from './TasksListPage';
import { CAMPUS_LABEL, abbreviatePersonLabel, formatScheduleDateTime } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Trung tâm phê duyệt — theo đúng mẫu bản gốc Mr Tiến (ApprovalView): 2
 * khung "Lịch cần xử lý" (PENDING_APPROVAL actor có quyền duyệt, hoặc
 * DRAFT/REVISION_REQUIRED của chính actor) + "Công việc chờ nghiệm thu"
 * (PENDING_ACCEPTANCE mà actor là người giao). Tái dùng thẳng 2 dialog chi
 * tiết đã có ở EventsListPage/TasksListPage — không viết lại logic hành
 * động state machine ở đây.
 */
export default function ApprovalCenterPage() {
  const { actor } = useActor();
  const { items: events, error: eventsError, refetch: refetchEvents } = useEvents({ statuses: ['PENDING_APPROVAL', 'DRAFT', 'REVISION_REQUIRED'] });
  const { items: tasks, error: tasksError, refetch: refetchTasks } = useTasks({ statuses: ['PENDING_ACCEPTANCE'] });

  const myEvents = useMemo(() => {
    if (!actor) return [];
    return events.filter((ev) => {
      if (ev.status === 'PENDING_APPROVAL') return canApproveClientSide(actor.roles, ev);
      return ev.createdByPerId === actor.perId; // DRAFT/REVISION_REQUIRED của chính mình
    });
  }, [events, actor]);

  const myPendingAcceptanceTasks = useMemo(() => {
    if (!actor) return [];
    return tasks.filter((t) => t.createdByPerId === actor.perId);
  }, [tasks, actor]);

  const [eventDetail, setEventDetail] = useState<WorkEvent | null>(null);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  return (
    <>
      <PageHeader title="Trung tâm phê duyệt" icon={<ClipboardCheck />} />

      {eventsError && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{eventsError}</AlertDescription>
        </Alert>
      )}
      {tasksError && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{tasksError}</AlertDescription>
        </Alert>
      )}
      {toast && (
        <Alert className={cn('mb-4', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-bold">Lịch cần xử lý ({myEvents.length})</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                      Không có lịch nào cần xử lý.
                    </TableCell>
                  </TableRow>
                )}
                {myEvents.map((ev) => (
                  <TableRow key={ev.id} className="cursor-pointer" onClick={() => setEventDetail(ev)}>
                    <TableCell>{formatScheduleDateTime(ev.startAt)}</TableCell>
                    <TableCell>{ev.title}</TableCell>
                    <TableCell>{CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                    <TableCell>
                      <EventStatusChip status={ev.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">Công việc chờ nghiệm thu ({myPendingAcceptanceTasks.length})</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hạn</TableHead>
                  <TableHead>Công việc</TableHead>
                  <TableHead>Cơ sở</TableHead>
                  <TableHead>Người thực hiện</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPendingAcceptanceTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                      Không có công việc nào chờ nghiệm thu.
                    </TableCell>
                  </TableRow>
                )}
                {myPendingAcceptanceTasks.map((t) => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => setTaskDetail(t)}>
                    <TableCell>{formatScheduleDateTime(t.dueAt)}</TableCell>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                    <TableCell title={t.assigneeLabel || t.assigneeName || t.assigneePerId}>
                      {abbreviatePersonLabel(t.assigneeLabel || t.assigneeName || t.assigneePerId)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <EventDetailDialog
        event={eventDetail}
        actorPerId={actor?.perId}
        canApprove={eventDetail ? canApproveClientSide(actor?.roles || [], eventDetail) : false}
        isPrincipal={!!actor?.roles.some((r) => r.roleId === 'R.PRINCIPAL')}
        onClose={() => setEventDetail(null)}
        onChanged={(updated) => {
          setEventDetail((prev) => (prev ? { ...prev, ...updated } : updated));
          refetchEvents();
        }}
        onSuccess={(message) => setToast({ message, severity: 'success' })}
      />
      <TaskDetailDialog
        task={taskDetail}
        actorPerId={actor?.perId}
        onClose={() => setTaskDetail(null)}
        onChanged={(updated) => {
          setTaskDetail((prev) => (prev ? { ...prev, ...updated } : updated));
          refetchTasks();
        }}
        onSuccess={(message) => setToast({ message, severity: 'success' })}
      />
    </>
  );
}
