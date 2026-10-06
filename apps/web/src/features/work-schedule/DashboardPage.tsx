/**
 * Trang "Tổng quan" duy nhất của module Lịch công tác. V3 hợp nhất trang
 * Dashboard/Overview cũ, giữ toàn bộ số liệu hữu ích trong một màn hình.
 * Đối tượng chính Ban Giám hiệu nhưng đặt cùng nhóm quyền xem với "Tổng
 * quan"/"Lịch công tác" hiện có — không thêm tầng phân quyền route riêng
 * (xem ghi chú route `GET /dashboard-summary`, work-schedule.routes.ts).
 *
 * MỌI số liệu lấy từ 1 lần gọi API (`getDashboardSummary`,
 * work-schedule.service.ts) — không tự tính lại ở đây ngoài vài phép cộng
 * trừ đơn giản để vẽ biểu đồ xếp chồng. Lưu ý quan trọng: tài liệu gốc mô
 * tả 4 trạng thái việc (Đã giao/Đang thực hiện/Đã hoàn thành/Quá hạn)
 * nhưng dữ liệu thật CHỈ có 2 trạng thái (ASSIGNED/COMPLETED) — "Đang thực
 * hiện" không tồn tại, nên donut/stacked-bar chỉ còn đúng 3 nhóm suy ra
 * được: Đã giao (chưa quá hạn), Quá hạn, Đã hoàn thành.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { CalendarClock, CheckCircle2, ClipboardList, TriangleAlert } from 'lucide-react';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL, formatScheduleDateTime } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------
// Kiểu dữ liệu khớp đúng response của GET /api/work-schedule/dashboard-summary
// ---------------------------------------------------------------------
type TaskBucket = 'ASSIGNED' | 'OVERDUE' | 'COMPLETED';

interface DashboardSummary {
  kpis: { totalEvents: number; totalTasks: number; completedTasks: number; overdueTasks: number };
  taskStatusBreakdown: { status: TaskBucket; count: number }[];
  taskTrendByWeek: { weekStart: string; weekLabel: string; assigned: number; completed: number }[];
  tasksByCampus: { campusId: string; total: number; completed: number; overdue: number }[];
  eventsByDate: { date: string; count: number }[];
  eventsByCampus: { bucket: string; count: number }[];
  completionRateByCampus: { campusId: string; total: number; completed: number; rate: number }[];
  availableTypes: string[];
  events: { id: string; title: string; startAt: string; campusId: string; scope: string; status: string }[];
  tasks: { id: string; title: string; dueAt: string; createdAt: string; campusId: string; status: string; assigneePerId: string }[];
}

const TASK_BUCKET_LABEL: Record<TaskBucket, string> = { ASSIGNED: 'Đã giao', OVERDUE: 'Quá hạn', COMPLETED: 'Đã hoàn thành' };
const TASK_BUCKET_COLOR: Record<TaskBucket, string> = { ASSIGNED: '#2563eb', OVERDUE: '#dc2626', COMPLETED: '#15803d' };

// Nhãn cho các giá trị `type` ĐÃ BIẾT theo tài liệu gốc §4 — giá trị nào
// chưa có trong danh sách này (vì UI tạo lịch hiện chưa có ô chọn loại,
// nên thực tế production chỉ có 'MEETING') hiện nguyên văn, không tự suy
// diễn tên tiếng Việt.
const EVENT_TYPE_LABEL: Record<string, string> = { MEETING: 'Lịch họp', EXAM: 'Lịch kiểm tra', PROFESSIONAL: 'Công việc chuyên môn' };

function campusBucketLabel(bucket: string): string {
  return bucket === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[bucket] || bucket;
}

type PeriodPreset = 'week' | 'month' | 'quarter' | 'year' | 'custom';
const PERIOD_LABEL: Record<PeriodPreset, string> = { week: 'Tuần này', month: 'Tháng này', quarter: 'Quý này', year: 'Năm này', custom: 'Tuỳ chọn khoảng ngày' };

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function startOfWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff);
  return r;
}
function presetToRange(preset: PeriodPreset, now: Date): { from: Date; to: Date } {
  if (preset === 'week') {
    const from = startOfWeekMonday(now);
    const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 6);
    return { from, to };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return { from: new Date(now.getFullYear(), q * 3, 1), to: new Date(now.getFullYear(), q * 3 + 3, 0) };
  }
  if (preset === 'year') {
    return { from: new Date(now.getFullYear(), 0, 1), to: new Date(now.getFullYear(), 11, 31) };
  }
  // 'month' mặc định
  return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
}

interface DrillDownState {
  title: string;
  kind: 'events' | 'tasks';
  rows: DashboardSummary['events'] | DashboardSummary['tasks'];
}

function KpiCard({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <div className={cn('grid size-[34px] place-items-center rounded-lg bg-slate-100', accent)}>{icon}</div>
      </div>
      <p className="my-0.5 text-[1.85rem] leading-tight font-bold tracking-tight text-[#0f172a]">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <p className="mb-3 text-sm font-bold text-[#0f172a]">{title}</p>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<PeriodPreset>('month');
  const [customFrom, setCustomFrom] = useState(toDateInputValue(new Date()));
  const [customTo, setCustomTo] = useState(toDateInputValue(new Date()));
  const [campusFilter, setCampusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const { from, to } = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo };
    const r = presetToRange(preset, new Date());
    return { from: toDateInputValue(r.from), to: toDateInputValue(r.to) };
  }, [preset, customFrom, customTo]);

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drillDown, setDrillDown] = useState<DrillDownState | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');
    const q = new URLSearchParams({ from, to });
    if (campusFilter) q.set('campusId', campusFilter);
    if (typeFilter) q.set('type', typeFilter);
    api
      .get<DashboardSummary>(`/api/work-schedule/dashboard-summary?${q.toString()}`)
      .then(setSummary)
      .catch((e: any) => setError(e.message || 'Không tải được dữ liệu dashboard.'))
      .finally(() => setLoading(false));
  }, [from, to, campusFilter, typeFilter]);

  const donutData = useMemo(
    () => (summary ? summary.taskStatusBreakdown.map((b) => ({ ...b, label: TASK_BUCKET_LABEL[b.status] })) : []),
    [summary]
  );

  const campusStackData = useMemo(
    () =>
      summary
        ? summary.tasksByCampus.map((c) => ({
            campusId: c.campusId,
            label: CAMPUS_LABEL[c.campusId] || c.campusId,
            completed: c.completed,
            overdue: c.overdue,
            assigned: Math.max(0, c.total - c.completed - c.overdue)
          }))
        : [],
    [summary]
  );

  const eventsByCampusData = useMemo(
    () => (summary ? summary.eventsByCampus.map((e) => ({ bucket: e.bucket, label: campusBucketLabel(e.bucket), count: e.count })) : []),
    [summary]
  );

  const eventsByDateData = useMemo(
    () => (summary ? summary.eventsByDate.map((d) => ({ date: d.date, label: d.date.slice(8, 10) + '/' + d.date.slice(5, 7), count: d.count })) : []),
    [summary]
  );

  const completionRateData = useMemo(
    () => (summary ? summary.completionRateByCampus.map((c) => ({ ...c, label: CAMPUS_LABEL[c.campusId] || c.campusId })) : []),
    [summary]
  );

  const openTaskDrillDown = (status: TaskBucket) => {
    if (!summary) return;
    const now = Date.now();
    const rows = summary.tasks.filter((t) => {
      if (status === 'COMPLETED') return t.status === 'COMPLETED';
      const overdue = t.status === 'ASSIGNED' && new Date(t.dueAt).getTime() < now;
      return status === 'OVERDUE' ? overdue : t.status === 'ASSIGNED' && !overdue;
    });
    setDrillDown({ title: `Công việc — ${TASK_BUCKET_LABEL[status]} (${rows.length})`, kind: 'tasks', rows });
  };
  const openEventDateDrillDown = (date: string) => {
    if (!summary) return;
    const rows = summary.events.filter((e) => e.startAt.slice(0, 10) === date);
    setDrillDown({ title: `Lịch công tác ngày ${date.slice(8, 10)}/${date.slice(5, 7)}/${date.slice(0, 4)} (${rows.length})`, kind: 'events', rows });
  };
  const openCampusEventsDrillDown = (bucket: string) => {
    if (!summary) return;
    const rows = summary.events.filter((e) => (bucket === 'SCHOOL_WIDE' ? e.scope === 'SCHOOL_WIDE' : e.scope !== 'SCHOOL_WIDE' && e.campusId === bucket));
    setDrillDown({ title: `Lịch công tác — ${campusBucketLabel(bucket)} (${rows.length})`, kind: 'events', rows });
  };
  const openCampusTasksDrillDown = (campusId: string) => {
    if (!summary) return;
    const rows = summary.tasks.filter((t) => t.campusId === campusId);
    setDrillDown({ title: `Công việc — ${CAMPUS_LABEL[campusId] || campusId} (${rows.length})`, kind: 'tasks', rows });
  };

  return (
    <>
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {/* Bộ lọc */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-3">
        <div>
          <Label className="mb-1.5 block">Thời gian</Label>
          <Select value={preset} onValueChange={(v) => setPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PERIOD_LABEL) as PeriodPreset[]).map((p) => (
                <SelectItem key={p} value={p}>
                  {PERIOD_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {preset === 'custom' && (
          <>
            <div>
              <Label htmlFor="dash-from" className="mb-1.5 block">
                Từ ngày
              </Label>
              <input
                id="dash-from"
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <div>
              <Label htmlFor="dash-to" className="mb-1.5 block">
                Đến ngày
              </Label>
              <input
                id="dash-to"
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              />
            </div>
          </>
        )}
        <div>
          <Label className="mb-1.5 block">Điểm trường</Label>
          <Select value={campusFilter || '__all__'} onValueChange={(v) => setCampusFilter(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tất cả</SelectItem>
              {CAMPUS_IDS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CAMPUS_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {summary && summary.availableTypes.length > 1 && (
          <div>
            <Label className="mb-1.5 block">Loại dữ liệu</Label>
            <Select value={typeFilter || '__all__'} onValueChange={(v) => setTypeFilter(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả</SelectItem>
                {summary.availableTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_LABEL[t] || t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {loading && <p className="py-8 text-center text-sm text-slate-500">Đang tải dashboard...</p>}

      {!loading && summary && (
        <>
          {/* KPI */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <KpiCard title="Tổng lịch" value={summary.kpis.totalEvents} icon={<CalendarClock className="size-4" />} accent="text-primary" />
            <KpiCard title="Tổng việc" value={summary.kpis.totalTasks} icon={<ClipboardList className="size-4" />} accent="text-primary" />
            <KpiCard title="Hoàn thành" value={summary.kpis.completedTasks} icon={<CheckCircle2 className="size-4" />} accent="text-emerald-600" />
            <KpiCard title="Quá hạn" value={summary.kpis.overdueTasks} icon={<TriangleAlert className="size-4" />} accent="text-red-600" />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
            <ChartCard title="Trạng thái giao việc">
              {donutData.every((d) => d.count === 0) ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu trong khoảng đã chọn.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="count"
                      nameKey="label"
                      innerRadius={42}
                      outerRadius={65}
                      paddingAngle={2}
                      onClick={(entry: any) => openTaskDrillDown(entry.status)}
                    >
                      {donutData.map((d) => (
                        <Cell key={d.status} fill={TASK_BUCKET_COLOR[d.status]} cursor="pointer" />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Xu hướng công việc">
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={summary.taskTrendByWeek}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="weekLabel" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="assigned" name="Công việc được giao" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="completed" name="Công việc hoàn thành" stroke="#15803d" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Lịch công tác theo Cơ sở">
              {eventsByCampusData.length === 0 ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu trong khoảng đã chọn.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={eventsByCampusData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Bar dataKey="count" name="Số lịch" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => openCampusEventsDrillDown(d.bucket)} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard title="Tiến độ công việc theo Đơn vị">
              {campusStackData.every((c) => c.assigned + c.completed + c.overdue === 0) ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu trong khoảng đã chọn.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={campusStackData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Legend />
                    <Bar dataKey="completed" name="Hoàn thành" stackId="s" fill="#15803d" cursor="pointer" onClick={(d: any) => openCampusTasksDrillDown(d.campusId)} />
                    <Bar dataKey="overdue" name="Quá hạn" stackId="s" fill="#dc2626" cursor="pointer" onClick={(d: any) => openCampusTasksDrillDown(d.campusId)} />
                    <Bar
                      dataKey="assigned"
                      name="Đã giao (chưa quá hạn)"
                      stackId="s"
                      fill="#2563eb"
                      radius={[4, 4, 0, 0]}
                      cursor="pointer"
                      onClick={(d: any) => openCampusTasksDrillDown(d.campusId)}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
            <ChartCard title="Lịch công tác theo thời gian">
            {eventsByDateData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu trong khoảng đã chọn.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={eventsByDateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip labelFormatter={(_, p) => (p?.[0]?.payload ? `Ngày ${p[0].payload.date}` : '')} />
                  <Bar dataKey="count" name="Số lịch" fill="#2563eb" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(d: any) => openEventDateDrillDown(d.date)} />
                </BarChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-center text-xs text-slate-400">Nhấp vào 1 cột để xem danh sách lịch trong ngày đó.</p>
            </ChartCard>

            <ChartCard title="Hiệu suất thực hiện công việc theo Đơn vị">
              {completionRateData.every((c) => c.total === 0) ? (
                <p className="py-12 text-center text-sm text-slate-400">Không có dữ liệu trong khoảng đã chọn.</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={completionRateData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 12 }} />
                    <RechartsTooltip formatter={(v: any) => `${v}%`} />
                    <Bar dataKey="rate" name="Tỷ lệ hoàn thành" fill="#2563eb" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: any) => openCampusTasksDrillDown(d.campusId)} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        </>
      )}

      <Dialog open={!!drillDown} onOpenChange={(v) => !v && setDrillDown(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{drillDown?.title}</DialogTitle>
          </DialogHeader>
          {drillDown && drillDown.rows.length === 0 && <p className="text-sm text-slate-400">Không có dữ liệu.</p>}
          {drillDown && drillDown.kind === 'events' && drillDown.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tiêu đề</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Cơ sở</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drillDown.rows as DashboardSummary['events']).map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.title}</TableCell>
                    <TableCell>{formatScheduleDateTime(e.startAt)}</TableCell>
                    <TableCell>{e.scope === 'SCHOOL_WIDE' ? 'Toàn trường' : CAMPUS_LABEL[e.campusId] || e.campusId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {drillDown && drillDown.kind === 'tasks' && drillDown.rows.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên việc</TableHead>
                  <TableHead>Hạn</TableHead>
                  <TableHead>Cơ sở</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(drillDown.rows as DashboardSummary['tasks']).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.title}</TableCell>
                    <TableCell>{formatScheduleDateTime(t.dueAt)}</TableCell>
                    <TableCell>{CAMPUS_LABEL[t.campusId] || t.campusId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
