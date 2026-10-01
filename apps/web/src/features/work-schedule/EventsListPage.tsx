import { useMemo, useState } from 'react';
import { CirclePlus, CalendarDays, Download, ArrowUp, ArrowDown, ArrowUpDown, Check, ListFilter, MoreHorizontal, Search } from 'lucide-react';
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
  PRIORITY_LABEL,
  abbreviatePersonLabel
} from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function EventStatusChip({ status }: { status: string }) {
  const c = EVENT_STATUS_COLOR[status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Badge variant="outline" className="font-medium" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}>
      {EVENT_STATUS_LABEL[status] || status}
    </Badge>
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
const ALL_CAMPUS = '__all_campus__';
const ALL_STATUS = '__all_status__';
const SCHOOL_WIDE = 'SCHOOL_WIDE';

type EventSortKey = 'startAt' | 'title' | 'campusId' | 'chair' | 'status';

function MiniStepper({ steps, activeIndex }: { steps: readonly string[]; activeIndex: number }) {
  return (
    <div className="flex items-center">
      {steps.map((s, i) => (
        <div key={s} className="flex flex-1 items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                'grid size-7 place-items-center rounded-full border-2 text-xs font-bold',
                i < activeIndex
                  ? 'border-primary bg-primary text-primary-foreground'
                  : i === activeIndex
                    ? 'border-primary text-primary'
                    : 'border-slate-300 text-slate-400'
              )}
            >
              {i < activeIndex ? <Check className="size-4" /> : i + 1}
            </div>
            <p className={cn('text-center text-xs', i <= activeIndex ? 'font-semibold text-[#0f172a]' : 'text-slate-400')}>
              {EVENT_STATUS_LABEL[s] || s}
            </p>
          </div>
          {i < steps.length - 1 && <div className={cn('mx-1 h-0.5 flex-1', i < activeIndex ? 'bg-primary' : 'bg-slate-200')} />}
        </div>
      ))}
    </div>
  );
}

