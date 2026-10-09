import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ListChecks, TriangleAlert, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { ReportQrCodeButton } from './components/ReportQrCodeButton';
import { useOpenUrgentCount } from './hooks/useOpenUrgentCount';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CAMPUS_LABEL } from './constants';
import { PriorityChip } from './components/PriorityChip';

/**
 * Tổng quan An toàn (/safety) — gộp luôn nội dung "Dashboard" (chart +
 * bảng quá hạn SLA, bố cục phỏng theo layout mẫu shadcnuikit) vào thẳng
 * trang này theo quyết định Sin (09/10/2026), thay vì tách tab riêng.
 * "Sự vụ của tôi" (MyIncidentsSection) đã CHUYỂN HẲN sang tab riêng
 * (MyIncidentsPage.tsx, route /safety/my-incidents) — không còn ở đây.
 */

interface IncidentStats {
  scope: string;
  rangeDays: number | null;
  rangeFrom: string | null;
  rangeTo: string;
  totalIncidents: number;
  byPriority: Record<string, number>;
  byState: Record<string, number>;
  byCampus: Record<string, number>;
  openCount: number;
  closedInRange: number;
  trend: Array<{ period: string; count: number }>;
  trendBucket: 'day' | 'month';
  overdue: Array<{ incidentId: string; clockLabel: string; priority: string; deadlineAt: string }>;
}

// value rỗng '' cho "Toàn bộ thời gian" khiến Select không hiện được nhãn
// đã chọn — dùng sentinel 'all', cùng quy ước đã dùng ở
// AnalyticsPage.tsx::RANGE_DAYS_OPTIONS.
const ALL_TIME = 'all';
const RANGE_DAYS_OPTIONS = [
  { value: '7', label: '7 ngày gần đây' },
  { value: '30', label: '30 ngày gần đây' },
  { value: '90', label: '90 ngày gần đây' },
  { value: '365', label: '365 ngày gần đây' },
  { value: ALL_TIME, label: 'Toàn bộ thời gian' }
];

function StatCard({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', className)}>{value}</p>
    </div>
  );
}

const STATE_BAR_COLOR = '#2563eb';
const CAMPUS_BAR_COLORS = ['#2563eb', '#0ea5e9', '#7c3aed'];

// 2 giá trị cố định từ backend (`sla.ts::registerSlaClock`, cột
// `clock_label` trong `sla-clocks.schema.ts`) — không có giá trị thứ 3.
// Khớp đúng thuật ngữ đã dùng ở IncidentDetailPage.tsx ("Xác nhận tiếp
// nhận" cho hành động ack).
const CLOCK_LABEL_VI: Record<string, string> = {
  ack: 'Xác nhận tiếp nhận',
  assign: 'Phân công'
};

type OverdueSortKey = 'priority' | 'deadlineAt';
const PRIORITY_RANK: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };

