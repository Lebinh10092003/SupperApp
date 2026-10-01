/**
 * CasesListPage.tsx — danh sách SỰ VỤ gộp (2026-09-22, Sin chốt): thay hẳn
 * cho 2 trang cũ "Tin báo chờ xử lý" (PendingReportsPage.tsx, đã xoá) và
 * "Hồ sơ sự cố" (IncidentsListPage.tsx, đã xoá) — từ khi submitReport tự
 * tạo `incidents` row ngay lúc gửi tin (report-flow.ts), không còn khái
 * niệm "tin báo chưa phải hồ sơ" để tách thành 2 danh sách nữa.
 *
 * Sin chốt 2026-09-22: bỏ nút thao tác nhanh (Tiếp nhận/Bàn giao) ngay
 * trên dòng danh sách — cột "Người phụ trách" chỉ còn hiển thị tên/chip
 * "Chưa tiếp nhận", bấm vào cả dòng mới vào trang chi tiết để thao tác.
 * Cột "Nhóm sự cố" cũng chỉ hiện rút gọn (truncate + tooltip), giống cột
 * "Nội dung" — xem chi tiết đầy đủ phải bấm vào dòng.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CirclePlus, ListChecks, BookmarkPlus, ListFilter, Search, MoreHorizontal, X, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useIncidents, type IncidentListItem } from './hooks/useIncidents';
import { StatusChip } from './components/StatusChip';
import { PriorityChip } from './components/PriorityChip';
import { CAMPUS_IDS, CAMPUS_LABEL, STATE_OPTIONS } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

const PRIORITY_OPTIONS = ['P0', 'P1', 'P2', 'P3'];
type SortKey = 'incidentId' | 'campusId' | 'priority' | 'state' | 'updatedAt';
type OwnerFilter = '' | 'unclaimed' | 'claimed';

const ALL_CAMPUS = '__all_campus__';
const ALL_PRIORITY = '__all_priority__';
const ALL_STATE = '__all_state__';
const ALL_CATEGORY = '__all_category__';
const ALL_OWNER = '__all_owner__';
const AUTO_PRIORITY = '__auto_priority__';

interface SavedFilterState {
  campusFilter: string;
  priorityFilter: string;
  stateFilter: string;
  categoryFilter: string;
  ownerFilter: OwnerFilter;
  searchText: string;
}

interface SavedFilterRow {
  id: string;
  name: string;
  filterJson: SavedFilterState;
}

export default function CasesListPage() {
  const navigate = useNavigate();
  // `?q=` đọc 1 LẦN lúc mount — dùng khi chuông thông báo điều hướng tới
  // đúng 1 sự vụ cụ thể (NotificationBell.tsx), không đồng bộ 2 chiều với URL sau đó.
  const [searchParams] = useSearchParams();
  const [campusFilter, setCampusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<OwnerFilter>('');
  const [searchText, setSearchText] = useState(() => searchParams.get('q') || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categories, setCategories] = useState<{ code: string; label: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const [savedFilters, setSavedFilters] = useState<SavedFilterRow[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');

  useEffect(() => {
    api.get<{ code: string; label: string }[]>('/api/safety/categories').then(setCategories).catch(() => setCategories([]));
    api.get<SavedFilterRow[]>('/api/safety/saved-filters').then(setSavedFilters).catch(() => setSavedFilters([]));
  }, []);

  const { items, loading, error } = useIncidents({
    campusId: campusFilter || undefined,
    priorities: priorityFilter ? [priorityFilter] : undefined,
    states: stateFilter ? [stateFilter] : undefined,
    categoryCodes: categoryFilter ? [categoryFilter] : undefined,
    searchText: searchText || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: 500
  });

  const activeFilterCount = [campusFilter, priorityFilter, stateFilter, categoryFilter, ownerFilter, fromDate, toDate].filter(Boolean).length;
  const clearFilters = () => {
    setCampusFilter('');
    setPriorityFilter('');
    setStateFilter('');
    setCategoryFilter('');
    setOwnerFilter('');
    setFromDate('');
    setToDate('');
  };

  const filteredByOwner = useMemo(() => {
    if (!ownerFilter) return items;
    return items.filter((it) => (ownerFilter === 'unclaimed' ? !it.commanderPerId : !!it.commanderPerId));
  }, [items, ownerFilter]);

  const sorted = useMemo(() => {
    const copy = [...filteredByOwner];
    copy.sort((a, b) => {
      const av = String(a[sortKey] ?? '');
      const bv = String(b[sortKey] ?? '');
      const cmp = av.localeCompare(bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filteredByOwner, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / rowsPerPage));

  useEffect(() => {
    setPage(0);
  }, [campusFilter, priorityFilter, stateFilter, categoryFilter, ownerFilter, searchText, fromDate, toDate]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const applySavedFilter = (row: SavedFilterRow) => {
    const f = row.filterJson;
    setCampusFilter(f.campusFilter || '');
    setPriorityFilter(f.priorityFilter || '');
    setStateFilter(f.stateFilter || '');
    setCategoryFilter(f.categoryFilter || '');
    setOwnerFilter(f.ownerFilter || '');
    setSearchText(f.searchText || '');
  };

  const handleSaveFilter = async () => {
    if (!saveFilterName.trim()) return;
    const filterJson: SavedFilterState = { campusFilter, priorityFilter, stateFilter, categoryFilter, ownerFilter, searchText };
    try {
      const row = await api.post<SavedFilterRow>('/api/safety/saved-filters', { name: saveFilterName.trim(), filterJson });
      setSavedFilters((prev) => [row, ...prev]);
      setSaveDialogOpen(false);
      setSaveFilterName('');
      setToast({ message: `Đã lưu bộ lọc "${row.name}".`, severity: 'success' });
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    }
  };

  const handleDeleteSavedFilter = async (id: string) => {
    try {
      await api.delete(`/api/safety/saved-filters/${id}`);
      setSavedFilters((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      setToast({ message: e.message, severity: 'error' });
    }
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
  const [submitting, setSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const handleCreateDirect = async () => {
    setDialogError('');
    if (!form.campusId) return setDialogError('Vui lòng chọn cơ sở.');
    if (!form.categoryCode) return setDialogError('Vui lòng nhập mã nhóm sự cố.');
    setSubmitting(true);
    try {
      const res = await api.post<{ incidentId: string }>('/api/safety/incidents/direct', {
        campusId: form.campusId,
        categoryCode: form.categoryCode,
        content: form.content,
        className: form.className || undefined,
        priority: form.priority || undefined
      });
      setDialogOpen(false);
      setForm({ campusId: '', categoryCode: '', content: '', className: '', priority: '' });
      navigate(`/safety/incidents/${res.incidentId}`);
    } catch (e: any) {
      setDialogError(e.message || 'Tạo hồ sơ thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  const SortHeader = ({ sortKeyName, children }: { sortKeyName: SortKey; children: React.ReactNode }) => {
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
        title="Sự vụ"
        icon={<ListChecks />}
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <CirclePlus className="size-4" />
            Ghi nhận sự vụ trực tiếp
          </Button>
        }
      />

      {toast && (
        <Alert className={cn('mb-4', toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50')}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {savedFilters.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
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
        <div className="relative min-w-56 flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="cases-search"
            placeholder="Tìm theo nội dung/mã sự vụ"
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
              {activeFilterCount > 0 && (
                <Badge variant="outline" className="h-5 min-w-5 justify-center bg-secondary px-1 text-[#1d4ed8]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[340px]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#0f172a]">Bộ lọc</p>
              {activeFilterCount > 0 && (
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-primary hover:underline">
                  Xóa tất cả
                </button>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
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
                <Label className="mb-1.5 block">Mức ưu tiên</Label>
                <Select value={priorityFilter || ALL_PRIORITY} onValueChange={(v) => setPriorityFilter(v === ALL_PRIORITY ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_PRIORITY}>Tất cả</SelectItem>
                    {PRIORITY_OPTIONS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Trạng thái</Label>
                <Select value={stateFilter || ALL_STATE} onValueChange={(v) => setStateFilter(v === ALL_STATE ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_STATE}>Tất cả</SelectItem>
                    {STATE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">Nhóm sự cố</Label>
                <Select value={categoryFilter || ALL_CATEGORY} onValueChange={(v) => setCategoryFilter(v === ALL_CATEGORY ? '' : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_CATEGORY}>Tất cả</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="mb-1.5 block">Người phụ trách</Label>
                <Select value={ownerFilter || ALL_OWNER} onValueChange={(v) => setOwnerFilter(v === ALL_OWNER ? '' : (v as OwnerFilter))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_OWNER}>Tất cả</SelectItem>
                    <SelectItem value="unclaimed">Chưa có người phụ trách</SelectItem>
                    <SelectItem value="claimed">Đã có người phụ trách</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cases-from-date" className="mb-1.5 block">
                  Từ ngày
                </Label>
                <Input id="cases-from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="cases-to-date" className="mb-1.5 block">
                  Đến ngày
                </Label>
                <Input id="cases-to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <SortHeader sortKeyName="updatedAt">Cập nhật</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="incidentId">Mã sự vụ</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="campusId">Cơ sở</SortHeader>
              </TableHead>
              <TableHead>Nhóm sự cố</TableHead>
              <TableHead>Nội dung</TableHead>
              <TableHead>
                <SortHeader sortKeyName="priority">Mức ưu tiên</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="state">Trạng thái</SortHeader>
              </TableHead>
              <TableHead>Người phụ trách</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                  Không có sự vụ nào.
                </TableCell>
              </TableRow>
            )}
            {paged.map((it: IncidentListItem) => (
              <TableRow key={it.incidentId} className="cursor-pointer" onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>
                <TableCell className="py-3">{it.updatedAt ? new Date(it.updatedAt).toLocaleString('vi-VN') : '—'}</TableCell>
                <TableCell className="py-3 font-medium">{it.incidentId}</TableCell>
                <TableCell className="py-3">{CAMPUS_LABEL[it.campusId] || it.campusId}</TableCell>
                <TableCell className="max-w-45 py-3">
                  <p className="truncate text-sm" title={it.categoryLabel || it.categoryCode || ''}>
                    {it.categoryLabel || it.categoryCode}
                  </p>
                </TableCell>
                <TableCell className="max-w-65 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar size="sm" className="shrink-0 bg-slate-100">
                      <AvatarFallback className="bg-slate-100 text-xs font-semibold text-slate-500">
                        {(it.categoryLabel || it.categoryCode || '?').slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="truncate text-sm" title={it.contentPreview || ''}>
                      {it.contentPreview || <em>(không có nội dung)</em>}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <PriorityChip priority={it.priority} compact />
                </TableCell>
                <TableCell className="py-3">
                  <StatusChip state={it.state} />
                </TableCell>
                <TableCell className="py-3">
                  {it.commanderName || (
                    <Badge variant="outline" className="border-transparent bg-amber-100 text-amber-800">
                      Chưa tiếp nhận
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>Xem chi tiết</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 p-3 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <span>Số dòng/trang</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(v) => {
                setRowsPerPage(Number(v));
                setPage(0);
              }}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span>
            {sorted.length === 0 ? 0 : page * rowsPerPage + 1}–{Math.min(sorted.length, (page + 1) * rowsPerPage)} / {sorted.length}
          </span>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              Trước
            </Button>
            <Button variant="ghost" size="sm" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
              Sau
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Lưu bộ lọc hiện tại</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="save-filter-name" className="mb-1.5 block">
              Tên bộ lọc
            </Label>
            <Input
              id="save-filter-name"
              autoFocus
              value={saveFilterName}
              onChange={(e) => setSaveFilterName(e.target.value)}
              placeholder="VD: Sự vụ cơ sở vật chất của tôi"
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ghi nhận sự vụ trực tiếp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            {dialogError && (
              <Alert className="border-red-200 bg-red-50">
                <AlertDescription className="text-red-700">{dialogError}</AlertDescription>
              </Alert>
            )}
            <p className="text-sm text-slate-500">Dùng khi bạn trực tiếp chứng kiến/xử lý sự việc, không cần có sẵn tin báo trước.</p>
            <div>
              <Label className="mb-1.5 block">Cơ sở *</Label>
              <Select value={form.campusId} onValueChange={(v) => setForm({ ...form, campusId: v })}>
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
            <div>
              <Label htmlFor="direct-category" className="mb-1.5 block">
                Mã nhóm sự cố (categoryCode) *
              </Label>
              <Input
                id="direct-category"
                value={form.categoryCode}
                onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
                placeholder="VD: fire_explosion"
              />
            </div>
            <div>
              <Label htmlFor="direct-class" className="mb-1.5 block">
                Lớp liên quan
              </Label>
              <Input id="direct-class" value={form.className} onChange={(e) => setForm({ ...form, className: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="direct-content" className="mb-1.5 block">
                Nội dung
              </Label>
              <Textarea id="direct-content" rows={3} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            </div>
            <div>
              <Label className="mb-1.5 block">Mức ưu tiên (tuỳ chọn)</Label>
              <Select value={form.priority || AUTO_PRIORITY} onValueChange={(v) => setForm({ ...form, priority: v === AUTO_PRIORITY ? '' : v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_PRIORITY}>Tự động gợi ý</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleCreateDirect} disabled={submitting}>
              Tạo sự vụ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
