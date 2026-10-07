import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CirclePlus, Download, FileUp, BookmarkPlus, ListFilter, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import { env } from '../../config/env';
import { useEvents, type WorkEvent } from './hooks/useEvents';
import { useTasks } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { PeopleMultiPicker } from './components/PeopleMultiPicker';
import { WeeklyTableView } from './components/WeeklyTableView';
import { MonthView } from './components/MonthView';
import { AgendaView, DayView } from './components/DayAgendaViews';
import { WorkScheduleImportDialog } from './components/WorkScheduleImportDialogV4';
import { PersonPicker, type PersonOption } from '../safety/PersonPicker';
import { AuditTrailPanel } from './AuditTrailPanel';
import { TaskStatusChip } from './TasksListPage';
import {
  CAMPUS_IDS,
  CAMPUS_LABEL,
  EVENT_STATUS_LABEL,
  EVENT_STATUS_COLOR,
  abbreviatePersonLabel,
  formatScheduleDateTime
} from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Toast } from '@/components/Toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
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

/** UI advisory only; API/service authorization remains authoritative. */
export function canManageSchoolCalendarClientSide(roles: { roleId: string }[]): boolean {
  return roles.some((role) => ['R.PRINCIPAL', 'R.VICE_PRINCIPAL', 'R.OFFICE_ADMIN'].includes(role.roleId));
}

/** Legacy-history helper retained for the archived approval page and reminders. */
export function canApproveClientSide(roles: { roleId: string; campusId: string | null; domain: string | null }[], event: WorkEvent): boolean {
  const has = (roleId: string, campusId?: string | null, domain?: string | null) =>
    roles.some((role) => role.roleId === roleId && (!campusId || !role.campusId || role.campusId === campusId) && (!domain || !role.domain || role.domain === domain));
  if (has('R.PRINCIPAL')) return true;
  if (has('R.VICE_PRINCIPAL', event.campusId)) return true;
  return event.scope !== 'SCHOOL_WIDE' && has('R.DEPT_HEAD', event.campusId, event.departmentDomain);
}

/** Khối nhóm thông tin trong phiếu chi tiết — §9 đặc tả: "các trường thông
 * tin phải được bố trí theo nhóm logic... không để thông tin bị dồn hoặc
 * khó đọc". Viền + nhãn nhóm viết hoa nhỏ, khớp phong cách card gọn của
 * template tham khảo (shadcnuikit.com/dashboard/crm). */
/** Export để TasksListPage.tsx dùng lại Y HỆT khối nhóm này cho phiếu chi
 * tiết Giao việc — tránh viết lặp lại 1 component UI giống hệt (Sin yêu
 * cầu 2026-10-05: "cải thiện phiếu Giao việc dựa trên UX/pattern của phiếu
 * Lịch công tác, tránh duplicate UI nếu có component dùng chung hợp lý"). */
export function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  // 'min-w-0' BẮT BUỘC — DetailSection là flex item trong 1 cột flex cha
  // (flex flex-col), mặc định min-width:auto khiến nó KHÔNG co nhỏ hơn nội
  // dung bên trong (VD bảng "Giao việc"), buộc CẢ DIALOG rộng vượt khung đã
  // đặt (max-w-3xl) khi cửa sổ hẹp — dialog bị dịch lệch khỏi màn hình (Sin
  // phát hiện 2026-10-05, kèm ảnh: nhãn "THÔNG TIN CHUNG" bị cắt chữ đầu).
  // Verify trực tiếp qua DOM: thiếu min-w-0 ở đây thì dialog.scrollWidth >
  // dialog.clientWidth; thêm vào thì hết hẳn — bảng bên trong tự cuộn ngang
  // RIÊNG nó (đã có sẵn `overflow-x-auto` trong Table.tsx) thay vì đẩy cả
  // dialog rộng ra.
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="mb-3 text-xs font-bold tracking-wide text-slate-500 uppercase dark:text-slate-400">{title}</p>
      {children}
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STATUS_FILTER_OPTIONS = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED'];
const ACTIVE_EVENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'REVISION_REQUIRED'];
const ALL_CAMPUS = '__all_campus__';
const ALL_STATUS = '__all_status__';
const SCHOOL_WIDE = 'SCHOOL_WIDE';

