/**
 * OverviewPage.tsx — trang "Tổng quan" của module Lịch công tác, đối chiếu
 * lại bản gốc App_lich_cong_tac_giao_viec/FT_Lich_cong_tac_V30_source
 * (component `Overview` trong app-shell.tsx) theo note của Mr Tiến: bản
 * port trước đây (2026-09) BỎ SÓT hẳn trang này — vào thẳng danh sách lịch,
 * không có khối "Lịch công tác 7 ngày tới"/"Công việc 7 ngày tới" tổng hợp
 * riêng cho từng người (Sin phát hiện 2026-09-21).
 *
 * Lọc HOÀN TOÀN ở client từ `useEvents`/`useTasks` (đã tải sẵn), giống
 * cách RemindersPage.tsx làm — không cần endpoint riêng:
 *   - Lịch: status PUBLISHED, startAt rơi trong [hôm nay, hôm nay+6 ngày]
 *     (giờ VN), VÀ (actor là chủ trì HOẶC actor có trong participantPerIds
 *     HOẶC scope SCHOOL_WIDE) — khớp đúng điều kiện bản gốc.
 *   - Việc: dueAt rơi trong cùng khoảng 7 ngày, VÀ actor là assigneePerId.
 */
import { useMemo, useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/DashboardRounded';
import { PageHeader } from '../../components/PageHeader';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { EventDetailDialog, EventStatusChip } from './EventsListPage';
import { TaskDetailDialog, TaskStatusChip } from './TasksListPage';
import { CAMPUS_LABEL, abbreviatePersonLabel } from './constants';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Ngày dạng "YYYY-MM-DD" theo giờ Việt Nam — dùng so sánh khoảng ngày, khớp cách bản gốc làm (dayKey). */
function vnDayKey(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export default function OverviewPage() {
  const navigate = useNavigate();
  const { items: events, refetch: refetchEvents } = useEvents({});
  const { items: tasks, refetch: refetchTasks } = useTasks({});
  const { actor } = useActor();

  const [eventDetail, setEventDetail] = useState<WorkEvent | null>(null);
  const [taskDetail, setTaskDetail] = useState<WorkTask | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const { todayKey, lastDayKey } = useMemo(() => {
    const today = vnDayKey(new Date().toISOString());
    const last = new Date();
    last.setDate(last.getDate() + 6);
    return { todayKey: today, lastDayKey: vnDayKey(last.toISOString()) };
  }, []);

  const upcomingEvents = useMemo(() => {
    if (!actor) return [];
    return events
      .filter((ev) => {
        if (ev.status !== 'PUBLISHED') return false;
        const day = vnDayKey(ev.startAt);
        if (day < todayKey || day > lastDayKey) return false;
        const isChair = ev.chairPerId === actor.perId;
        const isParticipant = ev.participantPerIds.includes(actor.perId);
        return isChair || isParticipant || ev.scope === 'SCHOOL_WIDE';
      })
      .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [events, actor, todayKey, lastDayKey]);

  const upcomingTasks = useMemo(() => {
    if (!actor) return [];
    return tasks
      .filter((t) => {
        const day = vnDayKey(t.dueAt);
        if (day < todayKey || day > lastDayKey) return false;
        return t.assigneePerId === actor.perId;
      })
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [tasks, actor, todayKey, lastDayKey]);

  return (
    <>
      <PageHeader title="Tổng quan" icon={<DashboardIcon />} />

      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast.message}
        </Alert>
      )}

      <Stack spacing={3}>
        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Lịch công tác 7 ngày tới
              </Typography>
              <Button size="small" onClick={() => navigate('/work-schedule')}>
                Xem toàn bộ
              </Button>
            </Stack>
            {upcomingEvents.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có lịch trong 7 ngày tới — chưa có lịch do bạn chủ trì, được mời tham dự hoặc áp dụng cho toàn trường.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ngày</TableCell>
                      <TableCell>Nội dung</TableCell>
                      <TableCell>Cơ sở</TableCell>
                      <TableCell>Chủ trì</TableCell>
                      <TableCell>Thành phần</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingEvents.map((ev) => {
                      const fullParticipants = ev.participantLabels && ev.participantLabels.length > 0 ? ev.participantLabels : ev.participantPerIds;
                      const participantFull = ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : fullParticipants.join(', ') || '—';
                      const participantAbbrev =
                        ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : fullParticipants.map(abbreviatePersonLabel).join(', ') || '—';
                      return (
                      <TableRow key={ev.id} hover sx={{ cursor: 'pointer' }} onClick={() => setEventDetail(ev)}>
                        <TableCell>{new Date(ev.startAt).toLocaleString('vi-VN')}</TableCell>
                        <TableCell>{ev.title}</TableCell>
                        <TableCell>{ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                        <TableCell title={ev.chairLabel || ev.chairPerId}>{abbreviatePersonLabel(ev.chairLabel || ev.chairPerId)}</TableCell>
                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={participantFull}>
                          {participantAbbrev}
                        </TableCell>
                        <TableCell>
                          <EventStatusChip status={ev.status} />
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Công việc 7 ngày tới
              </Typography>
              <Button size="small" onClick={() => navigate('/work-schedule/tasks')}>
                Xem bảng việc
              </Button>
            </Stack>
            {upcomingTasks.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Không có công việc nào đến hạn trong khoảng thời gian này.
              </Typography>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Hạn</TableCell>
                      <TableCell>Công việc</TableCell>
                      <TableCell>Cơ sở</TableCell>
                      <TableCell>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {upcomingTasks.map((t) => (
                      <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setTaskDetail(t)}>
                        <TableCell>{new Date(t.dueAt).toLocaleString('vi-VN')}</TableCell>
                        <TableCell>{t.title}</TableCell>
                        <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
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
      </Stack>

      <EventDetailDialog
        event={eventDetail}
        actorPerId={actor?.perId}
        canApprove={false}
        isPrincipal={false}
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