export default function SafetyDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<IncidentStats | null>(null);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState(ALL_TIME);

  useEffect(() => {
    const qs = rangeDays === ALL_TIME ? '' : `?rangeDays=${rangeDays}`;
    api
      .get<IncidentStats>(`/api/safety/stats/incidents${qs}`)
      .then(setStats)
      .catch((e: any) => setError(e.message || 'Không tải được số liệu.'));
  }, [rangeDays]);

  // CỐ Ý không lấy từ `stats.byPriority` — field đó đếm mọi hồ sơ từng ở
  // mức P0/P1 kể cả đã đóng/trùng/rác (Sin phát hiện 2026-10-02: lệch với
  // số hồ sơ thật đang mở ở trang "Cần xử lý ngay"). Dùng chung hook đã lọc
  // đúng TERMINAL_STATES với trang đó.
  const openUrgentCount = useOpenUrgentCount();

  const stateData = stats
    ? Object.entries(stats.byState)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  const campusData = stats
    ? Object.entries(stats.byCampus).map(([campusId, count]) => ({ campusId, label: CAMPUS_LABEL[campusId] || campusId, count }))
    : [];

  const overdue = stats?.overdue ?? [];

  const trendData = (stats?.trend ?? []).map((t) => ({
    period: t.period,
    label:
      stats?.trendBucket === 'month'
        ? (() => {
            const [y, m] = t.period.split('-');
            return `Th.${m}/${y}`;
          })()
        : (() => {
            const [, m, d] = t.period.split('-');
            return `${d}/${m}`;
          })(),
    count: t.count
  }));

  const closedLabel = rangeDays === ALL_TIME ? 'Đã đóng (toàn bộ)' : `Đã đóng (${RANGE_DAYS_OPTIONS.find((o) => o.value === rangeDays)?.label.toLowerCase()})`;

  const [overdueSortKey, setOverdueSortKey] = useState<OverdueSortKey>('deadlineAt');
  const [overdueSortDir, setOverdueSortDir] = useState<'asc' | 'desc'>('asc');
  const [overduePage, setOverduePage] = useState(0);
  const overdueRowsPerPage = 10;

  const sortedOverdue = useMemo(() => {
    const copy = [...overdue];
    copy.sort((a, b) => {
      const cmp =
        overdueSortKey === 'priority'
          ? (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9)
          : new Date(a.deadlineAt).getTime() - new Date(b.deadlineAt).getTime();
      return overdueSortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [overdue, overdueSortKey, overdueSortDir]);

  const overduePageCount = Math.max(1, Math.ceil(sortedOverdue.length / overdueRowsPerPage));
  const pagedOverdue = sortedOverdue.slice(overduePage * overdueRowsPerPage, overduePage * overdueRowsPerPage + overdueRowsPerPage);

  const handleOverdueSort = (key: OverdueSortKey) => {
    if (overdueSortKey === key) {
      setOverdueSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setOverdueSortKey(key);
      setOverdueSortDir('asc');
    }
    setOverduePage(0);
  };

  const OverdueSortHeader = ({ sortKeyName, children }: { sortKeyName: OverdueSortKey; children: React.ReactNode }) => {
    const active = overdueSortKey === sortKeyName;
    const Icon = active ? (overdueSortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <button type="button" onClick={() => handleOverdueSort(sortKeyName)} className="inline-flex items-center gap-1 font-semibold text-slate-600">
        {children}
        <Icon className={cn('size-3.5', active ? 'text-[#0f172a]' : 'text-slate-400')} />
      </button>
    );
  };

  return (
    <>
      <PageHeader
        title="Cảnh báo an toàn và xử lý sự cố"
        icon={<ShieldAlert />}
        action={
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_DAYS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="P0 - Khẩn cấp" value={stats?.byPriority.P0 ?? '—'} className="text-red-600" />
        <StatCard label="P1 - Cao" value={stats?.byPriority.P1 ?? '—'} className="text-orange-700" />
        <StatCard label="Đang mở" value={stats?.openCount ?? '—'} className="text-primary" />
        <StatCard label={closedLabel} value={stats?.closedInRange ?? '—'} className="text-green-700" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div
          onClick={() => navigate('/safety/cases')}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <ListChecks className="size-5 text-primary" />
          <div>
            <p className="font-bold">Sự vụ</p>
            <p className="text-xs text-slate-500">Toàn bộ sự vụ — mới gửi, đang xử lý, đã xử lý xong</p>
          </div>
        </div>
        <div
          onClick={() => navigate('/safety/cockpit')}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
        >
          <TriangleAlert className="size-5 text-red-600" />
          <div>
            <p className="font-bold text-red-900">
              Cần xử lý ngay
              {openUrgentCount !== null && openUrgentCount > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                  {openUrgentCount}
                </span>
              )}
            </p>
            <p className="text-xs text-red-900">Hồ sơ mức P0/P1 đang mở</p>
          </div>
        </div>
      </div>

      <div className="my-6 flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => window.open('/safety/report', '_blank')}>
          Xem trang báo cáo công khai
        </Button>
        <ReportQrCodeButton />
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <p className="mb-1 font-bold tracking-tight text-[#0f172a]">Xu hướng số sự vụ theo thời gian</p>
        <p className="mb-4 text-xs text-slate-500">
          Số sự vụ phát sinh mới, gộp theo {stats?.trendBucket === 'month' ? 'tháng' : 'ngày'}
          {stats?.rangeFrom ? ` — từ ${new Date(stats.rangeFrom).toLocaleDateString('vi-VN')} đến ${new Date(stats.rangeTo).toLocaleDateString('vi-VN')}` : ''}
        </p>
        {trendData.length > 0 ? (
          <div className="h-[260px] w-full">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="Số sự vụ"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
            {stats ? 'Chưa có dữ liệu để vẽ xu hướng.' : 'Đang tải...'}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-2">
          <p className="mb-1 font-bold tracking-tight text-[#0f172a]">Sự vụ theo trạng thái</p>
          <p className="mb-4 text-xs text-slate-500">Số lượng sự vụ đang/đã xử lý, nhóm theo trạng thái hiện tại</p>
          {stateData.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={stateData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis type="category" dataKey="state" width={120} stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Số sự vụ" fill={STATE_BAR_COLOR} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
              {stats ? 'Chưa có sự vụ nào.' : 'Đang tải...'}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
          <p className="mb-1 font-bold tracking-tight text-[#0f172a]">So sánh theo cơ sở</p>
          <p className="mb-4 text-xs text-slate-500">Tổng số sự vụ mỗi cơ sở</p>
          {campusData.length > 0 ? (
            <div className="h-[280px] w-full">
              <ResponsiveContainer>
                <BarChart data={campusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <RechartsTooltip />
                  <Bar dataKey="count" name="Số sự vụ" radius={[4, 4, 0, 0]}>
                    {campusData.map((entry, i) => (
                      <Cell key={entry.campusId} fill={CAMPUS_BAR_COLORS[i % CAMPUS_BAR_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center text-sm text-slate-500">
              {stats ? 'Chưa có dữ liệu.' : 'Đang tải...'}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-100 p-5 pb-4">
          <div>
            <p className="font-bold tracking-tight text-[#0f172a]">Quá hạn SLA</p>
            <p className="text-xs text-slate-500">Hồ sơ đang mở đã vượt hạn xác nhận/phân công</p>
          </div>
          <Badge variant="outline" className="border-transparent bg-red-50 font-bold text-red-600">
            {overdue.length}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mã hồ sơ</TableHead>
              <TableHead>
                <OverdueSortHeader sortKeyName="priority">Mức ưu tiên</OverdueSortHeader>
              </TableHead>
              <TableHead>Loại hạn</TableHead>
              <TableHead>
                <OverdueSortHeader sortKeyName="deadlineAt">Hạn chót</OverdueSortHeader>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {overdue.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-500">
                  {stats ? 'Không có hồ sơ nào quá hạn.' : 'Đang tải...'}
                </TableCell>
              </TableRow>
            )}
            {pagedOverdue.map((o, i) => (
              <TableRow key={`${o.incidentId}-${o.clockLabel}-${i}`} className="cursor-pointer" onClick={() => navigate(`/safety/incidents/${o.incidentId}`)}>
                <TableCell className="font-medium">{o.incidentId}</TableCell>
                <TableCell>
                  <PriorityChip priority={o.priority as any} compact />
                </TableCell>
                <TableCell>{CLOCK_LABEL_VI[o.clockLabel] || o.clockLabel}</TableCell>
                <TableCell>{new Date(o.deadlineAt).toLocaleString('vi-VN')}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {overdue.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 p-3 text-sm text-slate-500">
            <span>
              {overduePage * overdueRowsPerPage + 1}–{Math.min(sortedOverdue.length, (overduePage + 1) * overdueRowsPerPage)} / {sortedOverdue.length}
            </span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" disabled={overduePage === 0} onClick={() => setOverduePage((p) => Math.max(0, p - 1))}>
                Trước
              </Button>
              <Button variant="ghost" size="sm" disabled={overduePage >= overduePageCount - 1} onClick={() => setOverduePage((p) => Math.min(overduePageCount - 1, p + 1))}>
                Sau
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
