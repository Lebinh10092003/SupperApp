import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, TriangleAlert, Clock3 } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { CAMPUS_LABEL } from './constants';
import { PriorityChip } from './components/PriorityChip';

/**
 * Tab "Dashboard" — bố cục phỏng theo layout mẫu shadcnuikit
 * (hàng stat-card -> hàng chart -> bảng chính + panel bên), KHÔNG copy mã
 * nguồn template (trả phí), chỉ tham khảo cấu trúc lưới rồi tự viết lại
 * bằng component sẵn có trong repo. Toàn bộ số liệu lấy từ
 * GET /api/safety/stats/incidents — endpoint đã có sẵn từ trước (xem
 * SafetyDashboardPage.tsx / AnalyticsPage.tsx), không có số liệu bịa.
 */

interface IncidentStatsResponse {
  totalIncidents: number;
  openCount: number;
  closedLast30d: number;
  byPriority: Record<string, number>;
  byState: Record<string, number>;
  byCategory: Record<string, number>;
  byCampus: Record<string, number>;
  overdue: Array<{ incidentId: string; clockLabel: string; priority: string; deadlineAt: string }>;
}

function StatCard({ label, value, hint, className }: { label: string; value: number | string; hint?: string; className?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', className)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

const STATE_BAR_COLOR = '#2563eb';
const CAMPUS_BAR_COLORS = ['#2563eb', '#0ea5e9', '#7c3aed'];

export default function SafetyDashboardTabPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<IncidentStatsResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<IncidentStatsResponse>('/api/safety/stats/incidents')
      .then(setStats)
      .catch((e: any) => setError(e.message || 'Không tải được số liệu.'));
  }, []);

  const stateData = stats
    ? Object.entries(stats.byState)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  const campusData = stats
    ? Object.entries(stats.byCampus).map(([campusId, count]) => ({ campusId, label: CAMPUS_LABEL[campusId] || campusId, count }))
    : [];

  const overdue = stats?.overdue ?? [];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Tổng hợp số liệu sự vụ an toàn trường học" icon={<LayoutDashboard />} />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Tổng số sự vụ" value={stats?.totalIncidents ?? '—'} />
        <StatCard label="Đang mở" value={stats?.openCount ?? '—'} className="text-primary" />
        <StatCard label="Quá hạn SLA" value={overdue.length || (stats ? 0 : '—')} className="text-red-600" />
        <StatCard label="Đã đóng (30 ngày)" value={stats?.closedLast30d ?? '—'} className="text-green-700" />
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] lg:col-span-2">
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
                <TableHead>Mức ưu tiên</TableHead>
                <TableHead>Loại hạn</TableHead>
                <TableHead>Hạn chót</TableHead>
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
              {overdue.map((o, i) => (
                <TableRow
                  key={`${o.incidentId}-${i}`}
                  className="cursor-pointer"
                  onClick={() => navigate(`/safety/incidents/${o.incidentId}`)}
                >
                  <TableCell className="font-medium">{o.incidentId}</TableCell>
                  <TableCell>
                    <PriorityChip priority={o.priority as any} compact />
                  </TableCell>
                  <TableCell>{o.clockLabel}</TableCell>
                  <TableCell>{new Date(o.deadlineAt).toLocaleString('vi-VN')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-4">
          <div
            onClick={() => navigate('/safety/cockpit')}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <TriangleAlert className="size-5 text-red-600" />
            <div>
              <p className="font-bold text-red-900">Cần xử lý ngay</p>
              <p className="text-xs text-red-900">P0 {stats?.byPriority.P0 ?? '—'} · P1 {stats?.byPriority.P1 ?? '—'} đang mở</p>
            </div>
          </div>
          <div
            onClick={() => navigate('/safety/analytics')}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]"
          >
            <Clock3 className="size-5 text-primary" />
            <div>
              <p className="font-bold">Phân tích & thống kê</p>
              <p className="text-xs text-slate-500">Xem đề xuất xử lý, so sánh cơ sở, thống kê theo lớp</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
