import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Grid, Typography, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PendingActionsIcon from '@mui/icons-material/PendingActionsRounded';
import ListAltIcon from '@mui/icons-material/ListAltRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

interface IncidentStats {
  scope: string;
  byPriority: Record<string, number>;
  openCount: number;
  closedLast30d: number;
  overdue: unknown[];
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none' }}>
      <CardContent>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </Typography>
        <Typography variant="h3" fontWeight={800} sx={{ color, mt: 0.5 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="An toàn trường học"
        subtitle="Ghi nhận, phân loại và xử lý sự cố an toàn trường học"
        icon={<ShieldOutlinedIcon />}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="P0 - Khẩn cấp" value={stats?.byPriority.P0 ?? '—'} color="#dc2626" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="P1 - Cao" value={stats?.byPriority.P1 ?? '—'} color="#c2410c" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Đang mở" value={stats?.openCount ?? '—'} color="#2563eb" />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Đã đóng (30 ngày)" value={stats?.closedLast30d ?? '—'} color="#15803d" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', cursor: 'pointer' }} onClick={() => navigate('/safety/reports/pending')}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PendingActionsIcon sx={{ color: '#2563eb' }} />
              <Stack>
                <Typography fontWeight={700}>Tin báo chờ xử lý</Typography>
                <Typography variant="caption" color="text.secondary">Tin báo mới chưa chuyển thành hồ sơ</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: 'none', cursor: 'pointer' }} onClick={() => navigate('/safety/incidents')}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ListAltIcon sx={{ color: '#2563eb' }} />
              <Stack>
                <Typography fontWeight={700}>Hồ sơ sự cố</Typography>
                <Typography variant="caption" color="text.secondary">Toàn bộ hồ sơ đang/đã xử lý</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #fecaca', bgcolor: '#fef2f2', boxShadow: 'none', cursor: 'pointer' }} onClick={() => navigate('/safety/cockpit')}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <WarningAmberIcon sx={{ color: '#dc2626' }} />
              <Stack>
                <Typography fontWeight={700} color="#991b1b">Cần xử lý ngay</Typography>
                <Typography variant="caption" color="#991b1b">Hồ sơ mức P0/P1 đang mở</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Button variant="outlined" onClick={() => window.open('/safety/report', '_blank')}>
          Xem trang báo cáo công khai
        </Button>
      </Box>
    </Box>
  );
}
