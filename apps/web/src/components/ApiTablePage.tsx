import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloudUpload, RefreshCw, School, Search } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { api } from '../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

/** Trang danh sách dạng bảng dùng chung (tìm kiếm + bảng + phân trang) —
 * y hệt ApiTablePage cũ (bản MUI). Logic tải dữ liệu/lọc/phân trang GIỮ
 * NGUYÊN 100%, chỉ đổi lớp hiển thị sang shadcn/Tailwind. Không có
 * component "TablePagination" sẵn trong shadcn/ui nên tự dựng phần phân
 * trang (Select số dòng/trang + nút lùi/tới + "X–Y trên Z") bằng các
 * primitive đã có (Select/Button), theo đúng cách hiển thị cũ. */
export function ApiTablePage({
  title,
  subtitle,
  path,
  columns,
  action
}: {
  title: string;
  subtitle?: string;
  path: string;
  columns: { key: string; label: string; render?: (val: any, row: any) => React.ReactNode }[];
  action?: React.ReactNode;
}) {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const loadData = () => {
    setLoading(true);
    setErr('');
    api<{ items: any[] }>(path)
      .then((x) => {
        setItems(x.items || []);
      })
      .catch((e) => {
        console.warn('API fetch notice:', e.message);
        setErr(`Không thể kết nối máy chủ hoặc chưa có dữ liệu: ${e.message}`);
        setItems([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [path]);

  const filtered = useMemo(() => {
    if (!q.trim()) return items;
    const query = q.toLowerCase();
    return items.filter((x) => Object.values(x).some((val) => String(val ?? '').toLowerCase().includes(query)));
  }, [items, q]);

  const pagedItems = useMemo(() => {
    return filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filtered, page, rowsPerPage]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const rangeFrom = filtered.length === 0 ? 0 : page * rowsPerPage + 1;
  const rangeTo = Math.min(filtered.length, page * rowsPerPage + rowsPerPage);

  const renderCellContent = (c: any, row: any) => {
    if (c.render) return c.render(row[c.key], row);
    const val = row[c.key];

    if (c.key === 'status') {
      const isLive = String(val).toUpperCase() === 'LIVE';
      return (
        <Badge
          variant="outline"
          className={cn('h-6 text-[0.72rem] font-bold', isLive ? 'border-red-200 bg-red-50 text-red-600' : 'border-slate-200 bg-slate-50 text-slate-700')}
        >
          {val || 'Hoàn thành'}
        </Badge>
      );
    }

    if (c.key === 'attendanceRate' || c.key.includes('Rate')) {
      const num = Number(val);
      if (!isNaN(num)) {
        return (
          <span className={cn('text-[0.84rem] font-bold', num >= 90 ? 'text-emerald-500' : num >= 75 ? 'text-amber-500' : 'text-red-500')}>{num}%</span>
        );
      }
    }

    return String(val ?? '—');
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex gap-2">
            {action}
            <Button variant="outline" size="sm" onClick={loadData} className="bg-white font-semibold text-slate-700">
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute top-1/2 left-3 size-[19px] -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Lọc dữ liệu tìm kiếm..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="h-[38px] bg-white pl-10 text-[0.84rem]"
          />
        </div>

        <Badge variant="outline" className="h-7 border-blue-200 bg-secondary px-2 text-[0.75rem] font-bold text-[#1d4ed8]">
          Tổng cộng {filtered.length} bản ghi
        </Badge>
      </div>

      {err && <p className="mb-5 rounded-lg border border-blue-200 bg-secondary px-4 py-3 text-sm text-blue-800">{err}</p>}

      {/* Table Card */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_0_rgba(15,23,42,0.04)]">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              {columns.map((c) => (
                <TableHead key={c.key} className="py-3 text-[0.75rem] font-bold tracking-wider text-slate-600 uppercase">
                  {c.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.key} className="py-3.5">
                      <Skeleton className="h-[22px] w-4/5" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : items.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-16 text-center">
                  <div className="mx-auto mb-4 inline-flex size-[52px] items-center justify-center rounded-xl border border-blue-200 bg-gradient-to-br from-secondary to-blue-100 text-primary shadow-[0_4px_10px_rgba(37,99,235,0.12)]">
                    <School className="size-[26px]" />
                  </div>
                  <p className="mb-1 text-base font-bold text-[#0f172a]">Chưa có dữ liệu từ Google Classroom</p>
                  <p className="mx-auto mb-6 max-w-[460px] text-[0.84rem] leading-relaxed text-slate-500">
                    Toàn bộ thông tin học tập và danh bạ được đồng bộ trực tiếp từ Google Classroom. Hãy kết nối tài khoản hoặc tiến hành đồng bộ để hiển thị
                    danh sách.
                  </p>
                  <div className="flex justify-center gap-3">
                    <Button onClick={() => navigate('/connections')} className="rounded-lg px-5 py-2 text-[0.84rem] font-bold">
                      <CloudUpload className="size-[18px]" />
                      Kết nối &amp; Đồng bộ Classroom
                    </Button>
                    <Button variant="outline" onClick={loadData} className="rounded-lg text-[0.84rem] font-semibold text-slate-700">
                      <RefreshCw className="size-[18px]" />
                      Thử lại
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : pagedItems.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="py-12 text-center">
                  <p className="mb-1 text-sm font-bold text-[#0f172a]">Không tìm thấy kết quả phù hợp với "{q}"</p>
                  <p className="text-xs text-slate-500">Vui lòng thử tìm kiếm bằng từ khóa khác</p>
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((x, i) => (
                <TableRow key={x.id || i} className="border-b border-slate-100 hover:bg-blue-50/60">
                  {columns.map((c) => (
                    <TableCell key={c.key} className="py-3 text-[0.84rem]">
                      {renderCellContent(c, x)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filtered.length > rowsPerPage && (
          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-slate-200 px-4 py-2.5 text-[0.78rem] text-slate-500">
            <div className="flex items-center gap-2">
              <span>Số hàng mỗi trang:</span>
              <Select
                value={String(rowsPerPage)}
                onValueChange={(v) => {
                  setRowsPerPage(parseInt(v, 10));
                  setPage(0);
                }}
              >
                <SelectTrigger size="sm" className="w-[70px] text-[0.78rem]">
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
              {rangeFrom}–{rangeTo} trên {filtered.length}
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
        )}
      </div>
    </>
  );
}
