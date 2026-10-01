import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardCheck, GraduationCap, TriangleAlert, BookOpenCheck, RotateCw, Download, RefreshCw } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function ExecutiveAnalyticsPage() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);
  const [classComparison, setClassComparison] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ov, cmp] = await Promise.all([
        api.get<any>('/api/analytics/overview').catch(() => null),
        api.get<{ items: any[] }>('/api/analytics/compare').catch(() => ({ items: [] }))
      ]);
      setOverview(ov);
      setClassComparison(cmp?.items || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const k = overview?.kpis;
  const isSynced = overview?.isSynced;

  const kpis = [
    {
      title: 'Tỷ lệ Hoàn thành Bài tập',
      value: k?.completionRate?.value != null ? `${k.completionRate.value}%` : '0%',
      delta: k?.completionRate?.delta || 'Từ Google Classroom',
      icon: <ClipboardCheck className="size-[22px]" />,
      color: 'text-emerald-500',
      bg: 'bg-emerald-50'
    },
    {
      title: 'Tỷ lệ Nộp Đúng Hạn',
      value: k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%',
      delta: k?.onTimeRate?.delta || 'Nộp trước hạn chót',
      icon: <BookOpenCheck className="size-[22px]" />,
      color: 'text-primary',
      bg: 'bg-secondary'
    },
    {
      title: 'Điểm Trung Bình (GPA)',
      value: k?.schoolGpa?.value != null && Number(k.schoolGpa.value) > 0 ? `${k.schoolGpa.value}/10` : '—',
      delta: k?.schoolGpa?.delta || 'Thang điểm 10 quy chuẩn',
      icon: <GraduationCap className="size-[22px]" />,
      color: 'text-amber-500',
      bg: 'bg-amber-50'
    },
    {
      title: 'Cảnh báo Đang Mở',
      value: `${k?.openAlerts?.value ?? 0}`,
      delta: k?.openAlerts?.delta || 'Chưa phát hiện vấn đề',
      icon: <TriangleAlert className="size-[22px]" />,
      color: 'text-red-500',
      bg: 'bg-red-50'
    }
  ];

  return (
    <>
      <PageHeader
        title="Báo cáo điều hành & phân tích chiến lược"
        action={
          <div className="flex gap-2.5">
            <Button variant="outline" size="sm" asChild className="font-semibold">
              <a href="/api/reports/classroom.csv" download="bao-cao-google-classroom.csv">
                <Download className="size-4" />
                Xuất CSV Lớp Học
              </a>
            </Button>
            <Button variant="outline" size="sm" onClick={loadData} className="font-semibold">
              <RefreshCw className="size-4" />
              Làm mới
            </Button>
          </div>
        }
      />

      {!isSynced && !loading && (
        <Alert className="mb-6 flex items-center justify-between border-blue-200 bg-secondary">
          <AlertDescription className="text-blue-900">
            <strong>Dữ liệu thực tế:</strong> Báo cáo BI được tạo hoàn toàn từ dữ liệu Google Classroom thực của trường. Hiện chưa có khóa học nào
            được đồng bộ.
          </AlertDescription>
          <Button size="sm" onClick={() => navigate('/connections')} className="shrink-0 font-bold">
            Kết Nối Google Classroom
          </Button>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[0.72rem] font-bold tracking-wide text-slate-500 uppercase">{kpi.title}</p>
              <div className={cn('grid size-9 place-items-center rounded-lg', kpi.bg, kpi.color)}>{kpi.icon}</div>
            </div>
            {loading ? (
              <Skeleton className="h-10 w-1/2" />
            ) : (
              <p className="my-1 text-[1.85rem] font-extrabold tracking-tight text-[#0f172a]">{kpi.value}</p>
            )}
            <Badge variant="outline" className="h-[22px] border-slate-200 bg-slate-50 font-semibold text-slate-500">
              {kpi.delta}
            </Badge>
          </div>
        ))}
      </div>

      {/* Bảng Xếp Hạng & So Sánh Lớp Học Thực Tế */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div>
            <p className="font-bold tracking-tight text-[#0f172a]">So Sánh Tiến Độ Học Tập Theo Lớp Hành Chính</p>
            <p className="text-[0.8125rem] text-slate-500">Tổng hợp từ tất cả các khóa học Google Classroom đã liên kết với từng lớp</p>
          </div>
          <Badge variant="outline" className="border-blue-200 bg-secondary font-bold text-[#1d4ed8]">
            {classComparison.length} lớp học
          </Badge>
        </div>

        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Lớp</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Khối</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Sĩ số</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Số khóa học</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Bài tập đã giao</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Tỷ lệ nộp bài</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Nộp đúng hạn</TableHead>
                <TableHead className="text-xs font-bold tracking-wide text-slate-600 uppercase">Điểm trung bình</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : classComparison.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="bg-slate-50 py-16 text-center">
                    <div className="mx-auto mb-4 inline-flex size-[52px] items-center justify-center rounded-xl border border-blue-200 bg-gradient-to-br from-secondary to-blue-100 text-primary shadow-[0_4px_10px_rgba(37,99,235,0.12)]">
                      <GraduationCap className="size-[26px]" />
                    </div>
                    <p className="mb-1 font-bold text-[#0f172a]">Chưa có dữ liệu lớp học để so sánh</p>
                    <p className="mx-auto mb-5 max-w-[460px] text-sm text-slate-500">
                      Khi bạn đồng bộ Google Classroom, hệ thống sẽ tự động gộp các khóa học theo mã lớp thực tế và xếp hạng tiến độ nộp bài.
                    </p>
                    <Button onClick={() => navigate('/connections')} className="font-bold">
                      <RotateCw className="size-[18px]" />
                      Kết Nối & Đồng Bộ Ngay
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                classComparison.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-bold text-[#0f172a]">{item.className}</TableCell>
                    <TableCell className="text-slate-500">Khối {item.grade || '—'}</TableCell>
                    <TableCell className="text-slate-500">{item.activeStudents || '—'}</TableCell>
                    <TableCell className="text-slate-500">{item.courseCount || 0} khóa</TableCell>
                    <TableCell className="text-slate-500">{item.totalCoursework || 0}</TableCell>
                    <TableCell className="min-w-40">
                      <div className="flex items-center gap-2.5">
                        <Progress
                          value={item.completionRate || 0}
                          className="h-1.5 flex-1 bg-slate-200"
                          indicatorClassName={(item.completionRate || 0) >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}
                        />
                        <span className="text-xs font-bold text-[#0f172a]">{item.completionRate || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('font-bold', (item.onTimeRate || 0) >= 80 ? 'text-emerald-500' : 'text-amber-500')}>
                      {item.onTimeRate ? `${item.onTimeRate}%` : '—'}
                    </TableCell>
                    <TableCell className="font-bold text-[#0f172a]">{item.avgScore != null ? `${item.avgScore}/10` : '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
