import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Chip,
  Button
} from '@mui/material';
import DnsIcon from '@mui/icons-material/DnsRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import CloudDoneIcon from '@mui/icons-material/CloudDoneRounded';
import StorageIcon from '@mui/icons-material/StorageRounded';
import SecurityIcon from '@mui/icons-material/SecurityRounded';
import GppMaybeIcon from '@mui/icons-material/GppMaybeRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

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

const STATE_STYLE: Record<ServiceState, { bg: string; color: string; border: string }> = {
  ONLINE: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
  ERROR: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  NOT_CONFIGURED: { bg: '#fffbeb', color: '#b45309', border: '#fde68a' },
  CHECKING: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
};

export default function SystemPage() {
  const [health, setHealth] = useState<{ status: string; database: string; version: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const checkStatus = () => {
    setLoading(true);
    const start = performance.now();
    api<{ status: string; database: string; version: string }>('/health')
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

  // Hai dịch vụ dưới đây KHÔNG có cách kiểm tra thật từ trình duyệt (không
  // gọi API nào xác nhận được) — hiện đang thật sự CHƯA cấu hình, không
  // phải lỗi tạm thời, nên hiển thị cứng "Chưa cấu hình" thay vì giả vờ
  // gọi kiểm tra rồi báo "Hoạt động" sai sự thật như bản cũ.
  const services: ServiceStatus[] = [
    {
      name: 'Backend API',
      category: 'Dịch vụ lõi',
      status: apiState,
      desc: 'Node.js + Express, xử lý toàn bộ endpoint REST và xác thực. Kiểm tra bằng cách gọi thật /health.',
      icon: <CloudDoneIcon sx={{ color: '#2563eb' }} />
    },
    {
      name: 'Cơ sở dữ liệu PostgreSQL',
      category: 'Database',
      status: dbState,
      desc: 'PostgreSQL tự host — hiện chạy trên máy cục bộ, chưa chuyển lên VPS. Kiểm tra bằng truy vấn "select 1" thật.',
      icon: <StorageIcon sx={{ color: '#10b981' }} />
    },
    {
      name: 'Đồng bộ Google Classroom (DWD)',
      category: 'Tích hợp Google Workspace',
      status: 'NOT_CONFIGURED',
      desc: 'Chưa cấu hình Service Account ủy quyền toàn domain lẫn OAuth cá nhân — dữ liệu Học sinh/Giáo viên/Lớp học/Điểm danh/Meet hiện là DỮ LIỆU MẪU, chưa phải dữ liệu thật của trường.',
      icon: <SecurityIcon sx={{ color: '#94a3b8' }} />
    },
    {
      name: 'Quét mã độc minh chứng (ClamAV)',
      category: 'Bảo mật module An toàn',
      status: 'NOT_CONFIGURED',
      desc: 'Đã có sẵn code gọi ClamAV daemon thật (clamscan) chạy cùng máy chủ API — nhưng clamd CHƯA được cài/chạy ở môi trường này, nên file minh chứng tải lên vẫn kẹt ở trạng thái "chờ quét". Sẽ tự hoạt động khi VPS cài clamav-daemon.',
      icon: <GppMaybeIcon sx={{ color: '#94a3b8' }} />
    }
  ];

  const allCoreOk = apiState === 'ONLINE' && dbState === 'ONLINE';
  const notConfiguredCount = services.filter((s) => s.status === 'NOT_CONFIGURED').length;

  return (
    <>
      <PageHeader
        title="Tình trạng hệ thống — THCS Giảng Võ"
        subtitle="Trạng thái thật của backend, cơ sở dữ liệu và các tích hợp — không phải số liệu minh hoạ"
        icon={<DnsIcon />}
        action={
          <Button
            variant="contained"
            startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
            onClick={checkStatus}
            disabled={loading}
            sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '8px', boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)' }}
          >
            Kiểm tra kết nối
          </Button>
        }
      />

      {/* Main Health Banner */}
      <Card sx={{
        mb: 3,
        background: allCoreOk
          ? 'linear-gradient(135deg, #1e40af 0%, #2563eb 60%, #3b82f6 100%)'
          : 'linear-gradient(135deg, #b45309 0%, #d97706 60%, #f59e0b 100%)',
        color: '#ffffff',
        borderRadius: '12px',
        border: '1px solid rgba(255,255,255,0.3)',
        boxShadow: '0 4px 16px rgba(37, 99, 235, 0.2)'
      }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: allCoreOk ? '#34d399' : '#fbbf24',
                    boxShadow: allCoreOk ? '0 0 12px #34d399' : '0 0 12px #fbbf24',
                    border: '2px solid #ffffff'
                  }}
                />
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#ffffff', letterSpacing: '-0.01em', fontSize: '1.05rem' }}>
                  {allCoreOk
                    ? 'Backend & cơ sở dữ liệu đang hoạt động bình thường'
                    : 'Backend hoặc cơ sở dữ liệu đang gặp sự cố'}
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#dbeafe', fontSize: '0.8125rem' }}>
                Chạy cục bộ (local) — chưa triển khai lên VPS/máy chủ thật
                {notConfiguredCount > 0 && ` • ${notConfiguredCount} tích hợp chưa cấu hình (xem bên dưới)`}
                {checkedAt && ` • Kiểm tra lúc ${checkedAt.toLocaleTimeString('vi-VN')}`}
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Chip
                label={health?.version ? `Phiên bản backend ${health.version}` : 'Không lấy được phiên bản'}
                size="small"
                sx={{ bgcolor: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(4px)', color: '#ffffff', border: '1px solid rgba(255, 255, 255, 0.3)', fontWeight: 600, fontSize: '0.75rem' }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Service Cards Grid */}
      <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 2, letterSpacing: '-0.01em' }}>
        Các dịch vụ thành phần
      </Typography>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {services.map((svc) => {
          const st = STATE_STYLE[svc.status];
          return (
            <Grid key={svc.name} size={{ xs: 12, md: 6 }}>
              <Card sx={{
                height: '100%',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                bgcolor: '#ffffff',
                transition: 'all 0.2s ease',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                  borderColor: '#bfdbfe'
                }
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ p: 1.25, bgcolor: '#eff6ff', borderRadius: '10px', display: 'grid', placeItems: 'center' }}>
                        {svc.icon}
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a' }}>
                          {svc.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {svc.category}
                        </Typography>
                      </Box>
                    </Box>
                    <Chip
                      icon={
                        svc.status === 'ONLINE' ? (
                          <CheckCircleIcon sx={{ fontSize: '13px !important' }} />
                        ) : (
                          <WarningAmberIcon sx={{ fontSize: '13px !important' }} />
                        )
                      }
                      label={STATE_LABEL[svc.status]}
                      size="small"
                      sx={{ bgcolor: st.bg, color: st.color, border: `1px solid ${st.border}`, fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                    />
                  </Box>
                  <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
                    {svc.desc}
                  </Typography>
                  {svc.name === 'Backend API' && latency !== null && (
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.5, pt: 1.5, borderTop: '1px solid #f1f5f9', color: 'text.secondary' }}>
                      Độ trễ phản hồi thật: <strong style={{ color: '#0f172a' }}>{latency}ms</strong>
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Configuration Metadata */}
      <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 2, letterSpacing: '-0.01em' }}>
            Cấu hình môi trường thật
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Nơi chạy backend</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a', mt: 0.5 }}>Máy cục bộ (chưa triển khai VPS)</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Cơ sở dữ liệu</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a', mt: 0.5 }}>PostgreSQL tự host</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Xác thực đăng nhập</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a', mt: 0.5 }}>Firebase Authentication (Google + email/mật khẩu)</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Phiên bản backend</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a', mt: 0.5 }}>{health?.version || 'Không xác định được'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </>
  );
}
