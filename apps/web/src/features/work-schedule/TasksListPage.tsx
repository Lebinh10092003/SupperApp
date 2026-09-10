import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineRounded';
import AssignmentIcon from '@mui/icons-material/AssignmentRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { PersonPicker, type PersonOption } from '../safety/PersonPicker';
import { AuditTrailPanel } from './AuditTrailPanel';
import { CAMPUS_IDS, CAMPUS_LABEL, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PRIORITY_LABEL } from './constants';

function TaskStatusChip({ status }: { status: string }) {
  const c = TASK_STATUS_COLOR[status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Chip
      label={TASK_STATUS_LABEL[status] || status}
      size="small"
      sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}

const STATUS_FILTER_OPTIONS = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'COMPLETED', 'RETURNED', 'CANCELLED'];

export default function TasksListPage() {
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [relation, setRelation] = useState<'MINE' | 'ASSIGNED_BY_ME' | 'ALL'>('ALL');
  const { actor } = useActor();
  const { items, loading, error, refetch } = useTasks({
    campusId: campusFilter || undefined,
    statuses: statusFilter ? [statusFilter] : undefined,
    assigneePerId: relation === 'MINE' ? actor?.perId : undefined
  });

  const [searchText, setSearchText] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonOption | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Lọc thêm ở client (tìm theo tiêu đề/username người + khoảng ngày hạn)
  // — cùng cách tiếp cận với EventsListPage.tsx, không đụng useTasks.ts.
  const filteredItems = useMemo(() => {
    let out = items;
    if (relation === 'ASSIGNED_BY_ME' && actor) out = out.filter((t) => t.createdByPerId === actor.perId);
    const text = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    return out.filter((t) => {
      if (text && !t.title.toLowerCase().includes(text)) return false;
      if (personFilter && t.assigneePerId !== personFilter.perId && !t.collaboratorPerIds.includes(personFilter.perId)) return false;
      const dueMs = new Date(t.dueAt).getTime();
      if (from !== null && dueMs < from) return false;
      if (to !== null && dueMs > to) return false;
      return true;
    });
  }, [items, relation, actor, searchText, personFilter, fromDate, toDate]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WorkTask | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campusId, setCampusId] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState<PersonOption | null>(null);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCampusId('');
    setPriority('NORMAL');
    setDueAt('');
    setAssignee(null);
    setCreateError('');
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!title.trim()) return setCreateError('Vui lòng nhập tiêu đề.');
    if (!campusId) return setCreateError('Vui lòng chọn cơ sở.');
    if (!assignee) return setCreateError('Vui lòng chọn người được giao.');
    if (!dueAt) return setCreateError('Vui lòng chọn hạn hoàn thành.');
    setSubmitting(true);
    try {
      await api.post('/api/work-schedule/tasks', {
        title: title.trim(),
        description: description.trim(),
        campusId,
        priority,
        assigneePerId: assignee.perId,
        dueAt: new Date(dueAt).toISOString()
      });
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch (e: any) {
      setCreateError(e.message || 'Giao việc thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Giao việc"
        subtitle="Công việc được giao, nhận, thực hiện và nghiệm thu"
        icon={<AssignmentIcon />}
        action={
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => setCreateOpen(true)}
            sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700 }}
          >
            Giao việc
          </Button>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          label="Tìm theo tiêu đề"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <PersonPicker label="Người thực hiện (username)" value={personFilter} onChange={setPersonFilter} />
        <TextField
          label="Hạn từ ngày"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Hạn đến ngày"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField select label="Quan hệ" value={relation} onChange={(e) => setRelation(e.target.value as any)} sx={{ minWidth: 180 }}>
          <MenuItem value="MINE">Của tôi</MenuItem>
          <MenuItem value="ASSIGNED_BY_ME">Tôi giao</MenuItem>
          <MenuItem value="ALL">Tất cả</MenuItem>
        </TextField>
        <TextField select label="Cơ sở" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 200 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {STATUS_FILTER_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {TASK_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Công việc</TableCell>
              <TableCell>Cơ sở</TableCell>
              <TableCell>Phụ trách</TableCell>
              <TableCell>Hạn</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có công việc nào.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(t)}>
                <TableCell>{t.title}</TableCell>
                <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                <TableCell>{t.assigneePerId}</TableCell>
                <TableCell>{new Date(t.dueAt).toLocaleString('vi-VN')}</TableCell>
                <TableCell>
                  <TaskStatusChip status={t.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Giao việc mới</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField label="Tiêu đề *" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            <TextField select label="Cơ sở *" value={campusId} onChange={(e) => setCampusId(e.target.value)} fullWidth>
              {CAMPUS_IDS.map((c) => (
                <MenuItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </MenuItem>
              ))}
            </TextField>
            <PersonPicker label="Người được giao *" value={assignee} onChange={setAssignee} />
            <TextField
              label="Hạn hoàn thành *"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }}
              fullWidth
            />
            <TextField select label="Mức ưu tiên" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Mô tả" value={description} onChange={(e) => setDescription(e.target.value)} multiline rows={3} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      <TaskDetailDialog
        task={detail}
        actorPerId={actor?.perId}
        onClose={() => setDetail(null)}
        onChanged={(updated) => {
          setDetail(updated);
          refetch();
        }}
      />
    </Box>
  );
}

