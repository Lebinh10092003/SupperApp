/**
 * RemindersPage.tsx — trang "Nhắc nhở", khớp mẫu bản gốc Mr Tiến: gộp 2
 * loại việc cần chú ý — (1) lịch công tác đang có ghi chú trùng lịch
 * (`conflictNote` khác rỗng, chưa hủy), (2) công việc quá hạn (`dueAt` đã
 * qua, chưa COMPLETED/CANCELLED). Tính toán HOÀN TOÀN ở client từ
 * `useEvents`/`useTasks` (đã có sẵn, Chunk A) — không cần endpoint riêng.
 *
 * Bấm vào 1 dòng mở đúng dialog chi tiết thật (tái dùng
 * `EventDetailDialog`/`TaskDetailDialog` đã export sẵn từ 2 trang list),
 * không viết lại dialog riêng.
 */
import { useMemo, useState } from 'react';
import { Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveRounded';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { EventDetailDialog } from './EventsListPage';
import { TaskDetailDialog } from './TasksListPage';
import { useActor } from './hooks/useActor';
import { CAMPUS_LABEL } from './constants';

const NON_TERMINAL_TASK_STATUSES = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'RETURNED'];

export default function RemindersPage() {
  const { items: events, refetch: refetchEvents } = useEvents({});
  const { items: tasks, refetch: refetchTasks } = useTasks({});
  const { actor } = useActor();

  const [eventDetail, setEventDetail] = useState<WorkEvent | null>(null);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);

  const conflictingEvents = useMemo(
    () => events.filter((e) => e.conflictNote && e.status !== 'CANCELLED'),
    [events]
  );

  const overdueTasks = useMemo(() => {
    const now = Date.now();
    return tasks.filter((t) => NON_TERMINAL_TASK_STATUSES.includes(t.status) && new Date(t.dueAt).getTime() < now);
  }, [tasks]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Nhắc nhở"
        subtitle="Lịch bị trùng cần xử lý + công việc đã quá hạn chưa hoàn thành"
        icon={<NotificationsActiveIcon />}
      />

      <Stack spacing={3}>
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
                        <TableCell>{t.assigneePerId}</TableCell>
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
        canApprove={false}
        isPrincipal={false}
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
