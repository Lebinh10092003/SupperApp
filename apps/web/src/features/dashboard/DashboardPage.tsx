import { useEffect, useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  GraduationCap,
  BookOpenCheck,
  ClipboardList,
  CheckCircle2,
  TriangleAlert,
  BellRing,
  ArrowLeftRight,
  LayoutGrid,
  UserSearch,
  Moon,
  RotateCw,
  RefreshCw,
  IdCard,
  Loader2
} from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface KpiItemProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  iconBg?: string;
  onClick?: () => void;
}

const CardK = ({ title, value, delta, deltaPositive = true, subtitle, icon, accentColor = 'text-primary', iconBg = 'bg-secondary', onClick }: KpiItemProps) => (
  <div
    onClick={onClick}
    className={cn(
      'h-full rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition-all duration-200',
      onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_6px_16px_-2px_rgba(15,23,42,0.08)]' : 'hover:shadow-[0_4px_10px_-2px_rgba(15,23,42,0.06)]'
    )}
  >
    <div className="mb-2 flex items-center justify-between">
      <p className="text-[0.72rem] font-bold tracking-wide text-slate-500 uppercase">{title}</p>
      <div className={cn('grid size-[34px] place-items-center rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.02)]', iconBg, accentColor)}>{icon}</div>
    </div>

    <p className="my-0.5 text-[1.85rem] leading-tight font-extrabold tracking-tight text-[#0f172a]">{value ?? '0'}</p>

    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {delta && <span className={cn('text-xs font-bold', deltaPositive ? 'text-emerald-500' : 'text-red-500')}>{delta}</span>}
      <span className="text-xs text-slate-400">• {subtitle || 'Classroom'}</span>
    </div>
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this_month');
  const [grade, setGrade] = useState('all');
  const [overview, setOverview] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const handleAutoAssignTeachers = async () => {
    setActionLoading('teachers');
    setActionMsg(null);
    try {
      const res = await api.post<any>('/api/classes/auto-assign-teachers', {});
      setActionMsg({ text: res.message || 'Đã phân công Giáo viên Chủ nhiệm chuẩn hóa cho tất cả các lớp!', type: 'success' });
      await fetchOverview();
      const updatedClasses = await api.get<{ items: any[] }>('/api/classes').catch(() => ({ items: [] }));
      setClasses(updatedClasses.items || []);
    } catch (e: any) {
      setActionMsg({ text: `Lỗi phân công GVCN: ${e.message}`, type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNudgeSubmissions = async () => {
    setActionLoading('nudge');
    setActionMsg(null);
    try {
      const res = await api.post<any>('/api/classes/nudge', { classId: grade });
      setActionMsg({ text: res.message || 'Đã gửi lệnh đôn đốc nộp bài tập số thành công!', type: 'success' });
      await fetchOverview();
    } catch (e: any) {
      setActionMsg({ text: `Lỗi gửi đôn đốc: ${e.message}`, type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    api.get<{ items: any[] }>('/api/classes')
      .then((res) => setClasses(res.items || []))
      .catch(() => {});
  }, []);

  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    classes.forEach((c) => {
      if (c.grade != null && c.grade !== '') grades.add(String(c.grade));
    });
    const sorted = Array.from(grades).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return sorted;
  }, [classes]);

  const fetchOverview = async () => {
    try {
      const query = new URLSearchParams({ period });
      if (grade !== 'all') query.set('grade', grade);
      const res = await api.get<any>(`/api/analytics/overview?${query.toString()}`);
      if (res && res.kpis) {
        setOverview(res);
      }
    } catch {
      setOverview({
        isSynced: false,
        kpis: {
          totalCourses: { value: 0, delta: 'Chưa có dữ liệu' },
          totalClasses: { value: 0, delta: 'Chưa có dữ liệu' },
          activeClassrooms: { value: 0, delta: 'Chưa đồng bộ Classroom' },
          dormantClassrooms: { value: 0, delta: 'Chưa có dữ liệu' },
          totalTeachers: { value: 0, delta: 'Chưa có dữ liệu' },
          totalStudents: { value: 0, delta: 'Chưa có dữ liệu' },
          assignmentsCount: { value: 0, delta: 'Chưa có dữ liệu' },
          completionRate: { value: 0, delta: 'Chưa có dữ liệu' },
          onTimeRate: { value: 0, delta: 'Chưa có dữ liệu' },
          missingAssignments: { value: 0, delta: 'Chưa có dữ liệu' },
          ungradedAssignments: { value: 0, delta: 'Chưa có dữ liệu' },
          schoolGpa: { value: 0, delta: 'Chưa có dữ liệu' },
          openAlerts: { value: 0, delta: 'Chưa có dữ liệu' }
        }
      });
    }

    try {
      const trendRes = await api.get<{ items: any[] }>('/api/analytics/trend');
      if (trendRes?.items && trendRes.items.length > 0) {
        setTrendData(
          trendRes.items.map((it) => ({
            date: it.date || 'Hôm nay',
            completion: it.submissionRate ?? 0,
            onTime: it.attendanceRate ?? 0,
            gpa: 0
          }))
        );
      } else {
        setTrendData([]);
      }
    } catch {
      setTrendData([]);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, grade]);

  const handleQuickSync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await api.post<any>('/api/classroom/sync', {});
      setSyncNotice(res.message || `Đã đồng bộ thành công ${res.success || res.total || 0} khóa học Google Classroom!`);
      await fetchOverview();
    } catch (e: any) {
      setSyncNotice(`Không thể đồng bộ tự động: ${e.message}. Hãy kiểm tra kết nối tài khoản.`);
    } finally {
      setSyncing(false);
    }
  };

  const k = overview?.kpis;
  const isSynced = overview?.isSynced;
  const hasOpenAlerts = Number(k?.openAlerts?.value || 0) > 0;

  return (
    <>
      <PageHeader
        title="Bảng điều hành toàn trường"
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button onClick={handleQuickSync} disabled={syncing} className="font-bold">
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              {syncing ? 'Đang đồng bộ Classroom...' : 'Đồng Bộ Classroom'}
            </Button>

            <Button
              onClick={handleAutoAssignTeachers}
              disabled={actionLoading !== null}
              className="bg-emerald-600 font-bold hover:bg-emerald-700"
            >
              {actionLoading === 'teachers' ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
              {actionLoading === 'teachers' ? 'Đang gán...' : 'Phân Công GVCN'}
            </Button>

            <Button onClick={handleNudgeSubmissions} disabled={actionLoading !== null} className="bg-amber-600 font-bold hover:bg-amber-700">
              {actionLoading === 'nudge' ? <Loader2 className="size-4 animate-spin" /> : <BellRing className="size-4" />}
              {actionLoading === 'nudge' ? 'Đang gửi...' : 'Đôn Đốc Nộp Bài'}
            </Button>

            <Button variant="outline" onClick={fetchOverview} className="font-semibold">
              <RefreshCw className="size-4" />
              Làm mới
            </Button>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="min-w-36 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hôm nay</SelectItem>
                <SelectItem value="7d">7 ngày qua</SelectItem>
                <SelectItem value="this_week">Tuần này</SelectItem>
                <SelectItem value="this_month">Tháng này</SelectItem>
                <SelectItem value="semester">Học kỳ 1</SelectItem>
                <SelectItem value="school_year">Cả năm học</SelectItem>
              </SelectContent>
            </Select>

            <Select value={grade} onValueChange={setGrade}>
              <SelectTrigger className="min-w-32 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn trường</SelectItem>
                {availableGrades.map((g) => (
                  <SelectItem key={g} value={g}>
                    Khối {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {syncNotice && (
        <Alert className={cn('mb-5', syncNotice.includes('thành công') ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50')}>
          <AlertDescription className={syncNotice.includes('thành công') ? 'text-emerald-700' : 'text-amber-800'}>{syncNotice}</AlertDescription>
        </Alert>
      )}

      {actionMsg && (
        <Alert
          className={cn(
            'mb-5',
            actionMsg.type === 'success'
              ? 'border-emerald-200 bg-emerald-50'
              : actionMsg.type === 'warning'
                ? 'border-amber-200 bg-amber-50'
                : 'border-blue-200 bg-secondary'
          )}
        >
          <AlertDescription
            className={cn(
              'font-semibold',
              actionMsg.type === 'success' ? 'text-emerald-700' : actionMsg.type === 'warning' ? 'text-amber-800' : 'text-blue-800'
            )}
          >
            {actionMsg.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Cảnh báo Tiến độ Chấm bài quá 48h */}
      {Number(k?.ungradedAssignments?.value || 0) > 0 && (
        <Alert className="mb-5 flex items-center justify-between border-amber-200 bg-amber-50">
          <AlertDescription className="text-amber-900">
            ⚠️ <strong>Cảnh Báo Chậm Trả Điểm (&gt;48h):</strong> Hiện có <strong>{k?.ungradedAssignments?.value} bài tập</strong> đã nộp nhưng giáo
            viên bộ môn chưa chấm điểm. Cần hoàn thành chấm để đồng bộ điểm vào Hồ sơ 360° học sinh.
          </AlertDescription>
          <Button size="sm" onClick={() => navigate('/teachers')} className="shrink-0 bg-amber-600 font-bold hover:bg-amber-700">
            Đôn Đốc Chấm Bài
          </Button>
        </Alert>
      )}

      {overview && !isSynced && (
        <Alert className="mb-6 flex items-center justify-between border-blue-200 bg-secondary">
          <AlertDescription className="text-blue-900">
            <strong>Dữ liệu thực tế 100%:</strong> Hiện chưa có khóa học nào được đồng bộ từ Google Classroom, các chỉ số hiển thị giá trị thực (0).
            Vui lòng kết nối tài khoản Google Workspace hoặc bấm "Đồng Bộ Classroom" để nạp dữ liệu thật.
          </AlertDescription>
          <Button size="sm" onClick={() => navigate('/connections')} className="shrink-0 font-bold">
            Cấu hình Google Classroom
          </Button>
        </Alert>
      )}

      {/* Lối tắt Điều Hành Nhanh */}
      <div className="mb-6 flex gap-2.5 overflow-x-auto pb-1">
        <Button onClick={() => navigate('/executive')} className="shrink-0 font-bold shadow-[0_2px_4px_rgba(37,99,235,0.2)]">
          <LayoutGrid className="size-4" />
          Executive Heatmap Lớp × Môn
        </Button>

        <Button variant="outline" onClick={() => navigate('/students/360')} className="shrink-0 font-semibold">
          <UserSearch className="size-4" />
          Hồ sơ 360° Học sinh
        </Button>

        <Button variant="outline" onClick={() => navigate('/classes/compare')} className="shrink-0 font-semibold">
          <ArrowLeftRight className="size-4" />
          So sánh Lớp học Đối đầu
        </Button>

        <Button variant="outline" onClick={() => navigate('/subjects/analytics')} className="shrink-0 font-semibold">
          <BookOpenCheck className="size-4" />
          Phân tích Môn học
        </Button>

        <Button
          variant="outline"
          onClick={() => navigate('/alerts')}
          className={cn(
            'shrink-0 font-bold',
            hasOpenAlerts && 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:text-amber-900'
          )}
        >
          <BellRing className="size-4" />
          Trung tâm Cảnh báo ({k?.openAlerts?.value ?? 0})
        </Button>
      </div>

      {/* Cảnh báo Lớp học Ngủ đông nếu có */}
      {Number(k?.dormantClassrooms?.value || 0) > 0 && (
        <Alert className="mb-6 flex items-center justify-between border-amber-200 bg-amber-50">
          <AlertDescription className="flex items-center gap-2 text-amber-900">
            <Moon className="size-[18px] shrink-0" />
            <span>
              <strong>CẢNH BÁO LỚP HỌC NGỦ ĐÔNG:</strong> Phát hiện {k?.dormantClassrooms?.value} Classroom đã quá 14 ngày không có bài tập, tài
              liệu hoặc thông báo mới từ giáo viên.
            </span>
          </AlertDescription>
          <Button size="sm" variant="ghost" onClick={() => navigate('/classroom')} className="shrink-0 font-bold text-amber-900">
            Xem chi tiết
          </Button>
        </Alert>
      )}

      {/* Lưới Thẻ KPI Điều Hành 8 Chỉ Số Thực */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <CardK
          title="Khóa học Classroom"
          value={k?.totalCourses?.value ?? k?.activeClassrooms?.value ?? 0}
          delta={k?.activeClassrooms?.delta}
          subtitle={isSynced ? 'Lớp số hoạt động' : 'Chờ đồng bộ'}
          icon={<BookOpenCheck className="size-5" />}
          accentColor="text-primary"
          iconBg="bg-secondary"
          onClick={() => navigate('/classroom')}
        />

        <CardK
          title="Giáo viên giảng dạy"
          value={k?.totalTeachers?.value ?? 0}
          delta={k?.totalTeachers?.delta || `${k?.totalTeachers?.value ?? 0} Giáo viên`}
          subtitle="Từ Classroom & Danh bạ"
          icon={<IdCard className="size-5" />}
          accentColor="text-indigo-600"
          iconBg="bg-indigo-50"
          onClick={() => navigate('/teachers')}
        />

        <CardK
          title="Học sinh toàn trường"
          value={k?.totalStudents?.value ?? 0}
          delta={k?.totalStudents?.delta || `${k?.totalStudents?.value ?? 0} Học sinh`}
          subtitle="Từ Google Classroom"
          icon={<Users className="size-5" />}
          accentColor="text-sky-600"
          iconBg="bg-sky-50"
          onClick={() => navigate('/students')}
        />

        <CardK
          title="Lớp hành chính"
          value={k?.totalClasses?.value ?? 0}
          delta={k?.totalClasses?.delta || `${k?.totalClasses?.value ?? 0} Lớp`}
          subtitle="Khối 6, 7, 8, 9"
          icon={<GraduationCap className="size-5" />}
          accentColor="text-cyan-600"
          iconBg="bg-cyan-50"
          onClick={() => navigate('/classes')}
        />

        <CardK
          title="Tỷ lệ hoàn thành bài"
          value={k?.completionRate?.value != null ? `${k.completionRate.value}%` : '0%'}
          delta={k?.completionRate?.delta}
          deltaPositive={Number(k?.completionRate?.value || 0) >= 80}
          subtitle={isSynced ? 'Tiến độ nộp bài' : 'Chưa có bài'}
          icon={<CheckCircle2 className="size-5" />}
          accentColor="text-emerald-500"
          iconBg="bg-emerald-50"
          onClick={() => navigate('/executive')}
        />

        <CardK
          title="Tỷ lệ nộp đúng hạn"
          value={k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%'}
          delta={k?.onTimeRate?.delta}
          deltaPositive={Number(k?.onTimeRate?.value || 0) >= 80}
          subtitle={isSynced ? 'Đúng hạn chót' : 'Chưa có số liệu'}
          icon={<ClipboardList className="size-5" />}
          accentColor="text-emerald-600"
          iconBg="bg-green-50"
        />

        <CardK
          title="Bài chưa chấm / tồn đọng"
          value={k?.ungradedAssignments?.value ?? 0}
          delta={k?.ungradedAssignments?.delta}
          deltaPositive={Number(k?.ungradedAssignments?.value || 0) === 0}
          subtitle="Chờ giáo viên chấm"
          icon={<TriangleAlert className="size-5" />}
          accentColor="text-amber-500"
          iconBg="bg-amber-50"
          onClick={() => navigate('/classroom')}
        />

        <CardK
          title="Cảnh báo cần xử lý"
          value={k?.openAlerts?.value ?? 0}
          delta={k?.openAlerts?.delta}
          deltaPositive={Number(k?.openAlerts?.value || 0) === 0}
          subtitle="Quét tự động"
          icon={<BellRing className="size-5" />}
          accentColor="text-red-500"
          iconBg="bg-red-50"
          onClick={() => navigate('/alerts')}
        />
      </div>

      {/* Biểu đồ Xu hướng Hoàn thành theo thời gian */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-bold tracking-tight text-[#0f172a]">Xu Hướng Học Tập Toàn Trường</p>
            <p className="text-[0.78rem] text-slate-500">Theo dõi tiến độ hoàn thành bài tập và nộp bài đúng hạn từ Google Classroom</p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'font-bold',
              trendData.length > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-500'
            )}
          >
            {trendData.length > 0 ? 'Dữ liệu thời gian thực' : 'Đang chờ chu kỳ đồng bộ'}
          </Badge>
        </div>

        {trendData.length > 0 ? (
          <div className="h-[290px] w-full">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                <RechartsTooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="completion"
                  name="Tỷ lệ nộp bài (%)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="onTime"
                  name="Tỷ lệ đúng hạn (%)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
            <p className="mb-1 text-[0.84rem] font-bold text-[#0f172a]">Chưa có dữ liệu lịch sử theo dõi</p>
            <p className="text-xs text-slate-500">
              Biểu đồ sẽ tự động hiển thị tiến trình khi dữ liệu bài nộp được tích lũy theo từng chu kỳ đồng bộ Google Classroom.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
