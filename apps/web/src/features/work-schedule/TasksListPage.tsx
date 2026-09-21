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
  TableSortLabel,
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
import { CAMPUS_IDS, CAMPUS_LABEL, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PRIORITY_LABEL, abbreviatePersonLabel } from './constants';

export function TaskStatusChip({ status }: { status: string }) {
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

type TaskSortKey = 'createdAt' | 'dueAt' | 'title' | 'campusId' | 'assignee' | 'status';

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
  const [sortKey, setSortKey] = useState<TaskSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (key: TaskSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredItems = useMemo(() => {
    let out = items;
    if (relation === 'ASSIGNED_BY_ME' && actor) out = out.filter((t) => t.createdByPerId === actor.perId);
    const text = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    const filtered = out.filter((t) => {
      if (text && !t.title.toLowerCase().includes(text)) return false;
      if (personFilter && t.assigneePerId !== personFilter.perId && !t.collaboratorPerIds.includes(personFilter.perId)) return false;
      const dueMs = new Date(t.dueAt).getTime();
      if (from !== null && dueMs < from) return false;
      if (to !== null && dueMs > to) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'createdAt') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortKey === 'dueAt') cmp = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'campusId') cmp = (CAMPUS_LABEL[a.campusId] || a.campusId).localeCompare(CAMPUS_LABEL[b.campusId] || b.campusId);
      else if (sortKey === 'assignee') {
        const an = a.assigneeLabel || a.assigneeName || a.assigneePerId;
        const bn = b.assigneeLabel || b.assigneeName || b.assigneePerId;
        cmp = an.localeCompare(bn);
      } else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, relation, actor, searchText, personFilter, fromDate, toDate, sortKey, sortDir]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WorkTask | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

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
      setToast({ message: `Đã giao việc "${title.trim()}" cho ${assignee?.name || 'người được chọn'}.`, severity: 'success' });
    } catch (e: any) {
      setCreateError(e.message || 'Giao việc thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Giao việc"
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
      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2 }}>
          {toast.message}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              {/* Cột ngày đưa lên ĐẦU bảng — Sin yêu cầu 2026-09-21 (giữ cả
                  Ngày giao lẫn Hạn, đúng thứ tự đã thêm trước đó). */}
              <TableCell>
                <TableSortLabel active={sortKey === 'createdAt'} direction={sortKey === 'createdAt' ? sortDir : 'desc'} onClick={() => handleSort('createdAt')}>
                  Ngày giao
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'dueAt'} direction={sortKey === 'dueAt' ? sortDir : 'asc'} onClick={() => handleSort('dueAt')}>
                  Hạn
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'title'} direction={sortKey === 'title' ? sortDir : 'asc'} onClick={() => handleSort('title')}>
                  Công việc
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'campusId'} direction={sortKey === 'campusId' ? sortDir : 'asc'} onClick={() => handleSort('campusId')}>
                  Cơ sở
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'assignee'} direction={sortKey === 'assignee' ? sortDir : 'asc'} onClick={() => handleSort('assignee')}>
                  Phụ trách
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'status'} direction={sortKey === 'status' ? sortDir : 'asc'} onClick={() => handleSort('status')}>
                  Trạng thái
                </TableSortLabel>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có công việc nào.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(t)}>
                <TableCell>{new Date(t.createdAt).toLocaleString('vi-VN')}</TableCell>
                <TableCell>{new Date(t.dueAt).toLocaleString('vi-VN')}</TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                <TableCell title={t.assigneeLabel || t.assigneeName || t.assigneePerId}>
                  {abbreviatePersonLabel(t.assigneeLabel || t.assigneeName || t.assigneePerId)}
                </TableCell>
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
          setDetail((prev) => (prev ? { ...prev, ...updated } : updated));
          refetch();
        }}
        onSuccess={(message) => setToast({ message, severity: 'success' })}
      />
    </>
  );
}

const TASK_ACTION_SUCCESS_MESSAGE: Record<string, string> = {
  ACCEPTED: 'Đã nhận việc.',
  IN_PROGRESS: 'Đã cập nhật: đang thực hiện.',
  PENDING_ACCEPTANCE: 'Đã trình nghiệm thu.',
  CANCELLED: 'Đã hủy công việc.'
};

