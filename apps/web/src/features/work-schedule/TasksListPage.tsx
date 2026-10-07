import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CirclePlus, ClipboardList, FileUp, ArrowUp, ArrowDown, ArrowUpDown, BookmarkPlus, Check, ListFilter, MoreHorizontal, Search, X } from 'lucide-react';
import { api } from '../../services/api';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { PersonPicker, type PersonOption } from '../safety/PersonPicker';
import { AuditTrailPanel } from './AuditTrailPanel';
import { DetailSection } from './EventsListPage';
import { CAMPUS_IDS, CAMPUS_LABEL, TASK_STATUS_LABEL, TASK_STATUS_COLOR, abbreviatePersonLabel, formatScheduleDateTime } from './constants';
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
import { Toast } from '@/components/Toast';
import { WorkScheduleImportDialog } from './components/WorkScheduleImportDialogV4';

export function TaskStatusChip({ status }: { status: string }) {
  const c = TASK_STATUS_COLOR[status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Badge variant="outline" className="font-medium" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}>
      {TASK_STATUS_LABEL[status] || status}
    </Badge>
  );
}

const STATUS_FILTER_OPTIONS = ['ASSIGNED', 'COMPLETED'];
const ALL_CAMPUS = '__all_campus__';
const ALL_STATUS = '__all_status__';

type TaskSortKey = 'createdAt' | 'dueAt' | 'title' | 'campusId' | 'assignee' | 'status';

interface TasksSavedFilterState {
  campusFilter: string;
  statusFilter: string;
  searchText: string;
  personFilter: PersonOption | null;
  fromDate: string;
  toDate: string;
}

