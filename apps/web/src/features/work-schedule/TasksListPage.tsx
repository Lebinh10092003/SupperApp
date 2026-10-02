import { useEffect, useMemo, useState } from 'react';
import { CirclePlus, ClipboardList, ArrowUp, ArrowDown, ArrowUpDown, BookmarkPlus, Check, ListFilter, MoreHorizontal, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useTasks, type WorkTask } from './hooks/useTasks';
import { useActor } from './hooks/useActor';
import { PersonPicker, type PersonOption } from '../safety/PersonPicker';
import { AuditTrailPanel } from './AuditTrailPanel';
import { CAMPUS_IDS, CAMPUS_LABEL, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PRIORITY_LABEL, abbreviatePersonLabel } from './constants';
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
import { cn, formatDateTime } from '@/lib/utils';

export function TaskStatusChip({ status }: { status: string }) {
  const c = TASK_STATUS_COLOR[status] || { bg: '#f1f5f9', fg: '#334155', border: '#e2e8f0' };
  return (
    <Badge variant="outline" className="font-medium" style={{ backgroundColor: c.bg, color: c.fg, borderColor: c.border }}>
      {TASK_STATUS_LABEL[status] || status}
    </Badge>
  );
}

const STATUS_FILTER_OPTIONS = ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PENDING_ACCEPTANCE', 'COMPLETED', 'RETURNED', 'CANCELLED'];
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
  const handleBulkAccept = async () => {
    setBulkAccepting(true);
    let okCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await api.patch(`/api/work-schedule/tasks/${id}/status`, { nextStatus: 'ACCEPTED' });
        okCount++;
      } catch {
        // tiếp tục xử lý các việc còn lại, báo tổng kết sau
      }
    }
    setBulkAccepting(false);
    setSelectedIds(new Set());
    setToast({
      message: okCount === ids.length ? `Đã chấp nhận ${okCount} công việc.` : `Đã chấp nhận ${okCount}/${ids.length} công việc (một số việc không thể chấp nhận).`,
      severity: okCount > 0 ? 'success' : 'error'
    });
    refetch();
  };

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
      <PageHeader
        title="Giao việc"
        icon={<ClipboardList />}
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <CirclePlus className="size-4" />
            Giao việc
          </Button>
        }
      />

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
            <Button variant="outline" size="sm" disabled={bulkAccepting} onClick={handleBulkAccept}>
              <Check className="size-4" />
              Chấp nhận
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
      {toast && (
        <Alert className={cn('mb-4', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}

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
                <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                <TableCell>{formatDateTime(t.dueAt)}</TableCell>
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
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {actionError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{actionError}</AlertDescription>
            </Alert>
          )}
          <TaskStatusChip status={task.status} />
          {/* Luôn hiện đủ tên trường dù trống (Mr Tiến phản hồi 2026-09-21). */}
          <div className="flex flex-col gap-1">
            <p className="text-sm">
              Cơ sở: <strong>{CAMPUS_LABEL[task.campusId] || task.campusId}</strong>
            </p>
            <p className="text-sm">
              Người giao: {task.createdByLabel || task.createdByName || task.createdByPerId} — Người thực hiện:{' '}
              {task.assigneeLabel || task.assigneeName || task.assigneePerId}
            </p>
            <p className="text-sm">Ngày giao: {formatDateTime(task.createdAt)}</p>
            <p className="text-sm">Hạn: {formatDateTime(task.dueAt)}</p>
            <p className="text-sm text-slate-500">Nội dung: {task.description || '—'}</p>
          </div>
          {task.status === 'RETURNED' && task.acceptanceNote && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertDescription className="text-amber-800">Lý do trả lại: {task.acceptanceNote}</AlertDescription>
            </Alert>
          )}
          {task.status === 'CANCELLED' && task.cancellationReason && (
            <Alert className="border-blue-200 bg-secondary">
              <AlertDescription className="text-blue-800">Lý do hủy: {task.cancellationReason}</AlertDescription>
            </Alert>
          )}
          {task.status === 'COMPLETED' && task.acceptanceNote && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-700">Ghi chú nghiệm thu: {task.acceptanceNote}</AlertDescription>
            </Alert>
          )}

          <AuditTrailPanel entityType="task" entityId={task.id} refreshKey={historyVersion} />
        </div>
        <DialogFooter className="flex-wrap gap-1.5 sm:justify-start">
          {task.status === 'ASSIGNED' && isAssignee && (
            <Button disabled={busy} onClick={() => changeStatus('ACCEPTED')}>
              Nhận việc
            </Button>
          )}
          {task.status === 'ACCEPTED' && isAssignee && (
            <Button disabled={busy} onClick={() => changeStatus('IN_PROGRESS')}>
              Bắt đầu
            </Button>
          )}
          {task.status === 'IN_PROGRESS' && isAssignee && (
            <Button disabled={busy} onClick={openEvidenceDialog}>
              Trình nghiệm thu
            </Button>
          )}
          {task.status === 'PENDING_ACCEPTANCE' && isCreator && (
            <>
              <Button disabled={busy} onClick={() => acceptOrReturn('COMPLETED')} className="bg-green-600 hover:bg-green-700">
                Nghiệm thu
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('RETURNED')} className="text-amber-700">
                Trả lại
              </Button>
            </>
          )}
          {task.status === 'RETURNED' && isAssignee && (
            <Button disabled={busy} onClick={() => changeStatus('IN_PROGRESS')}>
              Tiếp tục thực hiện
            </Button>
          )}
          {(task.status === 'ASSIGNED' || task.status === 'RETURNED') && isCreator && (
            <Button variant="ghost" disabled={busy} onClick={() => openReasonDialog('CANCELLED')} className="text-red-600">
              Hủy công việc
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="ml-auto text-slate-500">
            Đóng
          </Button>
        </DialogFooter>

        <Dialog open={!!reasonOpen} onOpenChange={(v) => !v && setReasonOpen(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{reasonOpen === 'CANCELLED' ? 'Lý do hủy công việc' : 'Lý do trả lại'}</DialogTitle>
            </DialogHeader>
            <div>
              <Label htmlFor="task-reason" className="mb-1.5 block">
                Lý do *
              </Label>
              <Textarea id="task-reason" autoFocus rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
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

        <Dialog open={evidenceOpen} onOpenChange={setEvidenceOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Trình nghiệm thu</DialogTitle>
            </DialogHeader>
            <div>
              <Label htmlFor="task-evidence-url" className="mb-1.5 block">
                Link minh chứng (Google Sheet/Docs/Drive...) *
              </Label>
              <Input
                id="task-evidence-url"
                autoFocus
                placeholder="https://docs.google.com/..."
                value={evidenceUrl}
                onChange={(e) => setEvidenceUrl(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-500">
                Bắt buộc — dán link tài liệu/minh chứng đã hoàn thành để người giao xem trước khi nghiệm thu.
              </p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEvidenceOpen(false)}>
                Hủy
              </Button>
              <Button onClick={submitEvidence} disabled={!evidenceUrl.trim() || busy}>
                Trình nghiệm thu
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
