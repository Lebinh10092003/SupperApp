import { useEffect, useState } from 'react';
import { ShieldCheck, CloudCog, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function DataQualityPage() {
  const navigate = useNavigate();
  const [d, setD] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    api<any>('/api/data-quality')
      .then((res) => {
        setD(res || null);
      })
      .catch(() => {
        setD(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const score = d?.score ?? 0;
  const components = d?.components || {};
  const issues = d?.issues || [];

  const getScoreColor = (sc: number) => {
    if (sc >= 85) return 'text-emerald-500';
    if (sc >= 60) return 'text-amber-500';
    return 'text-red-500';
  };
  const getScoreBarColor = (sc: number) => {
    if (sc >= 85) return 'bg-emerald-500';
    if (sc >= 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <>
      <PageHeader
        title="Chất lượng dữ liệu"
        icon={<ShieldCheck />}
        action={
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="size-4" />
            Làm mới
          </Button>
        }
      />

      {score === 0 && !loading && (
        <Alert className="mb-6 flex items-center justify-between rounded-lg border-blue-200 bg-secondary">
          <div>
            <AlertTitle className="sr-only">Dữ liệu thực</AlertTitle>
            <AlertDescription className="text-slate-700">
              <strong>Dữ liệu thực:</strong> Điểm chất lượng được tính tự động dựa trên mức độ hoàn thiện của danh bạ, danh sách lớp và liên kết khóa học Google Classroom. Hiện tại chưa có dữ liệu đồng bộ.
            </AlertDescription>
          </div>
          <Button size="sm" onClick={() => navigate('/connections')} className="shrink-0">
            Đồng Bộ Classroom
          </Button>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Overall Score Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] md:col-span-4">
          <p className="text-xs font-medium text-slate-500">Chỉ số chất lượng toàn diện</p>
          <div className="my-6">
            {loading ? (
              <Skeleton className="mx-auto size-20 rounded-full" />
            ) : (
              <>
                <p className={cn('text-[3.5rem] leading-none font-extrabold tracking-tight', getScoreColor(score))}>{score}</p>
                <p className="mt-1 text-sm text-slate-500">/ 100 Điểm</p>
              </>
            )}
          </div>
          <Progress value={score} className="h-1.5 bg-slate-100" indicatorClassName={getScoreBarColor(score)} />
          <p className="mt-4 text-sm text-slate-500">
            {score >= 85
              ? 'Dữ liệu trường học đạt chuẩn độ chính xác cao'
              : score > 0
                ? 'Dữ liệu đang được đồng bộ và cần bổ sung ánh xạ'
                : 'Chưa có dữ liệu để đánh giá chất lượng'}
          </p>
        </div>

        {/* Component Metrics Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] md:col-span-8">
          <p className="mb-5 font-bold tracking-tight text-[#0f172a]">Phân tích thành phần chất lượng thực tế</p>
          <div className="flex flex-col gap-5">
            {[
              { label: 'Độ đầy đủ Danh sách Học viên (Roster Completeness)', key: 'completeness' },
              { label: 'Tỷ lệ Ánh xạ Lớp học Hành chính (Class Mapping)', key: 'coverage' },
              { label: 'Đồng bộ Danh bạ Người dùng (Directory Users)', key: 'directory' },
              { label: 'Tính nhất quán và Tính toàn vẹn (Data Consistency)', key: 'consistency' }
            ].map(({ label, key }) => {
              const val = Number(components[key] || 0);
              return (
                <div key={key}>
                  <div className="mb-1.5 flex justify-between">
                    <p className="text-sm font-medium text-[#0f172a]">{label}</p>
                    <p className={cn('text-sm font-semibold', val >= 80 ? 'text-emerald-500' : 'text-primary')}>{val}%</p>
                  </div>
                  <Progress value={val} className="h-1.5 bg-slate-100" indicatorClassName={val >= 80 ? 'bg-emerald-500' : 'bg-primary'} />
                </div>
              );
            })}
          </div>
        </div>

        {/* Issues List */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)] md:col-span-12">
          <p className="mb-4 font-bold tracking-tight text-[#0f172a]">Các điểm cần chuẩn hóa dữ liệu ({issues.length})</p>
          {issues.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Không có vấn đề bất thường nào về chất lượng dữ liệu.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {issues.map((iss: any, i: number) => (
                <Alert
                  key={iss.id || i}
                  className={cn(
                    'rounded-md',
                    iss.severity === 'CRITICAL'
                      ? 'border-red-200 bg-red-50'
                      : iss.severity === 'WARNING'
                        ? 'border-amber-200 bg-amber-50'
                        : 'border-blue-200 bg-secondary'
                  )}
                >
                  <AlertTitle className="font-semibold">{iss.message || iss.type}</AlertTitle>
                  {iss.entity && <AlertDescription className="text-zinc-500">Khóa học / Thực thể: {iss.entity}</AlertDescription>}
                </Alert>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
