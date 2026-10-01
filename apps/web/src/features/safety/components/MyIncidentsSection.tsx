/**
 * MyIncidentsSection.tsx — "Sự vụ của tôi" trên tab Tổng quan an toàn
 * (bổ sung 2026-09-24, Sin chốt): danh sách MỌI hồ sơ actor hiện đang là
 * chỉ huy HOẶC đang là người tham gia — kể cả hồ sơ đã đóng (vẫn tính là
 * "đã từng làm"). Tái dùng thẳng filter `onlyMine` đã có sẵn ở
 * GET /api/safety/incidents (`useIncidents` hook, `filterIncidentItems`
 * ở server lọc theo `assignedTaskPerIds.includes(perId)`).
 *
 * Không cần bảng lịch sử riêng: `assignedTaskPerIds` chỉ mất phần tử qua
 * đúng 2 đường — tự rời sự vụ (`leave`) hoặc chỉ huy được duyệt huỷ tiếp
 * nhận (`approveCancelAcknowledgment`, xoá cả chỉ huy lẫn participant của
 * người đó) — cả 2 đúng là 2 trường hợp Sin yêu cầu KHÔNG tính. Đóng hồ sơ
 * KHÔNG xoá `assignedTaskPerIds`, nên hồ sơ đã đóng vẫn tự nhiên nằm trong
 * danh sách này — không cần xử lý gì thêm cho "đã từng làm".
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useIncidents, type IncidentListItem } from '../hooks/useIncidents';
import { useActor } from '../hooks/useActor';
import { PriorityChip } from './PriorityChip';
import { StatusChip } from './StatusChip';
import { TERMINAL_STATES } from '../constants';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type SortKey = 'updatedAt' | 'priority' | 'state';

const ALL_PRIORITY = '__all_priority__';
const ALL_STATE = '__all_state__';

function StatCard({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={cn('mt-1 text-3xl font-extrabold', className)}>{value}</p>
    </div>
  );
}

function formatDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MyIncidentsSection() {
  const navigate = useNavigate();
  const { actor } = useActor();
  const { items, loading, error } = useIncidents({ onlyMine: true, limit: 500 });

  const [priorityFilter, setPriorityFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Thống kê tính trên TOÀN BỘ "của tôi", KHÔNG bị bộ lọc bên dưới ảnh
  // hưởng — lọc chỉ để thu hẹp bảng hiển thị, không đổi ý nghĩa 2 con số này.
  const openCount = useMemo(() => items.filter((it) => !TERMINAL_STATES.includes(it.state)).length, [items]);
  const totalCount = items.length;

  const filtered = useMemo(() => {
    let out = items;
    if (priorityFilter) out = out.filter((it) => it.priority === priorityFilter);
    if (stateFilter) out = out.filter((it) => it.state === stateFilter);
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      out = out.filter(
        (it) => it.incidentId.toLowerCase().includes(s) || (it.className || '').toLowerCase().includes(s) || (it.categoryLabel || '').toLowerCase().includes(s)
      );
    }
    return out;
  }, [items, priorityFilter, stateFilter, searchText]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const priorityRank: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'priority') {
        cmp = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      } else if (sortKey === 'state') {
        cmp = (a.state || '').localeCompare(b.state || '');
      } else {
        cmp = new Date(a.updatedAt || 0).getTime() - new Date(b.updatedAt || 0).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const paged = useMemo(() => sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage), [sorted, page, rowsPerPage]);
  const pageCount = Math.max(1, Math.ceil(sorted.length / rowsPerPage));

  useEffect(() => {
    setPage(0);
  }, [priorityFilter, stateFilter, searchText]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'priority' ? 'asc' : 'desc');
    }
  };

  const roleLabel = (it: IncidentListItem): string => {
    if (actor?.perId && it.commanderPerId === actor.perId) return 'Chỉ huy';
    return 'Tham gia';
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
    <div className="mt-6">
      <p className="mb-3 text-lg font-bold">Sự vụ của tôi</p>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Đang mở (của tôi)" value={loading ? '—' : openCount} className="text-primary" />
        <StatCard label="Tổng số đã/đang làm" value={loading ? '—' : totalCount} className="text-green-700" />
      </div>

      <div className="mb-3 flex flex-wrap gap-3">
        <Select value={priorityFilter || ALL_PRIORITY} onValueChange={(v) => setPriorityFilter(v === ALL_PRIORITY ? '' : v)}>
          <SelectTrigger className="min-w-36">
            <SelectValue placeholder="Mức ưu tiên" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_PRIORITY}>Tất cả</SelectItem>
            <SelectItem value="P0">P0</SelectItem>
            <SelectItem value="P1">P1</SelectItem>
            <SelectItem value="P2">P2</SelectItem>
            <SelectItem value="P3">P3</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stateFilter || ALL_STATE} onValueChange={(v) => setStateFilter(v === ALL_STATE ? '' : v)}>
          <SelectTrigger className="min-w-44">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATE}>Tất cả</SelectItem>
            {Array.from(new Set(items.map((it) => it.state))).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Tìm mã hồ sơ / lớp / nhóm sự cố"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="min-w-60 flex-1"
        />
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              <TableHead>Mã hồ sơ</TableHead>
              <TableHead>Nhóm sự cố</TableHead>
              <TableHead>
                <SortHeader sortKeyName="priority">Mức ưu tiên</SortHeader>
              </TableHead>
              <TableHead>
                <SortHeader sortKeyName="state">Trạng thái</SortHeader>
              </TableHead>
              <TableHead>Vai trò của tôi</TableHead>
              <TableHead>
                <SortHeader sortKeyName="updatedAt">Cập nhật lúc</SortHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!loading && sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-slate-500">
                  Bạn chưa từng tiếp nhận hoặc tham gia sự vụ nào khớp bộ lọc này.
                </TableCell>
              </TableRow>
            )}
            {paged.map((it) => (
              <TableRow key={it.incidentId} className="cursor-pointer" onClick={() => navigate(`/safety/incidents/${it.incidentId}`)}>
                <TableCell className="font-semibold">{it.incidentId}</TableCell>
                <TableCell>{it.categoryLabel || it.categoryCode || '—'}</TableCell>
                <TableCell>
                  <PriorityChip priority={it.priority} compact />
                </TableCell>
                <TableCell>
                  <StatusChip state={it.state} />
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn('h-6 font-bold', roleLabel(it) === 'Chỉ huy' ? 'border-blue-200 bg-secondary text-primary' : 'border-slate-200 bg-slate-50 text-slate-600')}
                  >
                    {roleLabel(it)}
                  </Badge>
                </TableCell>
                <TableCell>{formatDateTime(it.updatedAt)}</TableCell>
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
                {[10, 25, 50].map((n) => (
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
    </div>
  );
}
