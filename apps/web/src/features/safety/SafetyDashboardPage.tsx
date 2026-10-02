import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ListChecks, TriangleAlert } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { MyIncidentsSection } from './components/MyIncidentsSection';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface IncidentStats {
  scope: string;
  byPriority: Record<string, number>;
  openCount: number;
  closedLast30d: number;
  overdue: unknown[];
}

function StatCard({ label, value, className }: { label: string; value: number | string; className: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn('mt-1 text-3xl font-bold', className)}>{value}</p>
    </div>
  );
}

export default function SafetyDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<IncidentStats | null>(null);

  useEffect(() => {
    api
      .get<IncidentStats>('/api/safety/stats/incidents')
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const openUrgentCount = stats ? (stats.byPriority.P0 || 0) + (stats.byPriority.P1 || 0) : null;

  return (
    <>
      <PageHeader title="Cảnh báo an toàn và xử lý sự cố" icon={<ShieldAlert />} />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="P0 - Khẩn cấp" value={stats?.byPriority.P0 ?? '—'} className="text-red-600" />
        <StatCard label="P1 - Cao" value={stats?.byPriority.P1 ?? '—'} className="text-orange-700" />
        <StatCard label="Đang mở" value={stats?.openCount ?? '—'} className="text-primary" />
        <StatCard label="Đã đóng (30 ngày)" value={stats?.closedLast30d ?? '—'} className="text-green-700" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

      <div className="my-6">
        <Button variant="outline" onClick={() => window.open('/safety/report', '_blank')}>
          Xem trang báo cáo công khai
        </Button>
      </div>

      <MyIncidentsSection />
    </>
  );
}
