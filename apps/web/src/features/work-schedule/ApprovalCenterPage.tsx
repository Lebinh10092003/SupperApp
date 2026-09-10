import { useMemo, useState } from 'react';
import { Alert, Box, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import FactCheckIcon from '@mui/icons-material/FactCheckRounded';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { EventDetailDialog, canApproveClientSide } from './EventsListPage';
import { TaskDetailDialog } from './TasksListPage';
import { CAMPUS_LABEL } from './constants';

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

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader title="Trung tâm phê duyệt" subtitle="Lịch cần xử lý và công việc chờ nghiệm thu của bạn" icon={<FactCheckIcon />} />

      {eventsError && <Alert severity="error" sx={{ mb: 2 }}>{eventsError}</Alert>}
      {tasksError && <Alert severity="error" sx={{ mb: 2 }}>{tasksError}</Alert>}

      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Lịch cần xử lý ({myEvents.length})
          </Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tiêu đề</TableCell>
                  <TableCell>Cơ sở</TableCell>
                  <TableCell>Thời gian</TableCell>
                  <TableCell>Trạng thái</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myEvents.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Không có lịch nào cần xử lý.
                    </TableCell>
                  </TableRow>
                )}
                {myEvents.map((ev) => (
                  <TableRow key={ev.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEventDetail(ev)}>
                    <TableCell>{ev.title}</TableCell>
                    <TableCell>{CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                    <TableCell>{new Date(ev.startAt).toLocaleString('vi-VN')}</TableCell>
                    <TableCell>{ev.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Công việc chờ nghiệm thu ({myPendingAcceptanceTasks.length})
          </Typography>
          <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Công việc</TableCell>
                  <TableCell>Cơ sở</TableCell>
                  <TableCell>Người thực hiện</TableCell>
                  <TableCell>Hạn</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {myPendingAcceptanceTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                      Không có công việc nào chờ nghiệm thu.
                    </TableCell>
                  </TableRow>
                )}
                {myPendingAcceptanceTasks.map((t) => (
                  <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskDetail(t)}>
                    <TableCell>{t.title}</TableCell>
                    <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                    <TableCell>{t.assigneePerId}</TableCell>
                    <TableCell>{new Date(t.dueAt).toLocaleString('vi-VN')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Stack>

      <EventDetailDialog
        event={eventDetail}
        actorPerId={actor?.perId}
        canApprove={eventDetail ? canApproveClientSide(actor?.roles || [], eventDetail) : false}
        isPrincipal={!!actor?.roles.some((r) => r.roleId === 'R.PRINCIPAL')}
        onClose={() => setEventDetail(null)}
        onChanged={(updated) => {
          setEventDetail(updated);
          refetchEvents();
        }}
      />
      <TaskDetailDialog
        task={taskDetail}
        actorPerId={actor?.perId}
        onClose={() => setTaskDetail(null)}
        onChanged={(updated) => {
          setTaskDetail(updated);
          refetchTasks();
        }}
      />
    </Box>
  );
}
