import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineRounded';
import EventIcon from '@mui/icons-material/EventRounded';
import FileDownloadIcon from '@mui/icons-material/FileDownloadRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { env } from '../../config/env';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useActor } from './hooks/useActor';
import { PeopleMultiPicker } from './components/PeopleMultiPicker';
import { PersonPicker, type PersonOption } from '../safety/PersonPicker';
import { AuditTrailPanel } from './AuditTrailPanel';
import {
  CAMPUS_IDS,
  CAMPUS_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_STATUS_COLOR,
  EVENT_STATUS_STEPS,
  EVENT_SCOPE_LABEL,
  PRIORITY_LABEL
} from './constants';

function EventStatusChip({ status }: { status: string }) {
  const c = EVENT_STATUS_COLOR[status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Chip
      label={EVENT_STATUS_LABEL[status] || status}
      size="small"
      sx={{ bgcolor: c.bg, color: c.fg, border: `1px solid ${c.border}`, fontWeight: 700, fontSize: '0.75rem', height: 24 }}
    />
  );
}

/** Advisory only (giống hệt cách module An toàn làm) — server luôn kiểm tra lại thật qua work-schedule.authz.ts. */
export function canApproveClientSide(roles: { roleId: string; campusId: string | null; domain: string | null }[], event: WorkEvent): boolean {
  const has = (roleId: string, campusId?: string | null, domain?: string | null) =>
    roles.some((r) => r.roleId === roleId && (!campusId || !r.campusId || r.campusId === campusId) && (!domain || !r.domain || r.domain === domain));
  if (has('R.PRINCIPAL')) return true;
  if (has('R.VICE_PRINCIPAL', event.campusId)) return true;
  if (event.scope === 'SCHOOL_WIDE') return false;
  if (has('R.DEPT_HEAD', event.campusId, event.departmentDomain)) return true;
  return false;
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_FILTER_OPTIONS = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED', 'CANCELLED'];

export default function EventsListPage() {
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonOption | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { items, loading, error, refetch } = useEvents({
    campusId: campusFilter || undefined,
    statuses: statusFilter ? [statusFilter] : undefined
  });
  const { actor, hasRole } = useActor();

  // Lọc thêm ở client (tìm theo tên/username người + khoảng ngày) — KHÔNG
  // đụng `useEvents.ts`/route GET /events (server chỉ lọc cơ sở/trạng
  // thái, đủ cho quy mô 1 trường). Tìm theo tên: gõ tiêu đề TRỰC TIẾP,
  // hoặc chọn đúng 1 người qua `PersonPicker` (khớp chủ trì/thành phần).
  const filteredItems = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    return items.filter((ev) => {
      if (text && !ev.title.toLowerCase().includes(text)) return false;
      if (personFilter && ev.chairPerId !== personFilter.perId && !ev.participantPerIds.includes(personFilter.perId)) return false;
      const startMs = new Date(ev.startAt).getTime();
      if (from !== null && startMs < from) return false;
      if (to !== null && startMs > to) return false;
      return true;
    });
  }, [items, searchText, personFilter, fromDate, toDate]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WorkEvent | null>(null);

  // --- form tạo mới ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campusId, setCampusId] = useState('');
  const [scope, setScope] = useState<'CAMPUS' | 'SCHOOL_WIDE'>('CAMPUS');
  const [priority, setPriority] = useState('NORMAL');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<PersonOption[]>([]);
  const [submitForApproval, setSubmitForApproval] = useState(true);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCampusId('');
    setScope('CAMPUS');
    setPriority('NORMAL');
    setStartAt('');
    setEndAt('');
    setLocation('');
    setParticipants([]);
    setSubmitForApproval(true);
    setCreateError('');
  };

  const handleStartAtChange = (v: string) => {
    setStartAt(v);
    if (v) {
      const d = new Date(v);
      d.setHours(d.getHours() + 2);
      setEndAt(toLocalInput(d));
    }
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!title.trim()) return setCreateError('Vui lòng nhập tiêu đề.');
    if (!campusId) return setCreateError('Vui lòng chọn cơ sở.');
    if (!startAt || !endAt) return setCreateError('Vui lòng chọn thời gian bắt đầu/kết thúc.');
    if (scope === 'CAMPUS' && participants.length === 0) {
      return setCreateError('Vui lòng chọn ít nhất một người tham dự.');
    }
    setSubmitting(true);
    try {
      const created = await api.post<WorkEvent>('/api/work-schedule/events', {
        title: title.trim(),
        description: description.trim(),
        campusId,
        scope,
        priority,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
        location: location.trim(),
        participantPerIds: scope === 'SCHOOL_WIDE' ? [] : participants.map((p) => p.perId)
      });
      if (submitForApproval) {
        await api.patch(`/api/work-schedule/events/${created.id}/status`, { nextStatus: 'PENDING_APPROVAL' });
      }
      setCreateOpen(false);
      resetForm();
      refetch();
    } catch (e: any) {
      setCreateError(e.message || 'Tạo lịch thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Lịch công tác"
        subtitle="Lịch họp/công tác của trường — dự thảo, chờ duyệt, đã ban hành"
        icon={<EventIcon />}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              component="a"
              href={`${(env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/work-schedule/calendar.ics${campusFilter ? `?campusId=${campusFilter}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Xuất .ics
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700 }}
            >
              Tạo lịch
            </Button>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }} useFlexGap flexWrap="wrap">
        <TextField
          label="Tìm theo tiêu đề"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <PersonPicker label="Người tham gia (username)" value={personFilter} onChange={setPersonFilter} />
        <TextField
          label="Từ ngày"
          type="date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField
          label="Đến ngày"
          type="date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 160 }}
        />
        <TextField select label="Cơ sở" value={campusFilter} onChange={(e) => setCampusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {CAMPUS_IDS.map((c) => (
            <MenuItem key={c} value={c}>
              {CAMPUS_LABEL[c]}
            </MenuItem>
          ))}
        </TextField>
        <TextField select label="Trạng thái" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 180 }}>
          <MenuItem value="">Tất cả</MenuItem>
          {STATUS_FILTER_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {EVENT_STATUS_LABEL[s]}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tiêu đề</TableCell>
              <TableCell>Cơ sở</TableCell>
              <TableCell>Phạm vi</TableCell>
              <TableCell>Thời gian</TableCell>
              <TableCell>Trạng thái</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  Không có lịch nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((ev) => (
              <TableRow key={ev.id} hover sx={{ cursor: 'pointer' }} onClick={() => setDetail(ev)}>
                <TableCell>{ev.title}</TableCell>
                <TableCell>{CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                <TableCell>{EVENT_SCOPE_LABEL[ev.scope] || ev.scope}</TableCell>
                <TableCell>{new Date(ev.startAt).toLocaleString('vi-VN')}</TableCell>
                <TableCell>
                  <EventStatusChip status={ev.status} />
                  {ev.conflictNote && (
                    <Tooltip title={ev.conflictNote}>
                      <Chip size="small" label="Trùng lịch" sx={{ ml: 1, bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700 }} />
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog tạo mới */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Tạo lịch công tác</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField label="Tiêu đề *" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth />
            <TextField
              select
              label="Phạm vi *"
              value={scope}
              onChange={(e) => setScope(e.target.value as 'CAMPUS' | 'SCHOOL_WIDE')}
              fullWidth
            >
              <MenuItem value="CAMPUS">Trong 1 cơ sở</MenuItem>
              <MenuItem value="SCHOOL_WIDE">Toàn trường (cần duyệt 2 bước: Hiệu phó rồi Hiệu trưởng)</MenuItem>
            </TextField>
            <TextField select label="Cơ sở *" value={campusId} onChange={(e) => setCampusId(e.target.value)} fullWidth>
              {CAMPUS_IDS.map((c) => (
                <MenuItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Bắt đầu *"
                type="datetime-local"
                value={startAt}
                onChange={(e) => handleStartAtChange(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
              <TextField
                label="Kết thúc *"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: startAt || undefined } }}
                fullWidth
              />
            </Stack>
            <TextField label="Địa điểm" value={location} onChange={(e) => setLocation(e.target.value)} fullWidth />
            {scope === 'CAMPUS' && (
              <PeopleMultiPicker label="Thành phần tham dự *" value={participants} onChange={setParticipants} />
            )}
            <TextField select label="Mức ưu tiên" value={priority} onChange={(e) => setPriority(e.target.value)} fullWidth>
              {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                <MenuItem key={k} value={k}>
                  {v}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Nội dung"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox checked={submitForApproval} onChange={(e) => setSubmitForApproval(e.target.checked)} />}
              label="Trình lãnh đạo phê duyệt ngay sau khi lưu"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={handleCreate} disabled={submitting}>
            Lưu
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog chi tiết */}
      <EventDetailDialog
        event={detail}
        actorPerId={actor?.perId}
        canApprove={detail ? canApproveClientSide(actor?.roles || [], detail) : false}
        isPrincipal={hasRole('R.PRINCIPAL')}
        onClose={() => setDetail(null)}
        onChanged={(updated) => {
          setDetail(updated);
          refetch();
        }}
      />
    </Box>
  );
}

export function EventDetailDialog({
  event,
  actorPerId,
  canApprove,
  isPrincipal,
  onClose,
  onChanged
}: {
  event: WorkEvent | null;
  actorPerId?: string;
  canApprove: boolean;
  isPrincipal: boolean;
  onClose: () => void;
  onChanged: (e: WorkEvent) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reasonOpen, setReasonOpen] = useState<'REVISION_REQUIRED' | 'CANCELLED' | null>(null);
  const [reason, setReason] = useState('');

  if (!event) return null;
  const isCreator = event.createdByPerId === actorPerId;
  const activeStep = EVENT_STATUS_STEPS.indexOf(event.status as (typeof EVENT_STATUS_STEPS)[number]);
  const isException = event.status === 'REVISION_REQUIRED' || event.status === 'CANCELLED';

  const run = async (fn: () => Promise<WorkEvent>) => {
    setBusy(true);
    setActionError('');
    try {
      const updated = await fn();
      onChanged(updated);
    } catch (e: any) {
      setActionError(e.message || 'Thao tác thất bại.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (nextStatus: string, note?: string) =>
    run(() => api.patch<WorkEvent>(`/api/work-schedule/events/${event.id}/status`, { nextStatus, note }));

  const approve = () => run(() => api.post<WorkEvent>(`/api/work-schedule/events/${event.id}/approve`));

  const openReasonDialog = (kind: 'REVISION_REQUIRED' | 'CANCELLED') => {
    setReason('');
    setReasonOpen(kind);
  };
  const submitReason = async () => {
    if (!reason.trim()) return;
    await changeStatus(reasonOpen!, reason.trim());
    setReasonOpen(null);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{event.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {actionError && <Alert severity="error">{actionError}</Alert>}

          {!isException ? (
            <Stepper activeStep={Math.max(activeStep, 0)} alternativeLabel>
              {EVENT_STATUS_STEPS.map((s) => (
                <Step key={s}>
                  <StepLabel>{EVENT_STATUS_LABEL[s]}</StepLabel>
                </Step>
              ))}
            </Stepper>
          ) : (
            <EventStatusChip status={event.status} />
          )}

          <Stack spacing={0.5}>
            <Typography variant="body2">
              Cơ sở: <strong>{CAMPUS_LABEL[event.campusId] || event.campusId}</strong> — Phạm vi:{' '}
              <strong>{EVENT_SCOPE_LABEL[event.scope]}</strong>
            </Typography>
            <Typography variant="body2">
              {new Date(event.startAt).toLocaleString('vi-VN')} → {new Date(event.endAt).toLocaleString('vi-VN')}
            </Typography>
            {event.location && <Typography variant="body2">Địa điểm: {event.location}</Typography>}
            <Typography variant="body2">Chủ trì: {event.chairPerId}</Typography>
            {event.participantPerIds.length > 0 && (
              <Typography variant="body2">Thành phần: {event.participantPerIds.join(', ')}</Typography>
            )}
            {event.description && <Typography variant="body2" color="text.secondary">{event.description}</Typography>}
          </Stack>

          {event.conflictNote && <Alert severity="warning">Trùng lịch: {event.conflictNote}</Alert>}
          {event.status === 'REVISION_REQUIRED' && event.revisionNote && (
            <Alert severity="error">Lý do cần sửa lại: {event.revisionNote}</Alert>
          )}
          {event.status === 'CANCELLED' && event.cancellationNote && (
            <Alert severity="info">Lý do hủy: {event.cancellationNote}</Alert>
          )}
          {event.scope === 'SCHOOL_WIDE' && event.approvals.length > 0 && (
            <Alert severity="info">
              Đã duyệt: {event.approvals.map((a) => `${a.role === 'R.VICE_PRINCIPAL' ? 'Hiệu phó' : 'Hiệu trưởng'}`).join(', ')}
            </Alert>
          )}

          <AuditTrailPanel entityType="event" entityId={event.id} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        {event.status === 'DRAFT' && isCreator && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('PENDING_APPROVAL')}>
            Gửi lãnh đạo duyệt
          </Button>
        )}
        {event.status === 'REVISION_REQUIRED' && isCreator && (
          <Button variant="contained" disabled={busy} onClick={() => changeStatus('PENDING_APPROVAL')}>
            Gửi duyệt lại
          </Button>
        )}
        {event.status === 'PENDING_APPROVAL' && isCreator && (
          <Button disabled={busy} onClick={() => changeStatus('DRAFT')}>
            Thu hồi về dự thảo
          </Button>
        )}
        {event.status === 'PENDING_APPROVAL' && canApprove && (
          <>
            <Button variant="contained" color="success" disabled={busy} onClick={approve}>
              Duyệt
            </Button>
            <Button color="warning" disabled={busy} onClick={() => openReasonDialog('REVISION_REQUIRED')}>
              Yêu cầu sửa lại
            </Button>
            <Button color="error" disabled={busy} onClick={() => openReasonDialog('CANCELLED')}>
              Hủy
            </Button>
          </>
        )}
        {event.status === 'PUBLISHED' && (canApprove || isPrincipal) && (
          <Button color="error" disabled={busy} onClick={() => openReasonDialog('CANCELLED')}>
            Hủy lịch công tác
          </Button>
        )}
        <Button onClick={onClose}>Đóng</Button>
      </DialogActions>

      <Dialog open={!!reasonOpen} onClose={() => setReasonOpen(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {reasonOpen === 'CANCELLED' ? 'Lý do hủy lịch' : 'Lý do yêu cầu sửa lại'}
        </DialogTitle>
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