export function TaskDetailDialog({
  task,
  actorPerId,
  onClose,
  onChanged
}: {
  task: WorkTask | null;
  actorPerId?: string;
  onClose: () => void;
  onChanged: (t: WorkTask) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reasonOpen, setReasonOpen] = useState<'CANCELLED' | 'RETURNED' | null>(null);
  const [reason, setReason] = useState('');

  if (!task) return null;
  const isAssignee = task.assigneePerId === actorPerId;
  const isCreator = task.createdByPerId === actorPerId;

  const run = async (fn: () => Promise<WorkTask>) => {
    setBusy(true);
    setActionError('');
    try {
      onChanged(await fn());
    } catch (e: any) {
      setActionError(e.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (nextStatus: string, note?: string) =>
    run(() => api.patch<WorkTask>(`/api/work-schedule/tasks/${task.id}/status`, { nextStatus, note }));
  const acceptOrReturn = (nextStatus: 'COMPLETED' | 'RETURNED', note?: string) =>
    run(() => api.post<WorkTask>(`/api/work-schedule/tasks/${task.id}/accept-or-return`, { nextStatus, note }));

  const openReasonDialog = (kind: 'CANCELLED' | 'RETURNED') => {
    setReason('');
    setReasonOpen(kind);
  };
  const submitReason = async () => {
    if (!reason.trim()) return;
    if (reasonOpen === 'RETURNED') await acceptOrReturn('RETURNED', reason.trim());
    else await changeStatus('CANCELLED', reason.trim());
    setReasonOpen(null);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{task.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {actionError && <Alert severity="error">{actionError}</Alert>}
          <TaskStatusChip status={task.status} />
          <Stack spacing={0.5}>
            <Typography variant="body2">Cơ sở: <strong>{CAMPUS_LABEL[task.campusId] || task.campusId}</strong></Typography>
            <Typography variant="body2">Người giao: {task.createdByPerId} — Người thực hiện: {task.assigneePerId}</Typography>
            <Typography variant="body2">Hạn: {new Date(task.dueAt).toLocaleString('vi-VN')}</Typography>
            {task.description && <Typography variant="body2" color="text.secondary">{task.description}</Typography>}
          </Stack>
          {task.status === 'RETURNED' && task.acceptanceNote && <Alert severity="warning">Lý do trả lại: {task.acceptanceNote}</Alert>}
          {task.status === 'CANCELLED' && task.cancellationReason && <Alert severity="info">Lý do hủy: {task.cancellationReason}</Alert>}
          {task.status === 'COMPLETED' && task.acceptanceNote && <Alert severity="success">Ghi chú nghiệm thu: {task.acceptanceNote}</Alert>}

          <AuditTrailPanel entityType="task" entityId={task.id} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {task.status === 'ASSIGNED' && isAssignee && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('ACCEPTED')}>
            Nhận việc
          </Button>
        )}
        {task.status === 'ACCEPTED' && isAssignee && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('IN_PROGRESS')}>
            Bắt đầu
          </Button>
        )}
        {task.status === 'IN_PROGRESS' && isAssignee && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('PENDING_ACCEPTANCE')}>
            Trình nghiệm thu
          </Button>
        )}
        {task.status === 'PENDING_ACCEPTANCE' && isCreator && (
          <>
            <Button variant="contained" color="success" disabled={busy} onClick={() => acceptOrReturn('COMPLETED')}>
              Nghiệm thu
            </Button>
            <Button color="warning" disabled={busy} onClick={() => openReasonDialog('RETURNED')}>
              Trả lại
            </Button>
          </>
        )}
        {task.status === 'RETURNED' && isAssignee && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('IN_PROGRESS')}>
            Tiếp tục thực hiện
          </Button>
        )}
        {(task.status === 'ASSIGNED' || task.status === 'RETURNED') && isCreator && (
          <Button color="error" disabled={busy} onClick={() => openReasonDialog('CANCELLED')}>
            Hủy công việc
          </Button>
        )}
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>

      <Dialog open={!!reasonOpen} onClose={() => setReasonOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{reasonOpen === 'CANCELLED' ? 'Lý do hủy công việc' : 'Lý do trả lại'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Lý do (bắt buộc) *"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            multiline
            rows={3}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReasonOpen(null)}>Hủy</Button>
          <Button variant="contained" onClick={submitReason} disabled={!reason.trim() || busy}>
            Xác nhận
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
