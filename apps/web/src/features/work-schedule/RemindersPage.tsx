/**
 * RemindersPage.tsx — trang "Nhắc nhở". Mr Tiến phản hồi 2026-09-21: bản
 * cũ (khớp `ReminderView` gốc) chỉ có "Lịch trùng" + "Công việc quá hạn" —
 * CHƯA đủ, cần thêm rõ khối "Cần bạn xử lý" gồm lịch/việc đang chờ CHÍNH
 * actor hành động (nháp/bị trả lại/chờ duyệt) hoặc đang chờ người có quyền
 * cao hơn (chỉ hiển thị để actor biết, không thao tác được). Tính hoàn
 * toàn ở client từ `useEvents`/`useTasks` đã có sẵn, không cần endpoint
 * riêng — cùng cách RemindersPage bản gốc làm.
 */
import { useMemo, useState } from 'react';
import { BellRing } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { EventDetailDialog, EventStatusChip, canApproveClientSide } from './EventsListPage';
import { TaskDetailDialog, TaskStatusChip } from './TasksListPage';
import { useActor } from './hooks/useActor';
import { CAMPUS_LABEL, abbreviatePersonLabel } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatDateTime } from '@/lib/utils';

const NON_TERMINAL_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'RETURNED'];

type ActionEventReason = 'DRAFT_MINE' | 'REVISION_MINE' | 'PENDING_CAN_APPROVE' | 'PENDING_AWAITING_LEADER';
type ActionTaskReason = 'ASSIGNED_MINE' | 'RETURNED_MINE' | 'PENDING_ACCEPTANCE_MINE';

const EVENT_REASON_LABEL: Record<ActionEventReason, string> = {
  DRAFT_MINE: 'Nháp — chưa gửi duyệt',
  REVISION_MINE: 'Bị yêu cầu sửa lại',
  PENDING_CAN_APPROVE: 'Đang chờ bạn duyệt',
  PENDING_AWAITING_LEADER: 'Đang chờ lãnh đạo duyệt'
};

const TASK_REASON_LABEL: Record<ActionTaskReason, string> = {
  ASSIGNED_MINE: 'Việc mới — chưa nhận',
  RETURNED_MINE: 'Bị trả lại — cần làm tiếp',
  PENDING_ACCEPTANCE_MINE: 'Đang chờ bạn nghiệm thu'
};

