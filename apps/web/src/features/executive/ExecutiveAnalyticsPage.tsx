import { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Button,
  Stack,
  Alert,
  Skeleton,
  LinearProgress
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

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
      icon: <AssignmentTurnedInIcon sx={{ fontSize: 20, color: '#18181b' }} />
    },
    {
      title: 'Tỷ lệ Nộp Đúng Hạn',
      value: k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%',
      delta: k?.onTimeRate?.delta || 'Nộp trước hạn chót',
      icon: <AutoStoriesIcon sx={{ fontSize: 20, color: '#18181b' }} />
    },
    {
      title: 'Điểm Trung Bình (GPA)',
      value: k?.schoolGpa?.value != null && Number(k.schoolGpa.value) > 0 ? `${k.schoolGpa.value}/10` : '—',
      delta: k?.schoolGpa?.delta || 'Thang điểm 10 quy chuẩn',
      icon: <SchoolIcon sx={{ fontSize: 20, color: '#18181b' }} />
    },
    {
      title: 'Cảnh báo Đang Mở',
      value: `${k?.openAlerts?.value ?? 0}`,
      delta: k?.openAlerts?.delta || 'Chưa phát hiện vấn đề',
      icon: <WarningAmberIcon sx={{ fontSize: 20, color: '#18181b' }} />
    }
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Báo Cáo Điều Hành & Phân Tích Chiến Lược (Executive BI)"
        subtitle="Tổng quan tiến độ số hóa, chất lượng học tập và năng lực thực thi toàn trường từ Google Classroom"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              component="a"
              href="/api/reports/classroom.csv"
              download="bao-cao-google-classroom.csv"
              sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '6px' }}
            >
              Xuất CSV Lớp Học
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={loadData}
              sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '6px' }}
            >
              Làm mới
            </Button>
          </Stack>
        }
      />

      {!isSynced && !loading && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: '6px' }}
          action={
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/connections')}
              sx={{ bgcolor: '#18181b', color: '#ffffff', '&:hover': { bgcolor: '#27272a' }, textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: '6px' }}
            >
              Kết Nối Google Classroom
            </Button>
          }
        >
          <strong>Dữ liệu thực tế:</strong> Báo cáo BI được tạo hoàn toàn từ dữ liệu Google Classroom thực của trường. Hiện chưa có khóa học nào được đồng bộ.
        </Alert>
      )}

      {/* KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {kpis.map((kpi, idx) => (
          <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {kpi.title}
                  </Typography>
                  <Box sx={{ color: '#71717a', display: 'flex', alignItems: 'center' }}>
                    {kpi.icon}
                  </Box>
                </Box>
                {loading ? (
                  <Skeleton variant="text" width="50%" height={40} />
                ) : (
                  <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090b', my: 0.5, letterSpacing: '-0.025em' }}>
                    {kpi.value}
                  </Typography>
                )}
                <Chip
                  label={kpi.delta}
                  size="small"
                  sx={{
                    fontWeight: 500,
                    fontSize: '0.7rem',
                    height: 20,
                    bgcolor: '#f4f4f5',
                    color: '#71717a',
                    border: '1px solid #e4e4e7'
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Bảng Xếp Hạng & So Sánh Lớp Học Thực Tế */}
      <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', overflow: 'hidden', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e4e4e7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#09090b', letterSpacing: '-0.01em' }}>
              So Sánh Tiến Độ Học Tập Theo Lớp Hành Chính
            </Typography>
            <Typography variant="body2" sx={{ color: '#71717a', fontSize: '0.8125rem' }}>
              Tổng hợp từ tất cả các khóa học Google Classroom đã liên kết với từng lớp
            </Typography>
          </Box>
          <Chip
            label={`${classComparison.length} lớp học`}
            size="small"
            sx={{
              bgcolor: '#f4f4f5',
              color: '#18181b',
              border: '1px solid #e4e4e7',
              fontWeight: 600,
              fontSize: '0.75rem'
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#fcfcfd' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lớp</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Khối</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sĩ số</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Số khóa học</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bài tập đã giao</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ lệ nộp bài</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nộp đúng hạn</TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Điểm trung bình</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton variant="text" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : classComparison.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', bgcolor: '#fafafa' }}>
                    <Box sx={{ color: '#a1a1aa', fontSize: '2.5rem', mb: 1.5 }}>📊</Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#09090b" sx={{ mb: 0.5 }}>
                      Chưa có dữ liệu lớp học để so sánh
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', mb: 2.5 }}>
                      Khi bạn đồng bộ Google Classroom, hệ thống sẽ tự động gộp các khóa học theo mã lớp (ví dụ: 6A1, 9A2) và xếp hạng tiến độ nộp bài.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<CloudSyncIcon sx={{ fontSize: 16 }} />}
                      onClick={() => navigate('/connections')}
                      sx={{ bgcolor: '#18181b', color: '#ffffff', '&:hover': { bgcolor: '#27272a' }, fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '6px' }}
                    >
                      Kết Nối & Đồng Bộ Ngay
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                classComparison.map((item) => (
                  <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: '#f4f4f5' } }}>
                    <TableCell sx={{ fontWeight: 600, color: '#09090b' }}>{item.className}</TableCell>
                    <TableCell sx={{ color: '#71717a' }}>Khối {item.grade || '—'}</TableCell>
                    <TableCell sx={{ color: '#71717a' }}>{item.activeStudents || '—'}</TableCell>
                    <TableCell sx={{ color: '#71717a' }}>{item.courseCount || 0} khóa</TableCell>
                    <TableCell sx={{ color: '#71717a' }}>{item.totalCoursework || 0}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.completionRate || 0}
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: '#e4e4e7',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: (item.completionRate || 0) >= 80 ? '#10b981' : '#f59e0b'
                            }
                          }}
                        />
                        <Typography variant="caption" fontWeight={600} sx={{ color: '#09090b' }}>
                          {item.completionRate || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: (item.onTimeRate || 0) >= 80 ? '#10b981' : '#f59e0b' }}>
                      {item.onTimeRate ? `${item.onTimeRate}%` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#09090b' }}>
                      {item.avgScore != null ? `${item.avgScore}/10` : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
