import { useEffect, useState } from 'react';
import { ChartNoAxesCombined } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * Phân tích & thống kê — gộp lại các block đã có backend từ trước
 * (safety-stats.routes.ts: trend-alerts/campus-comparison/classes)
 * nhưng chưa có UI. Theo đúng mô tả gốc trong CLAUDE.md dự án: pill-tab
 * gộp nhiều khối vào 1 trang thay vì xếp chồng nhiều card riêng.
 *
 * Tab "Theo khu vực" (bản đồ Konva/bảng zone stats) đã bị BỎ HẲN theo
 * quyết định của Sin (10/09/2026) — không giữ lại khái niệm "khu vực"
 * trong app nữa, xem toàn bộ diff xoá zone ở TASKS.md.
 */

interface TrendAlert {
  campus_id: string;
  category_code: string;
  count: number;
  window_days: number;
  severity: 'critical' | 'warning';
}

function TrendAlertsPanel() {
  const [alerts, setAlerts] = useState<TrendAlert[]>([]);
  const [error, setError] = useState('');
  const [categoryLabel, setCategoryLabel] = useState<Record<string, string>>({});

  useEffect(() => {
    api
      .get<{ alerts: TrendAlert[] }>('/api/safety/stats/trend-alerts')
      .then((res) => setAlerts(res.alerts || []))
      .catch((e: any) => setError(e.message || 'Không tải được cảnh báo xu hướng.'));
    api
      .get<{ code: string; label: string }[]>('/api/safety/categories')
      .then((cats) => setCategoryLabel(Object.fromEntries((cats || []).map((c) => [c.code, c.label]))))
      .catch(() => setCategoryLabel({}));
  }, []);

  return (
    <div>
      {error && (
        <Alert className="mb-3 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      {!error && alerts.length === 0 && <p className="text-sm text-slate-500">Không có cảnh báo xu hướng nào đang mở.</p>}
      <div className="flex flex-col gap-2.5">
        {alerts.map((a, i) => (
          <div
            key={i}
            className={`rounded-lg border p-3 ${a.severity === 'critical' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}
          >
            <p className="text-sm font-bold">
              {CAMPUS_LABEL[a.campus_id] || a.campus_id} — {categoryLabel[a.category_code] || a.category_code}
            </p>
            <p className="text-xs text-slate-500">
              {a.count} vụ trong {a.window_days} ngày gần đây — mức {a.severity === 'critical' ? 'nghiêm trọng' : 'cảnh báo'}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CampusComparisonPanel() {
  // Backend (`safety-stats.routes.ts` /stats/campus-comparison) đã nhận
  // sẵn `fromMonth`/`toMonth` từ đầu — trước đây chỉ CHƯA nối vào UI (Sin
  // phản hồi 2026-09-11: "thống kê cảnh báo an toàn... có sort và check
  // theo thời gian được không, đó là thông tin quan trọng").
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    const qs = new URLSearchParams();
    if (fromMonth) qs.set('fromMonth', fromMonth);
    if (toMonth) qs.set('toMonth', toMonth);
    api
      .get(`/api/safety/stats/campus-comparison${qs.toString() ? `?${qs}` : ''}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: any) => setError(e.message || 'Không tải được so sánh cơ sở.'));
  };

  useEffect(load, []);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <Label htmlFor="campus-from-month" className="mb-1.5 block">
            Từ tháng
          </Label>
          <Input id="campus-from-month" type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="min-w-40" />
        </div>
        <div>
          <Label htmlFor="campus-to-month" className="mb-1.5 block">
            Đến tháng
          </Label>
          <Input id="campus-to-month" type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="min-w-40" />
        </div>
        <Button variant="outline" onClick={load}>
          Xem
        </Button>
      </div>
      {error && (
        <Alert className="mb-3 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      {!data && !error ? null : <CampusComparisonTable data={data} />}
    </div>
  );
}

function CampusComparisonTable({ data }: { data: any }) {
  if (!data) return null;
  const campusIds = Object.keys(data.campuses || {});

  return (
    <div>
      <p className="mb-3 text-xs text-slate-500">
        {data.from_month} → {data.to_month} · {data.disclaimer}
      </p>
      <div className="rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cơ sở</TableHead>
              <TableHead>Tổng số vụ</TableHead>
              <TableHead>Tỷ lệ P0/P1</TableHead>
              <TableHead>So với tháng trước</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campusIds.map((cid) => {
              const entry = data.campuses[cid];
              return (
                <TableRow key={cid}>
                  <TableCell>
                    {CAMPUS_LABEL[cid] || cid}
                    {data.ranking?.highest_p0_p1_rate_campus === cid && (
                      <Badge variant="outline" className="ml-2 border-transparent bg-red-50 text-red-600">
                        Cao nhất P0/P1
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{entry.total_count}</TableCell>
                  <TableCell>{entry.p0_p1_rate != null ? `${(entry.p0_p1_rate * 100).toFixed(0)}%` : '—'}</TableCell>
                  <TableCell>
                    {entry.compare_to_previous_month ? (
                      <Badge
                        variant="outline"
                        className={
                          entry.compare_to_previous_month.direction === 'worsened'
                            ? 'border-transparent bg-red-50 text-red-600'
                            : 'border-transparent bg-emerald-50 text-emerald-700'
                        }
                      >
                        {entry.compare_to_previous_month.delta > 0 ? '+' : ''}
                        {entry.compare_to_previous_month.delta}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// value rỗng '' cho "Toàn bộ thời gian" khiến Select không hiện được nhãn
// đã chọn — dùng sentinel 'all' thay vì rỗng, chỉ bỏ qua khi build query
// string.
const RANGE_DAYS_OPTIONS = [
  { value: '7', label: '7 ngày gần đây' },
  { value: '30', label: '30 ngày gần đây' },
  { value: '90', label: '90 ngày gần đây' },
  { value: '365', label: '365 ngày gần đây' },
  { value: 'all', label: 'Toàn bộ thời gian' }
];

function ClassStatsPanel() {
  const [campusId, setCampusId] = useState('MAIN_CAMPUS');
  const [reason, setReason] = useState('');
  // Backend (`/stats/classes`) đã nhận sẵn `rangeDays` từ đầu — trước đây
  // CHƯA nối vào UI (Sin phản hồi 2026-09-11: cần lọc/kiểm tra theo thời
  // gian ở phần thống kê).
  const [rangeDays, setRangeDays] = useState('30');
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  const load = () => {
    const qs = new URLSearchParams({ campusId });
    if (reason.trim()) qs.set('reason', reason.trim());
    if (rangeDays && rangeDays !== 'all') qs.set('rangeDays', rangeDays);
    api
      .get(`/api/safety/stats/classes?${qs}`)
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((e: any) => setError(e.message || 'Không tải được thống kê theo lớp.'));
  };

  useEffect(load, [campusId, rangeDays]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-50">
          <Label className="mb-1.5 block">Cơ sở</Label>
          <Select value={campusId} onValueChange={setCampusId}>
            <SelectTrigger className="w-full">
              <SelectValue />
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
        <div className="min-w-48">
          <Label className="mb-1.5 block">Khoảng thời gian</Label>
          <Select value={rangeDays} onValueChange={setRangeDays}>
            <SelectTrigger className="w-full">
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
        </div>
        <div className="min-w-70 flex-1">
          <Label htmlFor="class-stats-reason" className="mb-1.5 block">
            Lý do xem (bắt buộc với Trực ban/Tổ trưởng)
          </Label>
          <Input id="class-stats-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <Button variant="outline" onClick={load}>
          Xem
        </Button>
      </div>
      {error && (
        <Alert className="mb-3 border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}
      {data && (
        <div className="rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lớp</TableHead>
                <TableHead>Số vụ</TableHead>
                <TableHead>Cảnh báo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data.classes || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-slate-500">
                    Không có dữ liệu.
                  </TableCell>
                </TableRow>
              )}
              {(data.classes || []).map((c: any) => (
                <TableRow key={c.class_name}>
                  <TableCell>{c.class_name}</TableCell>
                  <TableCell>{c.total_count}</TableCell>
                  <TableCell>
                    {c.severity_flag && (
                      <Badge variant="outline" className="border-transparent bg-red-50 text-red-600">
                        Cần chú ý
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('0');

  return (
    <>
      <PageHeader title="Phân tích & thống kê" icon={<ChartNoAxesCombined />} />

      <div className="rounded-xl border border-slate-200 p-5">
        <Tabs value={tab} onValueChange={setTab} className="mb-4">
          <TabsList>
            <TabsTrigger value="0">Đề xuất xử lý</TabsTrigger>
            <TabsTrigger value="1">So sánh cơ sở</TabsTrigger>
            <TabsTrigger value="2">Theo lớp học</TabsTrigger>
          </TabsList>
        </Tabs>
        {tab === '0' && <TrendAlertsPanel />}
        {tab === '1' && <CampusComparisonPanel />}
        {tab === '2' && <ClassStatsPanel />}
      </div>
    </>
  );
}