export default function RemindersPage() {
  const { items: events, refetch: refetchEvents } = useEvents({});
  const { items: tasks, refetch: refetchTasks } = useTasks({});
  const { actor } = useActor();

  const [eventDetail, setEventDetail] = useState<WorkEvent | null>(null);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const actionEvents = useMemo(() => {
    if (!actor) return [];
    const out: { event: WorkEvent; reason: ActionEventReason }[] = [];
    for (const ev of events) {
      const isMine = ev.createdByPerId === actor.perId;
      if (ev.status === 'DRAFT' && isMine) out.push({ event: ev, reason: 'DRAFT_MINE' });
      else if (ev.status === 'REVISION_REQUIRED' && isMine) out.push({ event: ev, reason: 'REVISION_MINE' });
      else if (ev.status === 'PENDING_APPROVAL' && canApproveClientSide(actor.roles, ev)) out.push({ event: ev, reason: 'PENDING_CAN_APPROVE' });
      else if (ev.status === 'PENDING_APPROVAL' && isMine) out.push({ event: ev, reason: 'PENDING_AWAITING_LEADER' });
    }
    return out.sort((a, b) => new Date(a.event.startAt).getTime() - new Date(b.event.startAt).getTime());
  }, [events, actor]);

  const actionTasks = useMemo(() => {
    if (!actor) return [];
    const out: { task: WorkTask; reason: ActionTaskReason }[] = [];
    for (const t of tasks) {
      const isAssignee = t.assigneePerId === actor.perId;
      const isCreator = t.createdByPerId === actor.perId;
      if (t.status === 'ASSIGNED' && isAssignee) out.push({ task: t, reason: 'ASSIGNED_MINE' });
      else if (t.status === 'RETURNED' && isAssignee) out.push({ task: t, reason: 'RETURNED_MINE' });
      else if (t.status === 'PENDING_ACCEPTANCE' && isCreator) out.push({ task: t, reason: 'PENDING_ACCEPTANCE_MINE' });
    }
    return out.sort((a, b) => new Date(a.task.dueAt).getTime() - new Date(b.task.dueAt).getTime());
  }, [tasks, actor]);

  const conflictingEvents = useMemo(
    () => events.filter((e) => e.conflictNote && e.status !== 'CANCELLED'),
    [events]
  );

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => NON_TERMINAL_TASK_STATUSES.includes(t.status) && new Date(t.dueAt).getTime() < now);
  }, [tasks]);

  return (
    <>
      <PageHeader title="Nhắc nhở" icon={<BellRing />} />

      {toast && (
        <Alert className={cn('mb-4', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-6">
        <div className="rounded-xl border-2 border-primary p-5">
          <p className="mb-3 text-sm font-bold">Cần bạn xử lý ({actionEvents.length + actionTasks.length})</p>
          {actionEvents.length === 0 && actionTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Không có lịch/việc nào đang cần bạn hành động.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Cơ sở</TableHead>
                    <TableHead>Lý do</TableHead>
                    <TableHead>Trạng thái</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actionEvents.map(({ event: ev, reason }) => (
                    <TableRow key={`event-${ev.id}`} className="cursor-pointer" onClick={() => setEventDetail(ev)}>
                      <TableCell>Lịch</TableCell>
                      <TableCell>{ev.title}</TableCell>
                      <TableCell>{ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'border-transparent font-semibold',
                            reason === 'PENDING_AWAITING_LEADER' ? 'bg-slate-100 text-slate-600' : 'bg-secondary text-[#1d4ed8]'
                          )}
                        >
                          {EVENT_REASON_LABEL[reason]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <EventStatusChip status={ev.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {actionTasks.map(({ task: t, reason }) => (
                    <TableRow key={`task-${t.id}`} className="cursor-pointer" onClick={() => setTaskDetail(t)}>
                      <TableCell>Việc</TableCell>
                      <TableCell>{t.title}</TableCell>
                      <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
                          {TASK_REASON_LABEL[reason]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <TaskStatusChip status={t.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="mb-3 text-sm font-bold">Lịch trùng ({conflictingEvents.length})</p>
          {conflictingEvents.length === 0 ? (
            <p className="text-sm text-slate-500">Không có lịch nào đang trùng.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Tiêu đề</TableHead>
                    <TableHead>Cơ sở</TableHead>
                    <TableHead>Ghi chú trùng</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conflictingEvents.map((ev) => (
                    <TableRow key={ev.id} className="cursor-pointer" onClick={() => setEventDetail(ev)}>
                      <TableCell>{formatDateTime(ev.startAt)}</TableCell>
                      <TableCell>{ev.title}</TableCell>
                      <TableCell>{CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-transparent bg-red-50 text-red-600">
                          {ev.conflictNote}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 p-5">
          <p className="mb-3 text-sm font-bold">Công việc quá hạn ({overdueTasks.length})</p>
          {overdueTasks.length === 0 ? (
            <p className="text-sm text-slate-500">Không có công việc nào quá hạn.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hạn (đã quá)</TableHead>
                    <TableHead>Công việc</TableHead>
                    <TableHead>Cơ sở</TableHead>
                    <TableHead>Phụ trách</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueTasks.map((t) => (
                    <TableRow key={t.id} className="cursor-pointer" onClick={() => setTaskDetail(t)}>
                      <TableCell>
                        <Badge variant="outline" className="border-transparent bg-orange-50 text-orange-700">
                          {formatDateTime(t.dueAt)}
                        </Badge>
                      </TableCell>
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
          )}
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