interface TasksSavedFilterRow {
  id: string;
  name: string;
  filterJson: TasksSavedFilterState;
}

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
  const tasksActiveFilterCount = [personFilter, fromDate, toDate, campusFilter, statusFilter].filter(Boolean).length;

  const [savedFilters, setSavedFilters] = useState<TasksSavedFilterRow[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');

  useEffect(() => {
    api
      .get<TasksSavedFilterRow[]>('/api/safety/saved-filters?kind=work_schedule_tasks')
      .then(setSavedFilters)
      .catch(() => setSavedFilters([]));
  }, []);

  const applySavedFilter = (row: TasksSavedFilterRow) => {
    const f = row.filterJson;
    setCampusFilter(f.campusFilter || '');
    setStatusFilter(f.statusFilter || '');
    setSearchText(f.searchText || '');
    setPersonFilter(f.personFilter || null);
    setFromDate(f.fromDate || '');
    setToDate(f.toDate || '');
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return;
    const filterJson: TasksSavedFilterState = { campusFilter, statusFilter, searchText, personFilter, fromDate, toDate };
    try {
      const row = await api.post<TasksSavedFilterRow>('/api/safety/saved-filters', {
        name: saveFilterName.trim(),
        filterJson,
        kind: 'work_schedule_tasks'
      });
      setSavedFilters((prev) => [row, ...prev]);
      setSaveDialogOpen(false);
      setSaveFilterName('');
    } catch {
      // Bộ lọc đang áp dụng vẫn còn nguyên — người dùng thấy ngay nếu bấm
      // Lưu không phản hồi gì.
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

  // --- Chọn nhiều dòng để chấp nhận công việc hàng loạt ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allOnPageSelected = filteredItems.length > 0 && filteredItems.every((t) => selectedIds.has(t.id));
  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const t of filteredItems) {
        if (checked) next.add(t.id);
        else next.delete(t.id);
      }
      return next;
    });
  };
  // 2026-10-05 — chỉ còn 2 trạng thái, "chấp nhận" không còn ý nghĩa riêng
  // nữa (việc luôn khởi tạo ASSIGNED). Nút hàng loạt đổi thành đánh dấu
  // hoàn thành, chỉ áp dụng được cho việc actor là chủ trì (server tự
  // chặn phần còn lại, ở đây chỉ cần gộp kết quả).
  const handleBulkComplete = async () => {
    setBulkAccepting(true);
    let okCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await api.patch(`/api/work-schedule/tasks/${id}/status`, { nextStatus: 'COMPLETED' });
        okCount++;
      } catch {
        // tiếp tục xử lý các việc còn lại, báo tổng kết sau
      }
    }
    setBulkAccepting(false);
    setSelectedIds(new Set());
    setToast({
      message: okCount === ids.length ? `Đã hoàn thành ${okCount} công việc.` : `Đã hoàn thành ${okCount}/${ids.length} công việc (một số việc không thể cập nhật).`,
      severity: okCount > 0 ? 'success' : 'error'
    });
    refetch();
  };

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<WorkTask | null>(null);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campusId, setCampusId] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [assignee, setAssignee] = useState<PersonOption | null>(null);
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCampusId('');
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

  const SortHeader = ({ sortKeyName, children }: { sortKeyName: TaskSortKey; children: React.ReactNode }) => {
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
      <div className="mb-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setImportOpen(true)}><FileUp className="size-4" />Import</Button><Button onClick={() => setCreateOpen(true)}><CirclePlus className="size-4" />Giao việc</Button></div>

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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5">
          {([
            ['MINE', 'Của tôi'],
            ['ASSIGNED_BY_ME', 'Tôi giao'],
            ['ALL', 'Tất cả']
          ] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setRelation(v)}
              className={cn(
                'rounded-[5px] px-3 py-1.5 text-sm font-medium transition-colors',
                relation === v ? 'bg-white text-[#0f172a] shadow-sm' : 'text-slate-500 hover:text-[#0f172a]'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedIds.size > 0 && (
          <>
            <span className="text-sm font-medium text-slate-600">Đã chọn {selectedIds.size}</span>
            <Button variant="outline" size="sm" disabled={bulkAccepting} onClick={handleBulkComplete}>
              <Check className="size-4" />
              Đánh dấu hoàn thành
            </Button>
            {selectedIds.size === 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const only = filteredItems.find((t) => selectedIds.has(t.id));
                  if (only) setDetail(only);
                }}
              >
                Xem chi tiết
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Bỏ chọn
            </Button>
          </>
        )}

        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="tasks-search"
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
              {tasksActiveFilterCount > 0 && (
                <Badge variant="outline" className="h-5 min-w-5 justify-center bg-secondary px-1 text-[#1d4ed8]">
                  {tasksActiveFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0f172a]">Bộ lọc</p>
              {tasksActiveFilterCount > 0 && (
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
              <PersonPicker label="Người thực hiện (username)" value={personFilter} onChange={setPersonFilter} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="tasks-from-date" className="mb-1.5 block">
                    Hạn từ ngày
                  </Label>
                  <Input id="tasks-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="tasks-to-date" className="mb-1.5 block">
                    Hạn đến ngày
                  </Label>
                  <Input id="tasks-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
                          {TASK_STATUS_LABEL[s]}
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

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={allOnPageSelected} onCheckedChange={(v) => toggleSelectAllOnPage(Boolean(v))} aria-label="Chọn tất cả" />
              </TableHead>
              {/* Cột ngày đưa lên ĐẦU bảng — Sin yêu cầu 2026-09-21 (giữ cả
                  Ngày giao lẫn Hạn, đúng thứ tự đã thêm trước đó). */}
              <TableHead>
                <SortHeader sortKeyName="createdAt">Ngày giao</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="dueAt">Hạn</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="title">Công việc</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="campusId">Cơ sở</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="assignee">Phụ trách</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="status">Trạng thái</SortHeader>
              </TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && filteredItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-slate-500">
                  Không có công việc nào.
                </TableCell>
              </TableRow>
            )}
            {filteredItems.map((t) => (
              <TableRow key={t.id} className="cursor-pointer" onClick={() => setDetail(t)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selectedIds.has(t.id)} onCheckedChange={(v) => toggleSelectOne(t.id, Boolean(v))} aria-label={`Chọn ${t.title}`} />
                </TableCell>
                <TableCell>{formatScheduleDateTime(t.createdAt)}</TableCell>
                <TableCell>{formatScheduleDateTime(t.dueAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm" className="shrink-0 bg-slate-100">
                      <AvatarFallback className="bg-slate-100 text-slate-500">
                        <ClipboardList className="size-3.5" />
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{t.title}</span>
                  </div>
                </TableCell>
                <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                <TableCell title={t.assigneeLabel || t.assigneeName || t.assigneePerId}>
                  {abbreviatePersonLabel(t.assigneeLabel || t.assigneeName || t.assigneePerId)}
                </TableCell>
                <TableCell>
                  <TaskStatusChip status={t.status} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setDetail(t)}>Xem chi tiết</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Giao việc mới</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {createError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{createError}</AlertDescription>
              </Alert>
            )}
            <div>
              <Label htmlFor="create-task-title" className="mb-1.5 block">
                Tiêu đề *
              </Label>
              <Input id="create-task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
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
                </SelectContent>
              </Select>
            </div>
            <PersonPicker label="Người được giao *" value={assignee} onChange={setAssignee} />
            <div>
              <Label htmlFor="create-task-due" className="mb-1.5 block">
                Hạn hoàn thành *
              </Label>
              <Input id="create-task-due" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="create-task-desc" className="mb-1.5 block">
                Mô tả
              </Label>
              <Textarea id="create-task-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
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

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lưu bộ lọc hiện tại</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="tasks-save-filter-name" className="mb-1.5 block">
              Tên bộ lọc
            </Label>
            <Input
              id="tasks-save-filter-name"
              autoFocus
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="VD: Việc của tổ Toán"
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
      <WorkScheduleImportDialog open={importOpen} kind="tasks" onClose={() => setImportOpen(false)} onImported={refetch} onToast={(message, severity) => setToast({ message, severity })} />
    </>
  );
}

// 2026-10-05 (huong_dan_lich_cong_tac_giao_viec.md §12.4/§13) — chỉ còn 2
// trạng thái, chỉ chủ trì (assignee) được chuyển.
const TASK_ACTION_SUCCESS_MESSAGE: Record<string, string> = {
  ASSIGNED: 'Đã mở lại — về trạng thái Đã giao.',
  COMPLETED: 'Đã đánh dấu hoàn thành.'
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
  // Đếm số lần thao tác thành công — truyền vào AuditTrailPanel làm
  // refreshKey để buộc tải lại "Lịch sử" ngay trong phiên mở dialog hiện
  // tại (xem chú thích trong AuditTrailPanel.tsx).
  const [historyVersion, setHistoryVersion] = useState(0);
  const navigate = useNavigate();

  if (!task) return null;
  const isAssignee = task.assigneePerId === actorPerId;

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

  const changeStatus = (nextStatus: 'ASSIGNED' | 'COMPLETED') =>
    run(() => api.patch<WorkTask>(`/api/work-schedule/tasks/${task.id}/status`, { nextStatus }), TASK_ACTION_SUCCESS_MESSAGE[nextStatus]);

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          {actionError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{actionError}</AlertDescription>
            </Alert>
          )}
          <TaskStatusChip status={task.status} />

          {/* Khớp bố cục nhóm theo thẻ của phiếu chi tiết Lịch công tác
              (EventsListPage.tsx#EventDetailDialog) — Sin yêu cầu
              2026-10-05 dùng chung UX/pattern thay vì 1 khối text dài. */}
          <DetailSection title="Thông tin chung">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <p className="text-sm">
                Cơ sở: <strong>{CAMPUS_LABEL[task.campusId] || task.campusId}</strong>
              </p>
              <p className="text-sm">Ngày giao: {formatScheduleDateTime(task.createdAt)}</p>
              <p className="text-sm">Hạn: {formatScheduleDateTime(task.dueAt)}</p>
            </div>
          </DetailSection>

          <DetailSection title="Người liên quan">
            <div className="flex flex-col gap-1">
              <p className="text-sm">Người giao: {task.createdByLabel || task.createdByName || task.createdByPerId}</p>
              <p className="text-sm">Người thực hiện: {task.assigneeLabel || task.assigneeName || task.assigneePerId}</p>
            </div>
          </DetailSection>

          <DetailSection title="Nội dung">
            <p className="text-sm whitespace-pre-wrap">{task.description || '—'}</p>
          </DetailSection>

          {/* "Lịch công tác gốc" — CHỈ hiện khi việc này được sinh ra từ 1
              lịch công tác (eventId khác null); việc tạo độc lập không có
              mục này, không hiện mã ID thô (Sin yêu cầu 2026-10-05). Bấm
              vào tên điều hướng sang /work-schedule?eventId=... — trang đó
              tự mở đúng phiếu chi tiết (xem EventsListPage.tsx). */}
          {task.eventId && (
            <DetailSection title="Lịch công tác gốc">
              <button
                type="button"
                onClick={() => navigate(`/work-schedule?eventId=${task.eventId}`)}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <CalendarDays className="size-4 shrink-0" />
                {task.eventTitle || 'Xem lịch công tác'}
              </button>
            </DetailSection>
          )}

          <DetailSection title="Lịch sử">
            <AuditTrailPanel entityType="task" entityId={task.id} refreshKey={historyVersion} />
          </DetailSection>
        </div>
        <DialogFooter className="flex-wrap gap-1.5 sm:justify-start">
          {task.status === 'ASSIGNED' && isAssignee && (
            <Button disabled={busy} onClick={() => changeStatus('COMPLETED')} className="bg-green-600 hover:bg-green-700">
              Đánh dấu hoàn thành
            </Button>
          )}
          {task.status === 'COMPLETED' && isAssignee && (
            <Button variant="ghost" disabled={busy} onClick={() => changeStatus('ASSIGNED')} className="text-slate-600">
              Mở lại (đánh dấu nhầm)
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="ml-auto text-slate-500">
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
