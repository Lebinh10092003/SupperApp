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
import { Alert, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveRounded';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { EventDetailDialog, EventStatusChip, canApproveClientSide } from './EventsListPage';
import { TaskDetailDialog, TaskStatusChip } from './TasksListPage';
import { useActor } from './hooks/useActor';
import { CAMPUS_LABEL, abbreviatePersonLabel } from './constants';

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
      <PageHeader
        title="Nhắc nhở"
        icon={<NotificationsActiveIcon />}
      />

      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast.message}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card sx={{ borderRadius: 3, border: '1px solid #2563eb', boxShadow: 'none' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Cần bạn xử lý ({actionEvents.length + actionTasks.length})
            </Typography>
            {actionEvents.length === 0 && actionTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có lịch/việc nào đang cần bạn hành động.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Loại</TableCell>
                      <TableCell>Tiêu đề</TableCell>
                      <TableCell>Cơ sở</TableCell>
                      <TableCell>Lý do</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {actionEvents.map(({ event: ev, reason }) => (
                      <TableRow key={`event-${ev.id}`} hover sx={{ cursor: 'pointer' }} onClick={() => setEventDetail(ev)}>
                        <TableCell>Lịch</TableCell>
                        <TableCell>{ev.title}</TableCell>
                        <TableCell>{ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={EVENT_REASON_LABEL[reason]}
                            sx={{
                              bgcolor: reason === 'PENDING_AWAITING_LEADER' ? '#f1f5f9' : '#eff6ff',
                              color: reason === 'PENDING_AWAITING_LEADER' ? '#475569' : '#1d4ed8',
                              fontWeight: 600
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <EventStatusChip status={ev.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                    {actionTasks.map(({ task: t, reason }) => (
                      <TableRow key={`task-${t.id}`} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskDetail(t)}>
                        <TableCell>Việc</TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                        <TableCell>
                          <Chip size="small" label={TASK_REASON_LABEL[reason]} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600 }} />
                        </TableCell>
                        <TableCell>
                          <TaskStatusChip status={t.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Lịch trùng ({conflictingEvents.length})
            </Typography>
            {conflictingEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có lịch nào đang trùng.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Tiêu đề</TableCell>
                      <TableCell>Cơ sở</TableCell>
                      <TableCell>Thời gian</TableCell>
                      <TableCell>Ghi chú trùng</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {conflictingEvents.map((ev) => (
                      <TableRow key={ev.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEventDetail(ev)}>
                        <TableCell>{ev.title}</TableCell>
                        <TableCell>{CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                        <TableCell>{new Date(ev.startAt).toLocaleString('vi-VN')}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ev.conflictNote} sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 600 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
              Công việc quá hạn ({overdueTasks.length})
            </Typography>
            {overdueTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có công việc nào quá hạn.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Công việc</TableCell>
                      <TableCell>Cơ sở</TableCell>
                      <TableCell>Phụ trách</TableCell>
                      <TableCell>Hạn (đã quá)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {overdueTasks.map((t) => (
                      <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskDetail(t)}>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                        <TableCell title={t.assigneeLabel || t.assigneeName || t.assigneePerId}>
                          {abbreviatePersonLabel(t.assigneeLabel || t.assigneeName || t.assigneePerId)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={new Date(t.dueAt).toLocaleString('vi-VN')} sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 600 }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Stack>

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