export function TaskDetailDialog({
  task,
  actorPerId,
  onClose,
  onChanged,
  onSuccess
}: {
  task: WorkTask | null;
  actorPerId?: string;
  onClose: () => void;
  onChanged: (t: WorkTask) => void;
  onSuccess?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reasonOpen, setReasonOpen] = useState<'CANCELLED' | 'RETURNED' | null>(null);
  const [reason, setReason] = useState('');
  // "Trình nghiệm thu" bắt buộc nhập minh chứng (link Sheet/Docs/Drive...)
  // — Mr Tiến phản hồi 2026-09-21: trước đây bấm 1 nút là xong, không có
  // chỗ nào bắt buộc nhập minh chứng trước khi trình nghiệm thu.
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState('');
  // Đếm số lần thao tác thành công — truyền vào AuditTrailPanel làm
  // refreshKey để buộc tải lại "Lịch sử" ngay trong phiên mở dialog hiện
  // tại (xem chú thích trong AuditTrailPanel.tsx).
  const [historyVersion, setHistoryVersion] = useState(0);

  if (!task) return null;
  const isAssignee = task.assigneePerId === actorPerId;
  const isCreator = task.createdByPerId === actorPerId;

  const run = async (fn: () => Promise<WorkTask>, successMessage?: string) => {
    setBusy(true);
    setActionError('');
    try {
      onChanged(await fn());
      setHistoryVersion((v) => v + 1);
      if (successMessage) onSuccess?.(successMessage);
    } catch (e: any) {
      // Lỗi trỏ rõ vào đúng dialog đang thao tác, không phải banner chung
      // của trang (Sin phản hồi 21/09/2026).
      setActionError(e.message || 'Thao tác thất bại — không rõ nguyên nhân, thử lại hoặc báo quản trị viên.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (nextStatus: string, note?: string, evidenceUrlValue?: string) =>
    run(
      () => api.patch<WorkTask>(`/api/work-schedule/tasks/${task.id}/status`, { nextStatus, note, evidenceUrl: evidenceUrlValue }),
      TASK_ACTION_SUCCESS_MESSAGE[nextStatus]
    );
  const acceptOrReturn = (nextStatus: 'COMPLETED' | 'RETURNED', note?: string) =>
    run(
      () => api.post<WorkTask>(`/api/work-schedule/tasks/${task.id}/accept-or-return`, { nextStatus, note }),
      nextStatus === 'COMPLETED' ? 'Đã nghiệm thu công việc.' : 'Đã trả lại công việc.'
    );

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

  const openEvidenceDialog = () => {
    setEvidenceUrl('');
    setEvidenceOpen(true);
  };
  const submitEvidence = async () => {
    if (!evidenceUrl.trim()) return;
    await changeStatus('PENDING_ACCEPTANCE', undefined, evidenceUrl.trim());
    setEvidenceOpen(false);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{task.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {actionError && <Alert severity="error">{actionError}</Alert>}
          <TaskStatusChip status={task.status} />
          {/* Luôn hiện đủ tên trường dù trống (Mr Tiến phản hồi 2026-09-21). */}
          <Stack spacing={0.5}>
            <Typography variant="body2">Cơ sở: <strong>{CAMPUS_LABEL[task.campusId] || task.campusId}</strong></Typography>
            <Typography variant="body2">Người giao: {task.createdByLabel || task.createdByName || task.createdByPerId} — Người thực hiện: {task.assigneeLabel || task.assigneeName || task.assigneePerId}</Typography>
            <Typography variant="body2">Ngày giao: {new Date(task.createdAt).toLocaleString('vi-VN')}</Typography>
            <Typography variant="body2">Hạn: {new Date(task.dueAt).toLocaleString('vi-VN')}</Typography>
            <Typography variant="body2" color="text.secondary">Nội dung: {task.description || '—'}</Typography>
          </Stack>
          {task.status === 'RETURNED' && task.acceptanceNote && <Alert severity="warning">Lý do trả lại: {task.acceptanceNote}</Alert>}
          {task.status === 'CANCELLED' && task.cancellationReason && <Alert severity="info">Lý do hủy: {task.cancellationReason}</Alert>}
          {task.status === 'COMPLETED' && task.acceptanceNote && <Alert severity="success">Ghi chú nghiệm thu: {task.acceptanceNote}</Alert>}

          <AuditTrailPanel entityType="task" entityId={task.id} refreshKey={historyVersion} />
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
          <Button variant="contained" disabled={busy} onClick={openEvidenceDialog}>
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

      <Dialog open={evidenceOpen} onClose={() => setEvidenceOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Trình nghiệm thu</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            label="Link minh chứng (Google Sheet/Docs/Drive...) *"
            placeholder="https://docs.google.com/..."
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
            helperText="Bắt buộc — dán link tài liệu/minh chứng đã hoàn thành để người giao xem trước khi nghiệm thu."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEvidenceOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={submitEvidence} disabled={!evidenceUrl.trim() || busy}>
            Trình nghiệm thu
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
