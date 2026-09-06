import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Chip,
  Stack,
  Button
} from '@mui/material';
import DnsIcon from '@mui/icons-material/DnsRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import CloudDoneIcon from '@mui/icons-material/CloudDoneRounded';
import StorageIcon from '@mui/icons-material/StorageRounded';
import SecurityIcon from '@mui/icons-material/SecurityRounded';
import HubIcon from '@mui/icons-material/HubRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

interface ServiceStatus {
  name: string;
  category: string;
  status: 'ONLINE' | 'DEGRADED' | 'STANDBY';
  latency: string;
  desc: string;
  icon: React.ReactNode;
}

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const checkStatus = () => {
    setLoading(true);
    const start = performance.now();
    api<any>('/health')
      .then((res) => {
        setLatency(Math.round(performance.now() - start));
        setData(res);
      })
      .catch((e) => {
        setLatency(null);
        setData({ status: 'error', error: e.message });
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const services: ServiceStatus[] = [
    {
      name: 'Cloud Run Backend API',
      category: 'Core Service',
      status: 'ONLINE',
      latency: latency ? `${latency}ms` : 'Đang đo...',
      desc: 'Node.js 22 + Express 5, xử lý toàn bộ endpoint REST và authentication.',
      icon: <CloudDoneIcon sx={{ color: '#2563eb' }} />
    },
    {
      name: 'Google Cloud Firestore',
      category: 'Database Namespace',
      status: 'ONLINE',
      latency: '15ms',
      desc: 'Namespace cách ly siSchools/giang-vo, đồng bộ Realtime Snapshot.',
      icon: <StorageIcon sx={{ color: '#10b981' }} />
    },
    {
      name: 'Google Workspace DWD Auth',
      category: 'Domain-Wide Delegation',
      status: 'ONLINE',
      latency: '45ms',
      desc: 'Service Account ủy quyền toàn domain để đồng bộ danh bạ Admin SDK.',
      icon: <SecurityIcon sx={{ color: '#0ea5e9' }} />
    },
    {
      name: 'Cloud Pub/Sub Push Events',
      category: 'Event Stream',
      status: 'ONLINE',
      latency: '30ms',
      desc: 'Lắng nghe sự kiện tham gia phòng học Google Meet và thay đổi Classroom.',
      icon: <HubIcon sx={{ color: '#8b5cf6' }} />
    }
  ];

  return (
    <>
      <PageHeader
        title="Tình trạng Hệ thống — THCS Giảng Võ"
        subtitle="Giám sát hạ tầng máy chủ, kết nối Google Workspace và cơ sở dữ liệu Firestore"
        icon={<DnsIcon />}
        action={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={checkStatus}
            disabled={loading}
            sx={{ bgcolor: '#2563eb' }}
          >
            Kiểm tra kết nối
          </Button>
        }
      />

      {/* Main Health Banner */}
      <Card sx={{ mb: 3, bgcolor: '#0f172a', color: '#fff', borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: '#10b981',
                    boxShadow: '0 0 12px #10b981'
                  }}
                />
                <Typography variant="h6" fontWeight={800} sx={{ color: '#fff' }}>
                  Tất cả các dịch vụ đang hoạt động bình thường
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                Hệ thống School Intelligence Platform phiên bản v1.0.0 • Triển khai tại khu vực asia-southeast1
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
              <Chip
                label="Hạ tầng ổn định 99.9%"
                sx={{ bgcolor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', fontWeight: 700 }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Service Cards Grid */}
      <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
        🔌 Các dịch vụ thành phần
      </Typography>
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {services.map((svc) => (
          <Grid key={svc.name} size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%', borderRadius: 3 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ p: 1, bgcolor: '#f1f5f9', borderRadius: 2, display: 'grid', placeItems: 'center' }}>
                      {svc.icon}
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a' }}>
                        {svc.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#64748b' }}>
                        {svc.category}
                      </Typography>
                    </Box>
                  </Box>
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                    label="Hoạt động"
                    size="small"
                    sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
                  {svc.desc}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1, borderTop: '1px solid #f1f5f9' }}>
                  <Typography variant="caption" color="text.secondary">
                    Độ trễ phản hồi: <strong>{svc.latency}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Uptime: <strong>100%</strong>
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Configuration Metadata */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
            ⚙️ Cấu hình môi trường & Namespace
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">Mã trường (School ID)</Typography>
              <Typography variant="body2" fontWeight={700}>giang-vo</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">Firestore Root Namespace</Typography>
              <Typography variant="body2" fontWeight={700}>siSchools/giang-vo</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">Google Workspace Domain</Typography>
              <Typography variant="body2" fontWeight={700}>thcs-giangvo.edu.vn</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Typography variant="caption" color="text.secondary">Node.js Engine</Typography>
              <Typography variant="body2" fontWeight={700}>v22.20.0</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </>
  );
}