import { useEffect, useState } from 'react';
import { Server, CheckCircle2, TriangleAlert, RefreshCw, CloudCheck, Database, ShieldCheck, ShieldAlert } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ServiceState = 'ONLINE' | 'ERROR' | 'NOT_CONFIGURED' | 'CHECKING';

interface ServiceStatus {
  name: string;
  category: string;
  status: ServiceState;
  desc: string;
  icon: React.ReactNode;
}

const STATE_LABEL: Record<ServiceState, string> = {
  ONLINE: 'Hoạt động',
  ERROR: 'Lỗi kết nối',
  NOT_CONFIGURED: 'Chưa cấu hình',
  CHECKING: 'Đang kiểm tra...'
};

const STATE_STYLE: Record<ServiceState, string> = {
  ONLINE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  ERROR: 'bg-red-50 text-red-700 border-red-200',
  NOT_CONFIGURED: 'bg-amber-50 text-amber-800 border-amber-200',
  CHECKING: 'bg-slate-100 text-slate-600 border-slate-200'
};

export default function SystemPage() {
  const [health, setHealth] = useState<{
    status: string;
    database: string;
    version: string;
    classroomSync?: 'ok' | 'not_configured' | 'stale' | 'error';
    clamav?: 'ok' | 'not_configured';
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const checkStatus = () => {
    setLoading(true);
    const start = performance.now();
    api<{ status: string; database: string; version: string; classroomSync?: 'ok' | 'not_configured' | 'stale' | 'error'; clamav?: 'ok' | 'not_configured' }>('/health')
      .then((res) => {
        setLatency(Math.round(performance.now() - start));
        setHealth(res);
        setCheckedAt(new Date());
      })
      .catch(() => {
        setLatency(null);
        setHealth(null);
        setCheckedAt(new Date());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const apiState: ServiceState = loading ? 'CHECKING' : health ? 'ONLINE' : 'ERROR';
  const dbState: ServiceState = loading ? 'CHECKING' : health?.database === 'ok' ? 'ONLINE' : 'ERROR';

  // Classroom sync + ClamAV: /health giờ tự kiểm tra thật ở backend (Sin
  // phát hiện 2026-09-25 khi rà soát trước bàn giao — bản cũ hiển thị cứng
  // "Chưa cấu hình" cho cả 2, viết từ lúc chưa cấu hình xong và không được
  // cập nhật lại, dù thực tế cả DWD lẫn clamav-daemon đã chạy thật trên
  // VPS từ lâu — xem health.routes.ts).
  const classroomSyncState: ServiceState =
    loading ? 'CHECKING' : health?.classroomSync === 'ok' ? 'ONLINE' : health?.classroomSync === 'stale' || health?.classroomSync === 'error' ? 'ERROR' : 'NOT_CONFIGURED';
  const clamavState: ServiceState = loading ? 'CHECKING' : health?.clamav === 'ok' ? 'ONLINE' : 'NOT_CONFIGURED';
  const classroomSyncDesc =
    health?.classroomSync === 'ok'
      ? 'Đã cấu hình Service Account ủy quyền toàn domain (DWD) — dữ liệu Học sinh/Giáo viên/Lớp học đồng bộ THẬT từ Google Classroom, lần gần nhất thành công trong 48 giờ qua.'
      : health?.classroomSync === 'stale'
        ? 'Đã cấu hình DWD nhưng lần đồng bộ thành công gần nhất đã quá 48 giờ — kiểm tra lại cron đồng bộ.'
        : health?.classroomSync === 'error'
          ? 'Đã cấu hình DWD nhưng lần đồng bộ gần nhất KHÔNG thành công — xem "Phiên đồng bộ" để biết chi tiết lỗi.'
          : 'Chưa cấu hình Service Account ủy quyền toàn domain (DWD) — dữ liệu Học sinh/Giáo viên/Lớp học đang là dữ liệu mẫu.';

  const services: ServiceStatus[] = [
    {
      name: 'Backend API',
      category: 'Dịch vụ lõi',
      status: apiState,
      desc: 'Node.js + Express, xử lý toàn bộ endpoint REST và xác thực. Kiểm tra bằng cách gọi thật /health.',
      icon: <CloudCheck className="size-5 text-primary" />
    },
    {
      name: 'Cơ sở dữ liệu PostgreSQL',
      category: 'Database',
      status: dbState,
      desc: 'PostgreSQL tự host trên VPS. Kiểm tra bằng truy vấn "select 1" thật.',
      icon: <Database className="size-5 text-emerald-500" />
    },
    {
      name: 'Đồng bộ Google Classroom (DWD)',
      category: 'Tích hợp Google Workspace',
      status: classroomSyncState,
      desc: classroomSyncDesc,
      icon: <ShieldCheck className="size-5 text-slate-400" />
    },
    {
      name: 'Quét mã độc minh chứng (ClamAV)',
      category: 'Bảo mật module An toàn',
      status: clamavState,
      desc:
        clamavState === 'ONLINE'
          ? 'clamd đang chạy thật trên VPS (clamav-daemon) — file minh chứng tải lên được quét mã độc thật trước khi lưu.'
          : 'clamd CHƯA được cài/chạy ở môi trường này, nên file minh chứng tải lên vẫn kẹt ở trạng thái "chờ quét".',
      icon: <ShieldAlert className="size-5 text-slate-400" />
    }
  ];

  const allCoreOk = apiState === 'ONLINE' && dbState === 'ONLINE';
  const notConfiguredCount = services.filter((s) => s.status === 'NOT_CONFIGURED').length;

  return (
    <>
      <PageHeader
        title="Tình trạng hệ thống"
        icon={<Server />}
        action={
          <Button onClick={checkStatus} disabled={loading} className="rounded-lg shadow-[0_2px_6px_rgba(37,99,235,0.2)]">
            <RefreshCw className="size-4" />
            Kiểm tra kết nối
          </Button>
        }
      />

      {/* Main Health Banner */}
      <div
        className={cn(
          'mb-6 rounded-xl border border-white/30 p-6 text-white shadow-[0_4px_16px_rgba(37,99,235,0.2)]',
          allCoreOk ? 'bg-gradient-to-br from-[#1e40af] via-primary to-[#3b82f6]' : 'bg-gradient-to-br from-[#b45309] via-[#d97706] to-[#f59e0b]'
        )}
      >
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="md:basis-2/3">
            <div className="mb-1.5 flex items-center gap-2.5">
              <span
                className={cn(
                  'inline-block size-3 rounded-full border-2 border-white',
                  allCoreOk ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : 'bg-amber-400 shadow-[0_0_12px_#fbbf24]'
                )}
              />
              <p className="text-[1.05rem] font-bold tracking-tight">
                {allCoreOk ? 'Backend & cơ sở dữ liệu đang hoạt động bình thường' : 'Backend hoặc cơ sở dữ liệu đang gặp sự cố'}
              </p>
            </div>
            <p className="text-sm text-blue-100">
              Đang chạy trên VPS thật (production)
              {notConfiguredCount > 0 && ` • ${notConfiguredCount} tích hợp chưa cấu hình (xem bên dưới)`}
              {checkedAt && ` • Kiểm tra lúc ${checkedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
          <div className="md:basis-1/3 md:text-right">
            <Badge variant="outline" className="bg-white/15 text-white backdrop-blur-sm">
              {health?.version ? `Phiên bản backend ${health.version}` : 'Không lấy được phiên bản'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Service Cards Grid */}
      <p className="mb-2 font-bold tracking-tight text-[#0f172a]">Các dịch vụ thành phần</p>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {services.map((svc) => {
          const st = STATE_STYLE[svc.status];
          return (
            <div
              key={svc.name}
              className="h-full rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)] transition-all hover:border-blue-200 hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)]"
            >
              <div className="mb-2.5 flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="grid place-items-center rounded-[10px] bg-secondary p-2.5">{svc.icon}</div>
                  <div>
                    <p className="text-sm font-bold text-[#0f172a]">{svc.name}</p>
                    <p className="text-xs text-slate-500">{svc.category}</p>
                  </div>
                </div>
                <Badge variant="outline" className={cn('h-[22px] gap-1 font-semibold', st)}>
                  {svc.status === 'ONLINE' ? <CheckCircle2 className="size-[13px]" /> : <TriangleAlert className="size-[13px]" />}
                  {STATE_LABEL[svc.status]}
                </Badge>
              </div>
              <p className="text-sm text-slate-500">{svc.desc}</p>
              {svc.name === 'Backend API' && latency !== null && (
                <p className="mt-3.5 border-t border-slate-100 pt-3.5 text-xs text-slate-500">
                  Độ trễ phản hồi thật: <strong className="text-[#0f172a]">{latency}ms</strong>
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Configuration Metadata */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <p className="mb-4 font-bold tracking-tight text-[#0f172a]">Cấu hình môi trường thật</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <p className="text-xs font-medium text-slate-500">Nơi chạy backend</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">VPS (systemd, /opt/supperapp)</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Cơ sở dữ liệu</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">PostgreSQL tự host</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Xác thực đăng nhập</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">Firebase Authentication (Google + email/mật khẩu)</p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500">Phiên bản backend</p>
            <p className="mt-1 text-sm font-semibold text-[#0f172a]">{health?.version || 'Không xác định được'}</p>
          </div>
        </div>
      </div>
    </>
  );
}