export default function EventsListPage() {
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonOption | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const eventsActiveFilterCount = [personFilter, fromDate, toDate, campusFilter, statusFilter].filter(Boolean).length;
  const { items, loading, error, refetch } = useEvents({
    campusId: campusFilter || undefined,
    statuses: statusFilter ? [statusFilter] : undefined
  });
  const { actor, hasRole } = useActor();

  // Lọc thêm ở client (tìm theo tên/username người + khoảng ngày) — KHÔNG
  // đụng `useEvents.ts`/route GET /events (server chỉ lọc cơ sở/trạng
  // thái, đủ cho quy mô 1 trường). Tìm theo tên: gõ tiêu đề TRỰC TIẾP,
  // hoặc chọn đúng 1 người qua `PersonPicker` (khớp chủ trì/thành phần).
  // Mặc định ngày mới nhất lên đầu — Sin yêu cầu 2026-09-21.
  const [sortKey, setSortKey] = useState<EventSortKey>('startAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const handleSort = (key: EventSortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filteredItems = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    const filtered = items.filter((ev) => {
      if (text && !ev.title.toLowerCase().includes(text)) return false;
      if (personFilter && ev.chairPerId !== personFilter.perId && !ev.participantPerIds.includes(personFilter.perId)) return false;
      const startMs = new Date(ev.startAt).getTime();
      if (from !== null && startMs < from) return false;
      if (to !== null && startMs > to) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'startAt') cmp = new Date(a.startAt).getTime() - new Date(b.startAt).getTime();
      else if (sortKey === 'title') cmp = a.title.localeCompare(b.title);
      else if (sortKey === 'campusId') cmp = (CAMPUS_LABEL[a.campusId] || a.campusId).localeCompare(CAMPUS_LABEL[b.campusId] || b.campusId);
      else if (sortKey === 'chair') cmp = (a.chairLabel || a.chairPerId).localeCompare(b.chairLabel || b.chairPerId);
      else if (sortKey === 'status') cmp = a.status.localeCompare(b.status);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [items, searchText, personFilter, fromDate, toDate, sortKey, sortDir]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WorkEvent | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // --- form tạo mới ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // `campusId` gộp luôn lựa chọn "Toàn trường" (giá trị sentinel
  // 'SCHOOL_WIDE') thay vì tách riêng ô "Phạm vi" — Sin yêu cầu 2026-09-21
  // gộp 2 ô lại cho gọn: chọn "Toàn trường" ở ngay ô Cơ sở, không cần hỏi
  // riêng "Trong 1 cơ sở / Toàn trường" nữa. Khi gửi lên server vẫn tách
  // lại thành đúng 2 field `campusId` (server bắt buộc 1 trong 3 cơ sở thật
  // ngay cả với lịch toàn trường — dùng MAIN_CAMPUS làm cơ sở tổ chức mặc
  // định) + `scope`.
  const [campusId, setCampusId] = useState('');
  const scope: 'CAMPUS' | 'SCHOOL_WIDE' = campusId === SCHOOL_WIDE ? 'SCHOOL_WIDE' : 'CAMPUS';
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
    // Thành phần tham dự KHÔNG bắt buộc — Mr Tiến phản hồi 2026-09-21: 1
    // lịch công tác có thể chỉ do 1 người chủ trì, không cần thêm ai khác.
    setSubmitting(true);
    try {
      const created = await api.post<WorkEvent>('/api/work-schedule/events', {
        title: title.trim(),
        description: description.trim(),
        // Lịch toàn trường vẫn cần 1 cơ sở tổ chức thật cho server (bắt buộc
        // 1 trong 3 cơ sở, xem work-schedule.schema.ts::VALID_CAMPUS_IDS) —
        // mặc định Điểm trường chính.
        campusId: scope === 'SCHOOL_WIDE' ? 'MAIN_CAMPUS' : campusId,
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
      setToast({
        message: submitForApproval ? `Đã tạo lịch "${title.trim()}" và gửi duyệt.` : `Đã lưu lịch "${title.trim()}" (dự thảo).`,
        severity: 'success'
      });
    } catch (e: any) {
      setCreateError(e.message || 'Tạo lịch thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const SortHeader = ({ sortKeyName, children }: { sortKeyName: EventSortKey; children: React.ReactNode }) => {
    const active = sortKey === sortKeyName;
    const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button type="button" onClick={() => handleSort(sortKeyName)} className="inline-flex items-center gap-1 font-semibold text-slate-600">
        {children}
        <Icon className={cn('size-3.5', active ? 'text-[#0f172a]' : 'text-slate-400')} />
      </button>
    );
  };

  return (
    <>
      <PageHeader
        title="Lịch công tác"
        icon={<CalendarDays />}
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a
                href={`${(env.VITE_API_BASE_URL || '').replace(/\/+$/, '')}/api/work-schedule/calendar.ics${campusFilter ? `?campusId=${campusFilter}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="size-4" />
                Xuất .ics
              </a>
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <CirclePlus className="size-4" />
              Tạo lịch
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="events-search"
            placeholder="Tìm theo tiêu đề"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <ListFilter className="size-4" />
              Bộ lọc
              {eventsActiveFilterCount > 0 && (
                <Badge variant="outline" className="h-5 min-w-5 justify-center bg-secondary px-1 text-[#1d4ed8]">
                  {eventsActiveFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0f172a]">Bộ lọc</p>
              {eventsActiveFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPersonFilter(null);
                    setFromDate('');
                    setToDate('');
                    setCampusFilter('');
                    setStatusFilter('');
                  }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
            <div className="mt-3 flex flex-col gap-3">
              <PersonPicker label="Người tham gia (username)" value={personFilter} onChange={setPersonFilter} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="events-from-date" className="mb-1.5 block">
                    Từ ngày
                  </Label>
                  <Input id="events-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="events-to-date" className="mb-1.5 block">
                    Đến ngày
                  </Label>
                  <Input id="events-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Cơ sở</Label>
                  <Select value={campusFilter || ALL_CAMPUS} onValueChange={(v) => setCampusFilter(v === ALL_CAMPUS ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CAMPUS}>Tất cả</SelectItem>
                      {CAMPUS_IDS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CAMPUS_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Trạng thái</Label>
                  <Select value={statusFilter || ALL_STATUS} onValueChange={(v) => setStatusFilter(v === ALL_STATUS ? '' : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STATUS}>Tất cả</SelectItem>
                      {STATUS_FILTER_OPTIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {EVENT_STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      {toast && (
        <Alert className={cn('mb-4', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <Table>
          <TableHeader>
            <TableRow>
              {/* Cột ngày/giờ đưa lên ĐẦU bảng — Sin yêu cầu 2026-09-21. */}
              <TableHead>
                <SortHeader sortKeyName="startAt">Thời gian</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="title">Tiêu đề</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="campusId">Cơ sở</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="chair">Chủ trì</SortHeader>
              </TableHead>
              <TableHead>Thành phần</TableHead>
              <TableHead>
                <SortHeader sortKeyName="status">Trạng thái</SortHeader>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                  Không có lịch nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((ev) => {
              const fullParticipants = ev.participantLabels && ev.participantLabels.length > 0 ? ev.participantLabels : ev.participantPerIds;
              const participantFull = ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : fullParticipants.join(', ') || '—';
              // Bảng danh sách hiện tên VIẾT TẮT ("Bùi Thị Cúc" -> "Cúc BT")
              // cho gọn — bấm vào dòng mở dialog chi tiết mới thấy tên đầy đủ
              // + chức vụ (Sin yêu cầu 2026-09-21, áp dụng mọi bảng trong
              // module Lịch công tác, không riêng bảng này).
              const participantText = ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : fullParticipants.map(abbreviatePersonLabel).join(', ') || '—';
              return (
                <TableRow key={ev.id} className="cursor-pointer" onClick={() => setDetail(ev)}>
                  <TableCell>{new Date(ev.startAt).toLocaleString('vi-VN')}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar size="sm" className="shrink-0 bg-slate-100">
                        <AvatarFallback className="bg-slate-100 text-slate-500">
                          <CalendarDays className="size-3.5" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{ev.title}</span>
                    </div>
                  </TableCell>
                  {/* Bỏ cột "Phạm vi" riêng — Sin yêu cầu 2026-09-21 gộp vào
                      thẳng cột Cơ sở (khớp việc đã gộp ô "Phạm vi" vào ô "Cơ
                      sở" khi tạo/sửa lịch): lịch toàn trường hiện "Toàn
                      trường" ở đây thay vì vẫn hiện "Điểm trường chính" (cơ sở
                      tổ chức mặc định phía server) kèm cột Phạm vi thừa. */}
                  <TableCell>{ev.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[ev.campusId] || ev.campusId}</TableCell>
                  <TableCell className="max-w-40 truncate" title={ev.chairLabel || ev.chairPerId}>
                    {abbreviatePersonLabel(ev.chairLabel || ev.chairPerId)}
                  </TableCell>
                  <TableCell className="max-w-55 truncate" title={participantFull}>
                    {participantText}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EventStatusChip status={ev.status} />
                      {ev.conflictNote && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="border-transparent bg-red-50 text-red-600">
                              Trùng lịch
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{ev.conflictNote}</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetail(ev)}>Xem chi tiết</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Dialog tạo mới */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tạo lịch công tác</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {createError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{createError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="create-event-title" className="mb-1.5 block">
                Tiêu đề *
              </Label>
              <Input id="create-event-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block">Cơ sở *</Label>
              <Select value={campusId} onValueChange={setCampusId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Chọn cơ sở" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPUS_IDS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CAMPUS_LABEL[c]}
                    </SelectItem>
                  ))}
                  <SelectItem value={SCHOOL_WIDE}>Toàn trường (cần duyệt 2 bước: Hiệu phó rồi Hiệu trưởng)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <Label htmlFor="create-event-start" className="mb-1.5 block">
                  Bắt đầu *
                </Label>
                <Input id="create-event-start" type="datetime-local" value={startAt} onChange={(e) => handleStartAtChange(e.target.value)} />
              </div>
              <div className="flex-1">
                <Label htmlFor="create-event-end" className="mb-1.5 block">
                  Kết thúc *
                </Label>
                <Input id="create-event-end" type="datetime-local" value={endAt} min={startAt || undefined} onChange={(e) => setEndAt(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="create-event-location" className="mb-1.5 block">
                Địa điểm
              </Label>
              <Input id="create-event-location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            {scope === 'CAMPUS' && <PeopleMultiPicker label="Thành phần tham dự (tuỳ chọn)" value={participants} onChange={setParticipants} />}
            <div>
              <Label className="mb-1.5 block">Mức ưu tiên</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-event-desc" className="mb-1.5 block">
                Nội dung
              </Label>
              <Textarea id="create-event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <label className="flex items-center gap-2">
              <Checkbox checked={submitForApproval} onCheckedChange={(v) => setSubmitForApproval(v === true)} />
              <span className="text-sm">Trình lãnh đạo phê duyệt ngay sau khi lưu</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog chi tiết */}
      <EventDetailDialog
        event={detail}
        actorPerId={actor?.perId}
        canApprove={detail ? canApproveClientSide(actor?.roles || [], detail) : false}
        isPrincipal={hasRole('R.PRINCIPAL')}
        onClose={() => setDetail(null)}
        onChanged={(updated) => {
          // Merge (không thay hẳn) — response của đổi trạng thái/duyệt KHÔNG
          // kèm chairLabel/participantLabels (chủ trì/thành phần không đổi ở
          // các thao tác này), giữ lại nhãn cũ để không rơi về mã PER_xxx thô
          // ngay sau khi bấm nút, chờ `refetch()` bên dưới nạp lại đầy đủ.
          setDetail((prev) => (prev ? { ...prev, ...updated } : updated));
          refetch();
        }}
        onSuccess={(message) => setToast({ message, severity: 'success' })}
      />
    </>
  );
}

const EVENT_ACTION_SUCCESS_MESSAGE: Record<string, string> = {
  PENDING_APPROVAL: 'Đã gửi lịch đi duyệt.',
  DRAFT: 'Đã thu hồi lịch về dự thảo.',
  REVISION_REQUIRED: 'Đã yêu cầu sửa lại lịch.',
  CANCELLED: 'Đã hủy lịch.'
};

export function EventDetailDialog({
  event,
  actorPerId,
  canApprove,
  isPrincipal,
  onClose,
  onChanged,
  onSuccess
}: {
  event: WorkEvent | null;
  actorPerId?: string;
  canApprove: boolean;
  isPrincipal: boolean;
  onClose: () => void;
  onChanged: (e: WorkEvent) => void;
  onSuccess?: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [reasonOpen, setReasonOpen] = useState<'REVISION_REQUIRED' | 'CANCELLED' | null>(null);
  const [reason, setReason] = useState('');
  // Đếm số lần thao tác thành công — truyền vào AuditTrailPanel làm
  // refreshKey để buộc tải lại "Lịch sử" ngay trong phiên mở dialog hiện
  // tại (xem chú thích trong AuditTrailPanel.tsx).
  const [historyVersion, setHistoryVersion] = useState(0);

  // --- form "Chỉnh sửa" (chỉ DRAFT/REVISION_REQUIRED, đúng người tạo) —
  // bản gốc (App_lich_cong_tac_giao_viec) có nút này, bản port trước đây bỏ
  // sót dù backend (updateRevisionEvent) đã có sẵn từ trước (Sin phát hiện
  // 2026-09-21, đối chiếu bản gốc theo note Mr Tiến). Khai báo state TRƯỚC
  // early-return bên dưới — hook không được gọi có điều kiện.
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCampusId, setEditCampusId] = useState('');
  const [editPriority, setEditPriority] = useState('NORMAL');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editParticipants, setEditParticipants] = useState<PersonOption[]>([]);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  if (!event) return null;
  const isCreator = event.createdByPerId === actorPerId;
  const activeStep = EVENT_STATUS_STEPS.indexOf(event.status as (typeof EVENT_STATUS_STEPS)[number]);
  const isException = event.status === 'REVISION_REQUIRED' || event.status === 'CANCELLED';

  const run = async (fn: () => Promise<WorkEvent>, successMessage?: string) => {
    setBusy(true);
    setActionError('');
    try {
      const updated = await fn();
      onChanged(updated);
      setHistoryVersion((v) => v + 1);
      if (successMessage) onSuccess?.(successMessage);
    } catch (e: any) {
      // Lỗi trỏ rõ vào đúng dialog đang thao tác (actionError ở trên,
      // không phải banner lỗi chung của trang) — Sin phản hồi 21/09/2026:
      // "lỗi gì nó ko trỏ lên chỗ lỗi làm chả phân biệt được gì".
      setActionError(e.message || 'Thao tác thất bại — không rõ nguyên nhân, thử lại hoặc báo quản trị viên.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (nextStatus: string, note?: string) =>
    run(() => api.patch<WorkEvent>(`/api/work-schedule/events/${event.id}/status`, { nextStatus, note }), EVENT_ACTION_SUCCESS_MESSAGE[nextStatus]);

  const approve = () => run(() => api.post<WorkEvent>(`/api/work-schedule/events/${event.id}/approve`), 'Đã duyệt lịch.');

  const openReasonDialog = (kind: 'REVISION_REQUIRED' | 'CANCELLED') => {
    setReason('');
    setReasonOpen(kind);
  };
  const submitReason = async () => {
    if (!reason.trim()) return;
    await changeStatus(reasonOpen!, reason.trim());
    setReasonOpen(null);
  };

  const openEdit = () => {
    setEditTitle(event.title);
    setEditDescription(event.description || '');
    setEditCampusId(event.scope === 'SCHOOL_WIDE' ? SCHOOL_WIDE : event.campusId);
    setEditPriority(event.priority);
    setEditStartAt(toLocalInput(new Date(event.startAt)));
    setEditEndAt(toLocalInput(new Date(event.endAt)));
    setEditLocation(event.location || '');
    // Tự dựng lại PersonOption từ nhãn đã có sẵn (chairLabel/participantLabels)
    // — không cần gọi lại API tìm người, chỉ cần đủ {perId, name} để
    // PeopleMultiPicker hiện đúng lựa chọn đang có sẵn.
    setEditParticipants(
      event.participantPerIds.map((pid, i) => ({
        perId: pid,
        name: event.participantLabels?.[i] || pid
      }))
    );
    setEditError('');
    setEditOpen(true);
  };

  const editScope: 'CAMPUS' | 'SCHOOL_WIDE' = editCampusId === SCHOOL_WIDE ? 'SCHOOL_WIDE' : 'CAMPUS';

  const saveEdit = async () => {
    setEditError('');
    if (!editTitle.trim()) return setEditError('Vui lòng nhập tiêu đề.');
    if (!editCampusId) return setEditError('Vui lòng chọn cơ sở.');
    if (!editStartAt || !editEndAt) return setEditError('Vui lòng chọn thời gian bắt đầu/kết thúc.');
    setEditSubmitting(true);
    try {
      const updated = await api.patch<WorkEvent>(`/api/work-schedule/events/${event.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        campusId: editScope === 'SCHOOL_WIDE' ? 'MAIN_CAMPUS' : editCampusId,
        scope: editScope,
        priority: editPriority,
        startAt: new Date(editStartAt).toISOString(),
        endAt: new Date(editEndAt).toISOString(),
        location: editLocation.trim(),
        participantPerIds: editScope === 'SCHOOL_WIDE' ? [] : editParticipants.map((p) => p.perId)
      });
      onChanged(updated);
      setHistoryVersion((v) => v + 1);
      setEditOpen(false);
      onSuccess?.('Đã lưu nội dung lịch cần sửa.');
    } catch (e: any) {
      setEditError(e.message || 'Lưu lịch thất bại — không rõ nguyên nhân, thử lại hoặc báo quản trị viên.');
    } finally {
      setEditSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {actionError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{actionError}</AlertDescription>
            </Alert>
          )}

          {!isException ? (
            <MiniStepper steps={EVENT_STATUS_STEPS} activeIndex={Math.max(activeStep, 0)} />
          ) : (
            <EventStatusChip status={event.status} />
          )}

          {/* Luôn hiện đủ tên trường dù dữ liệu trống (— thay vì ẩn hẳn dòng)
              — Mr Tiến phản hồi 2026-09-21: trước đây thiếu dữ liệu thì mất
              luôn cả nhãn trường, không phân biệt được "trống thật" với
              "chưa tải xong". */}
          <div className="flex flex-col gap-1">
            <p className="text-sm">
              Cơ sở: <strong>{event.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[event.campusId] || event.campusId}</strong>
            </p>
            <p className="text-sm">
              Thời gian: {new Date(event.startAt).toLocaleString('vi-VN')} → {new Date(event.endAt).toLocaleString('vi-VN')}
            </p>
            <p className="text-sm">Địa điểm: {event.location || '—'}</p>
            <p className="text-sm">Chủ trì: {event.chairLabel || event.chairPerId}</p>
            <p className="text-sm">
              Thành phần:{' '}
              {event.participantPerIds.length > 0
                ? (event.participantLabels && event.participantLabels.length > 0 ? event.participantLabels : event.participantPerIds).join(', ')
                : '—'}
            </p>
            <p className="text-sm text-slate-500">Nội dung: {event.description || '—'}</p>
          </div>

          {event.conflictNote && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800">Trùng lịch: {event.conflictNote}</AlertDescription>
            </Alert>
          )}
          {event.status === 'REVISION_REQUIRED' && event.revisionNote && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">Lý do cần sửa lại: {event.revisionNote}</AlertDescription>
            </Alert>
          )}
          {event.status === 'CANCELLED' && event.cancellationNote && (
            <Alert className="border-blue-200 bg-secondary">
              <AlertDescription className="text-blue-800">Lý do hủy: {event.cancellationNote}</AlertDescription>
            </Alert>
          )}
          {event.scope === 'SCHOOL_WIDE' && event.approvals.length > 0 && (
            <Alert className="border-blue-200 bg-secondary">
              <AlertDescription className="text-blue-800">
                Đã duyệt: {event.approvals.map((a) => `${a.role === 'R.VICE_PRINCIPAL' ? 'Hiệu phó' : 'Hiệu trưởng'}`).join(', ')}
              </AlertDescription>
            </Alert>
          )}

          <AuditTrailPanel entityType="event" entityId={event.id} refreshKey={historyVersion} />
        </div>
        <DialogFooter className="flex-wrap gap-1.5 sm:justify-start">
          {event.status === 'DRAFT' && isCreator && (
            <>
              <Button variant="ghost" disabled={busy} onClick={openEdit}>
                Chỉnh sửa
              </Button>
              <Button disabled={busy} onClick={() => changeStatus('PENDING_APPROVAL')}>
                Gửi lãnh đạo duyệt
              </Button>
            </>
          )}
          {event.status === 'REVISION_REQUIRED' && isCreator && (
            <>
              <Button variant="ghost" disabled={busy} onClick={openEdit}>
                Chỉnh sửa
              </Button>
              <Button disabled={busy} onClick={() => changeStatus('PENDING_APPROVAL')}>
                Gửi duyệt lại
              </Button>
            </>
          )}
          {event.status === 'PENDING_APPROVAL' && isCreator && (
            <Button variant="ghost" disabled={busy} onClick={() => changeStatus('DRAFT')}>
              Thu hồi về dự thảo
            </Button>
          )}
          {event.status === 'PENDING_APPROVAL' && canApprove && (
            <>
              <Button disabled={busy} onClick={approve} className="bg-green-600 hover:bg-green-700">
                Duyệt
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('REVISION_REQUIRED')} className="text-amber-700">
                Yêu cầu sửa lại
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('CANCELLED')} className="text-red-600">
                Hủy
              </Button>
            </>
          )}
          {event.status === 'PUBLISHED' && (canApprove || isPrincipal) && (
            <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('CANCELLED')} className="text-red-600">
              Hủy lịch công tác
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="ml-auto text-slate-500">
            Đóng
          </Button>
        </DialogFooter>

        <Dialog open={!!reasonOpen} onOpenChange={(v) => !v && setReasonOpen(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{reasonOpen === 'CANCELLED' ? 'Lý do hủy lịch' : 'Lý do yêu cầu sửa lại'}</DialogTitle>
            </DialogHeader>
            <div>
              <Label htmlFor="event-reason" className="mb-1.5 block">
                Lý do (bắt buộc) *
              </Label>
              <Textarea id="event-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReasonOpen(null)}>
                Hủy
              </Button>
              <Button onClick={submitReason} disabled={!reason.trim() || busy}>
                Xác nhận
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Chỉnh sửa lịch công tác</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              {editError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{editError}</AlertDescription>
                </Alert>
              )}
              <div>
                <Label htmlFor="edit-event-title" className="mb-1.5 block">
                  Tiêu đề *
                </Label>
                <Input id="edit-event-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Cơ sở *</Label>
                <Select value={editCampusId} onValueChange={setEditCampusId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Chọn cơ sở" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPUS_IDS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CAMPUS_LABEL[c]}
                      </SelectItem>
                    ))}
                    <SelectItem value={SCHOOL_WIDE}>Toàn trường (cần duyệt 2 bước: Hiệu phó rồi Hiệu trưởng)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <Label htmlFor="edit-event-start" className="mb-1.5 block">
                    Bắt đầu *
                  </Label>
                  <Input id="edit-event-start" type="datetime-local" value={editStartAt} onChange={(e) => setEditStartAt(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label htmlFor="edit-event-end" className="mb-1.5 block">
                    Kết thúc *
                  </Label>
                  <Input
                    id="edit-event-end"
                    type="datetime-local"
                    value={editEndAt}
                    min={editStartAt || undefined}
                    onChange={(e) => setEditEndAt(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="edit-event-location" className="mb-1.5 block">
                  Địa điểm
                </Label>
                <Input id="edit-event-location" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
              </div>
              {editScope === 'CAMPUS' && (
                <PeopleMultiPicker label="Thành phần tham dự (tuỳ chọn)" value={editParticipants} onChange={setEditParticipants} />
              )}
              <div>
                <Label className="mb-1.5 block">Mức ưu tiên</Label>
                <Select value={editPriority} onValueChange={setEditPriority}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_LABEL).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-event-desc" className="mb-1.5 block">
                  Nội dung
                </Label>
                <Textarea id="edit-event-desc" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditOpen(false)}>
                Hủy
              </Button>
              <Button onClick={saveEdit} disabled={editSubmitting}>
                Lưu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