interface EventsSavedFilterState {
  campusFilter: string;
  statusFilter: string;
  searchText: string;
  personFilter: PersonOption[];
  fromDate: string;
  toDate: string;
}

interface SavedFilterRow {
  id: string;
  name: string;
  filterJson: EventsSavedFilterState;
}

export default function EventsListPage() {
  const [campusFilter, setCampusFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonOption[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const eventsActiveFilterCount = [personFilter.length > 0, fromDate, toDate, campusFilter, statusFilter].filter(Boolean).length;

  const [savedFilters, setSavedFilters] = useState<SavedFilterRow[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');

  useEffect(() => {
    api
      .get<SavedFilterRow[]>('/api/safety/saved-filters?kind=work_schedule_events')
      .then(setSavedFilters)
      .catch(() => setSavedFilters([]));
  }, []);

  const applySavedFilter = (row: SavedFilterRow) => {
    const f = row.filterJson;
    setCampusFilter(f.campusFilter || '');
    setStatusFilter(f.statusFilter === 'CANCELLED' ? '' : (f.statusFilter || ''));
    setSearchText(f.searchText || '');
    setPersonFilter(Array.isArray(f.personFilter) ? f.personFilter : f.personFilter ? [f.personFilter as unknown as PersonOption] : []);
    setFromDate(f.fromDate || '');
    setToDate(f.toDate || '');
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return;
    const filterJson: EventsSavedFilterState = { campusFilter, statusFilter, searchText, personFilter, fromDate, toDate };
    try {
      const row = await api.post<SavedFilterRow>('/api/safety/saved-filters', {
        name: saveFilterName.trim(),
        filterJson,
        kind: 'work_schedule_events'
      });
      setSavedFilters((prev) => [row, ...prev]);
      setSaveDialogOpen(false);
      setSaveFilterName('');
    } catch {
      // Toast lỗi không cần thiết — vẫn còn bộ lọc đang áp dụng, người
      // dùng thấy ngay nếu bấm Lưu lại không phản hồi gì.
    }
  };

  const handleDeleteSavedFilter = async (id: string) => {
    try {
      await api.delete(`/api/safety/saved-filters/${id}`);
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // Xem ghi chú ở handleSaveFilter.
    }
  };
  const { items, loading, error, refetch } = useEvents({
    campusId: campusFilter || undefined,
    statuses: statusFilter ? [statusFilter] : ACTIVE_EVENT_STATUSES
  });
  const { items: cancelledItems, loading: cancelledLoading, refetch: refetchCancelled } = useEvents({ statuses: ['CANCELLED'] });
  const { actor } = useActor();
  const canManageSchoolCalendar = canManageSchoolCalendarClientSide(actor?.roles || []);

  // Lọc thêm ở client (tìm theo tên/username người + khoảng ngày) — KHÔNG
  // đụng `useEvents.ts`/route GET /events (server chỉ lọc cơ sở/trạng
  // thái, đủ cho quy mô 1 trường). Tìm theo tên: gõ tiêu đề TRỰC TIẾP,
  // hoặc chọn đúng 1 người qua `PersonPicker` (khớp chủ trì/thành phần).
  const filteredItems = useMemo(() => {
    const text = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(fromDate).getTime() : null;
    const to = toDate ? new Date(toDate).getTime() : null;
    const filtered = items.filter((ev) => {
      if (text && !ev.title.toLowerCase().includes(text)) return false;
      if (personFilter.length > 0 && !personFilter.every((person) => ev.chairPerId === person.perId || ev.participantPerIds.includes(person.perId))) return false;
      const startMs = new Date(ev.startAt).getTime();
      if (from !== null && startMs < from) return false;
      if (to !== null && startMs > to) return false;
      return true;
    });
    return [...filtered].sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());
  }, [items, searchText, personFilter, fromDate, toDate]);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<WorkEvent | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [viewMode, setViewMode] = useState<'week' | 'month' | 'day' | 'agenda'>('week');
  const [quickEditEventId, setQuickEditEventId] = useState<string | null>(null);
  const [highlightedEventId, setHighlightedEventId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [cancelledOpen, setCancelledOpen] = useState(false);

  // Mở sẵn phiếu chi tiết đúng lịch được trỏ tới qua `?eventId=...` — dùng
  // khi bấm vào "tên lịch công tác gốc" từ phiếu chi tiết Giao việc
  // (TasksListPage.tsx), Sin yêu cầu 2026-10-05: "bấm vào tên lịch phải mở
  // đúng phiếu lịch công tác nguồn". Chỉ tự mở 1 LẦN mỗi khi danh sách tải
  // xong có khớp id — không tự mở lại nếu người dùng đã tự đóng dialog.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const wantedId = searchParams.get('eventId');
    if (!wantedId || items.length === 0) return;
    const found = items.find((ev) => ev.id === wantedId);
    if (found) {
      setDetail(found);
      const next = new URLSearchParams(searchParams);
      next.delete('eventId');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [location, setLocation] = useState('');
  const [participants, setParticipants] = useState<PersonOption[]>([]);
  const [chair, setChair] = useState<PersonOption | null>(null);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCampusId('');
    setStartAt('');
    setEndAt('');
    setLocation('');
    setParticipants([]);
    setChair(null);
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

  // Bấm "+"/số ngày trong WeekView/MonthView — mở sẵn dialog Tạo lịch với
  // ngày đó + giờ mặc định 08:00 (Sin yêu cầu 2026-10-05: "có thể tạo thẳng
  // trực tiếp... để tạo lịch ngày trong tuần").
  const openCreateOnDate = (date: Date) => {
    resetForm();
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0);
    handleStartAtChange(toLocalInput(d));
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    setCreateError('');
    if (!title.trim()) return setCreateError('Vui lòng nhập tiêu đề.');
    if (!campusId) return setCreateError('Vui lòng chọn cơ sở.');
    if (!startAt) return setCreateError('Vui lòng chọn thời gian bắt đầu.');
    // Thành phần tham dự KHÔNG bắt buộc — Mr Tiến phản hồi 2026-09-21: 1
    // lịch công tác có thể chỉ do 1 người chủ trì, không cần thêm ai khác.
    // Giờ kết thúc cũng KHÔNG bắt buộc (Sin yêu cầu 2026-10-05) — không
    // phải lúc nào cũng biết trước lịch kéo dài bao lâu.
    setSubmitting(true);
    try {
      await api.post<WorkEvent>('/api/work-schedule/events', {
        title: title.trim(),
        description: description.trim(),
        // Lịch toàn trường vẫn cần 1 cơ sở tổ chức thật cho server (bắt buộc
        // 1 trong 3 cơ sở, xem work-schedule.schema.ts::VALID_CAMPUS_IDS) —
        // mặc định Điểm trường chính.
        campusId: scope === 'SCHOOL_WIDE' ? 'MAIN_CAMPUS' : campusId,
        scope,
        startAt: new Date(startAt).toISOString(),
        endAt: endAt ? new Date(endAt).toISOString() : null,
        location: location.trim(),
        chairPerId: chair?.perId || actor?.perId,
        participantPerIds: scope === 'SCHOOL_WIDE' ? [] : participants.map((p) => p.perId)
      });
      setCreateOpen(false);
      resetForm();
      refetch();
      setToast({
        message:
          `Đã tạo lịch "${title.trim()}".`,
        severity: 'success'
      });
    } catch (e: any) {
      setToast({ message: e.message || 'Tạo lịch thất bại.', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          {([['day', 'Ngày'], ['week', 'Tuần'], ['month', 'Tháng'], ['agenda', 'Lịch biểu']] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => setViewMode(v)} className={cn('rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors', viewMode === v ? 'bg-white text-[#0f172a] shadow-sm' : 'text-slate-500 hover:text-[#0f172a]')}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="size-4" />Import</Button>
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
      </div>

      {savedFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {savedFilters.map((f) => (
            <Badge
              key={f.id}
              variant="outline"
              className="cursor-pointer gap-1 border-transparent bg-secondary pr-1 font-semibold text-[#1d4ed8]"
              onClick={() => applySavedFilter(f)}
            >
              {f.name}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSavedFilter(f.id);
                }}
                className="rounded-full hover:bg-blue-200"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div />

        <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => { setCancelledOpen(true); refetchCancelled(); }}>Xem lịch đã hủy</Button>
        <div className="relative w-full min-w-56 sm:w-72">
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
                    setPersonFilter([]);
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
              <PeopleMultiPicker label="Người tham gia" value={personFilter} onChange={setPersonFilter} />
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

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={() => setSaveDialogOpen(true)}>
              <BookmarkPlus className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Lưu bộ lọc hiện tại</TooltipContent>
        </Tooltip>
        </div>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {viewMode === 'week' && <WeeklyTableView events={filteredItems} onSelectEvent={(event) => { setQuickEditEventId(null); setDetail(event); }} onCreateOnDate={openCreateOnDate} highlightedEventId={highlightedEventId} />}
      {viewMode === 'month' && <MonthView events={filteredItems} onSelectEvent={setDetail} onCreateOnDate={openCreateOnDate} />}
      {viewMode === 'day' && <DayView events={filteredItems} onSelectEvent={setDetail} />}
      {viewMode === 'agenda' && <AgendaView events={filteredItems} onSelectEvent={setDetail} />}

      {/* Dialog tạo mới */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-md">
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
                  {canManageSchoolCalendar && <SelectItem value={SCHOOL_WIDE}>Toàn trường</SelectItem>}
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
                  Kết thúc
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
            {canManageSchoolCalendar && <PersonPicker label="Tạo lịch cho (mặc định là tôi)" value={chair} onChange={setChair} />}
            {scope === 'CAMPUS' && <PeopleMultiPicker label="Thành phần tham dự (tuỳ chọn)" value={participants} onChange={setParticipants} />}
            <div>
              <Label htmlFor="create-event-desc" className="mb-1.5 block">
                Nội dung
              </Label>
              <Textarea id="create-event-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {scope === 'SCHOOL_WIDE' && <p className="text-xs text-slate-500">Lịch toàn trường được hiển thị cho mọi người ngay sau khi lưu.</p>}
          </div>
          <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t bg-background px-6 py-4">
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
        editImmediately={!!detail && quickEditEventId === detail.id}
        actorPerId={actor?.perId}
        canManageSchoolCalendar={canManageSchoolCalendar}
        onClose={() => setDetail(null)}
        onChanged={(updated) => {
          // Merge (không thay hẳn) — response của đổi trạng thái/duyệt KHÔNG
          // kèm chairLabel/participantLabels (chủ trì/thành phần không đổi ở
          // các thao tác này), giữ lại nhãn cũ để không rơi về mã PER_xxx thô
          // ngay sau khi bấm nút, chờ `refetch()` bên dưới nạp lại đầy đủ.
          setDetail((prev) => (prev ? { ...prev, ...updated } : updated));
          setHighlightedEventId(updated.id);
          setQuickEditEventId(null);
          setViewMode('week');
          window.setTimeout(() => setHighlightedEventId((current) => current === updated.id ? null : current), 4000);
          refetch();
          refetchCancelled();
        }}
        onSuccess={(message) => setToast({ message, severity: 'success' })}
        onError={(message) => setToast({ message, severity: 'error' })}
      />

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lưu bộ lọc hiện tại</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="events-save-filter-name" className="mb-1.5 block">
              Tên bộ lọc
            </Label>
            <Input
              id="events-save-filter-name"
              autoFocus
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="VD: Lịch của khối 9"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveFilter} disabled={!saveFilterName.trim()}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WorkScheduleImportDialog open={importOpen} kind="events" onClose={() => setImportOpen(false)} onImported={refetch} onToast={(message, severity) => setToast({ message, severity })} />

      <Dialog open={cancelledOpen} onOpenChange={setCancelledOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Lịch đã hủy</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {cancelledLoading && <p className="py-6 text-center text-sm text-slate-500">Đang tải…</p>}
            {!cancelledLoading && cancelledItems.length === 0 && <p className="rounded-lg border border-dashed p-8 text-center text-sm text-slate-500">Không có lịch đã hủy.</p>}
            {cancelledItems.map((event) => <button key={event.id} type="button" onClick={() => { setCancelledOpen(false); setDetail(event); }} className="flex w-full min-w-0 items-center justify-between gap-3 rounded-lg border p-3 text-left hover:border-primary/40"><span className="min-w-0"><span className="block truncate font-medium" title={event.title}>{event.title}</span><span className="block truncate text-xs text-slate-500" title={event.cancellationNote || ''}>{formatScheduleDateTime(event.startAt)} · {event.cancellationNote || 'Không có lý do'}</span></span><span className="shrink-0 text-sm text-primary">Xem chi tiết</span></button>)}
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setCancelledOpen(false)}>Đóng</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const EVENT_ACTION_SUCCESS_MESSAGE: Record<string, string> = {
  PENDING_APPROVAL: 'Đã gửi lịch đi duyệt.',
  DRAFT: 'Đã thu hồi lịch về dự thảo.',
  REVISION_REQUIRED: 'Đã yêu cầu sửa lại lịch.',
  CANCELLED: 'Đã hủy lịch.',
  PUBLISHED: 'Đã khôi phục lịch.'
};

export function EventDetailDialog({
  event,
  editImmediately = false,
  actorPerId,
  canManageSchoolCalendar,
  onClose,
  onChanged,
  onSuccess,
  onError
}: {
  event: WorkEvent | null;
  editImmediately?: boolean;
  actorPerId?: string;
  canManageSchoolCalendar: boolean;
  onClose: () => void;
  onChanged: (e: WorkEvent) => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
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
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editParticipants, setEditParticipants] = useState<PersonOption[]>([]);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // --- "GIAO VIỆC" (§9/§10 đặc tả) — danh sách đầu việc gắn với lịch này +
  // tạo nhanh 1 đầu việc mới ngay trong phiếu chi tiết. Hook gọi KHÔNG điều
  // kiện (quy tắc Hook), chỉ tắt fetch qua `enabled` khi dialog chưa có event.
  const { items: linkedTasks, loading: tasksLoading, refetch: refetchTasks } = useTasks({ eventId: event?.id, enabled: !!event });
  // Tiến độ = số việc nhỏ COMPLETED / tổng số việc nhỏ của lịch này (Sin
  // yêu cầu 2026-10-05: "5 công việc, 3 hoàn thành => 60%", công thức tổng
  // quát completedChildren/totalChildren*100, không hard-code %/việc).
  // Tính trực tiếp từ `linkedTasks` (danh sách việc nhỏ ĐANG hiển thị ngay
  // dưới) thay vì đọc field `taskProgressPercent` backend đã gắn sẵn vào
  // từng event ở `GET /events` (work-schedule.service.ts#attachTaskProgress)
  // — `linkedTasks` luôn mới nhất trong phiên mở dialog (tự refetch sau khi
  // tạo/đổi trạng thái việc nhỏ), còn field trên event là ảnh chụp lúc tải
  // danh sách lịch, có thể cũ nếu vừa thao tác việc nhỏ mà chưa đóng-mở lại
  // dialog.
  const taskCompletedCount = linkedTasks.filter((t) => t.status === 'COMPLETED').length;
  const taskProgressPercent = linkedTasks.length > 0 ? Math.round((taskCompletedCount / linkedTasks.length) * 100) : null;
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<PersonOption | null>(null);
  const [taskDueAt, setTaskDueAt] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskSubmitting, setTaskSubmitting] = useState(false);

  useEffect(() => {
    if (!event || !editImmediately) return;
    setEditTitle(event.title);
    setEditDescription(event.description || '');
    setEditCampusId(event.scope === 'SCHOOL_WIDE' ? SCHOOL_WIDE : event.campusId);
    setEditStartAt(toLocalInput(new Date(event.startAt)));
    setEditEndAt(event.endAt ? toLocalInput(new Date(event.endAt)) : '');
    setEditLocation(event.location || '');
    setEditParticipants(event.participantPerIds.map((perId, index) => ({ perId, name: event.participantLabels?.[index] || perId })));
    setEditError('');
    setEditOpen(true);
  }, [editImmediately, event?.id]);

  if (!event) return null;
  const isCreator = event.createdByPerId === actorPerId;
  const canEdit = event.scope === 'SCHOOL_WIDE'
    ? canManageSchoolCalendar
    : isCreator || event.chairPerId === actorPerId || canManageSchoolCalendar;

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
      const message = e.message || 'Thao tác thất bại — không rõ nguyên nhân, thử lại hoặc báo quản trị viên.';
      setActionError(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = (nextStatus: string, note?: string) =>
    run(() => api.patch<WorkEvent>(`/api/work-schedule/events/${event.id}/status`, { nextStatus, note }), EVENT_ACTION_SUCCESS_MESSAGE[nextStatus]);

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
    setEditStartAt(toLocalInput(new Date(event.startAt)));
    setEditEndAt(event.endAt ? toLocalInput(new Date(event.endAt)) : '');
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
    if (!editStartAt) return setEditError('Vui lòng chọn thời gian bắt đầu.');
    setEditSubmitting(true);
    try {
      const updated = await api.patch<WorkEvent>(`/api/work-schedule/events/${event.id}`, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        campusId: editScope === 'SCHOOL_WIDE' ? 'MAIN_CAMPUS' : editCampusId,
        scope: editScope,
        startAt: new Date(editStartAt).toISOString(),
        endAt: editEndAt ? new Date(editEndAt).toISOString() : null,
        location: editLocation.trim(),
        participantPerIds: editScope === 'SCHOOL_WIDE' ? [] : editParticipants.map((p) => p.perId)
      });
      onChanged(updated);
      setHistoryVersion((v) => v + 1);
      setEditOpen(false);
      onSuccess?.('Đã lưu nội dung lịch cần sửa.');
    } catch (e: any) {
      const message = e.message || 'Lưu lịch thất bại — không rõ nguyên nhân, thử lại hoặc báo quản trị viên.';
      setEditError(message);
      onError?.(message);
    } finally {
      setEditSubmitting(false);
    }
  };

  const openTaskForm = () => {
    setTaskTitle('');
    setTaskAssignee(null);
    setTaskDueAt('');
    setTaskError('');
    setTaskFormOpen(true);
  };
  const submitTask = async () => {
    setTaskError('');
    if (!taskTitle.trim()) return setTaskError('Vui lòng nhập tên việc.');
    if (!taskAssignee) return setTaskError('Vui lòng chọn người chủ trì.');
    if (!taskDueAt) return setTaskError('Vui lòng chọn deadline.');
    setTaskSubmitting(true);
    try {
      await api.post('/api/work-schedule/tasks', {
        eventId: event.id,
        title: taskTitle.trim(),
        campusId: event.campusId,
        assigneePerId: taskAssignee.perId,
        dueAt: new Date(taskDueAt).toISOString()
      });
      setTaskFormOpen(false);
      refetchTasks();
      onSuccess?.(`Đã tạo đầu việc "${taskTitle.trim()}".`);
    } catch (e: any) {
      const message = e.message || 'Tạo đầu việc thất bại.';
      setTaskError(message);
      onError?.(message);
    } finally {
      setTaskSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      {/* §9 đặc tả: "Tăng chiều cao/chiều rộng khu vực phiếu chi tiết...
          bố trí theo nhóm logic". Rộng hơn hẳn bản cũ (max-w-md -> 3xl) +
          cuộn dọc khi nội dung dài (nhiều đầu việc/lịch sử), tránh dồn chữ. */}
      <DialogContent className="max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          {actionError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{actionError}</AlertDescription>
            </Alert>
          )}

          <div><EventStatusChip status={event.status} /></div>

          <DetailSection title="Thông tin chung">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <p className="text-sm">
                Cơ sở: <strong>{event.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[event.campusId] || event.campusId}</strong>
              </p>
              <p className="text-sm">
                Trạng thái: <strong>{EVENT_STATUS_LABEL[event.status] || event.status}</strong>
              </p>
              <p className="text-sm">Bắt đầu: {formatScheduleDateTime(event.startAt)}</p>
              <p className="text-sm">Kết thúc: {formatScheduleDateTime(event.endAt)}</p>
              <p className="text-sm sm:col-span-2">Địa điểm: {event.location || '—'}</p>
            </div>
          </DetailSection>

          <DetailSection title="Người tham gia">
            <div className="flex flex-col gap-1">
              <p className="text-sm">Chủ trì: {event.chairLabel || event.chairPerId}</p>
              <p className="text-sm">
                Thành phần tham dự:{' '}
                {event.participantPerIds.length > 0
                  ? (event.participantLabels && event.participantLabels.length > 0 ? event.participantLabels : event.participantPerIds).join(', ')
                  : '—'}
              </p>
            </div>
          </DetailSection>

          <DetailSection title="Nội dung">
            <div className="flex flex-col gap-2">
              <p className="text-sm whitespace-pre-wrap">{event.description || '—'}</p>
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
            </div>
          </DetailSection>

          <DetailSection title="Giao việc">
            <div className="flex flex-col gap-2">
              {tasksLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
              {!tasksLoading && linkedTasks.length === 0 && <p className="text-sm text-slate-400">Chưa có đầu việc nào.</p>}
              {linkedTasks.length > 0 && (
                <div className="flex items-center gap-3">
                  <Progress value={taskProgressPercent ?? 0} className="h-2 flex-1" />
                  <span className="shrink-0 text-xs font-semibold text-slate-600">
                    {taskCompletedCount}/{linkedTasks.length} hoàn thành ({taskProgressPercent}%)
                  </span>
                </div>
              )}
              {linkedTasks.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tên việc</TableHead>
                      <TableHead>Người chủ trì</TableHead>
                      <TableHead>Deadline</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linkedTasks.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell>{t.assigneeLabel || t.assigneeName || t.assigneePerId}</TableCell>
                        <TableCell>{formatScheduleDateTime(t.dueAt)}</TableCell>
                        <TableCell>
                          <TaskStatusChip status={t.status} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {event.status !== 'CANCELLED' && (!taskFormOpen ? (
                <Button variant="outline" size="sm" className="w-fit" onClick={openTaskForm}>
                  <CirclePlus className="size-4" />
                  Tạo giao việc
                </Button>
              ) : (
                <div className="flex flex-col gap-2 rounded-md border border-dashed border-slate-300 p-3 dark:border-slate-700">
                  {taskError && (
                    <Alert className="border-red-200 bg-red-50">
                      <AlertDescription className="text-red-700">{taskError}</AlertDescription>
                    </Alert>
                  )}
                  <Input placeholder="Tên việc *" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
                  <PersonPicker label="Người chủ trì *" value={taskAssignee} onChange={setTaskAssignee} />
                  <Input type="datetime-local" value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={submitTask} disabled={taskSubmitting}>
                      Lưu
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setTaskFormOpen(false)}>
                      Huỷ
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DetailSection>

          <DetailSection title="Lịch sử">
            <AuditTrailPanel entityType="event" entityId={event.id} refreshKey={historyVersion} />
          </DetailSection>
        </div>
        <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 flex-wrap gap-1.5 border-t bg-background px-6 py-4 sm:justify-start">
          {canEdit && event.status !== 'CANCELLED' && <Button variant="outline" disabled={busy} onClick={openEdit}>Chỉnh sửa</Button>}
          {event.status === 'PUBLISHED' && canEdit && (
            <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('CANCELLED')} className="text-red-600">
              Hủy lịch công tác
            </Button>
          )}
          {event.status === 'CANCELLED' && canEdit && <Button disabled={busy} onClick={() => changeStatus('PUBLISHED')}>Khôi phục lịch</Button>}
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
                Lý do *
              </Label>
              <Textarea id="event-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t bg-background px-6 py-4">
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
          <DialogContent className="max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-md">
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
                    <SelectItem value={SCHOOL_WIDE}>Toàn trường (cần Hiệu trưởng hoặc Hiệu phó Điểm trường chính duyệt)</SelectItem>
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
                    Kết thúc
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
                <Label htmlFor="edit-event-desc" className="mb-1.5 block">
                  Nội dung
                </Label>
                <Textarea id="edit-event-desc" rows={3} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 z-10 -mx-6 -mb-6 border-t bg-background px-6 py-4">
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
