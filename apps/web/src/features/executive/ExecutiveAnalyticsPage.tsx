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
      icon: <AssignmentTurnedInIcon sx={{ fontSize: 22 }} />,
      color: '#10b981',
      bg: '#ecfdf5'
    },
    {
      title: 'Tỷ lệ Nộp Đúng Hạn',
      value: k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%',
      delta: k?.onTimeRate?.delta || 'Nộp trước hạn chót',
      icon: <AutoStoriesIcon sx={{ fontSize: 22 }} />,
      color: '#2563eb',
      bg: '#eff6ff'
    },
    {
      title: 'Điểm Trung Bình (GPA)',
      value: k?.schoolGpa?.value != null && Number(k.schoolGpa.value) > 0 ? `${k.schoolGpa.value}/10` : '—',
      delta: k?.schoolGpa?.delta || 'Thang điểm 10 quy chuẩn',
      icon: <SchoolIcon sx={{ fontSize: 22 }} />,
      color: '#f59e0b',
      bg: '#fffbeb'
    },
    {
      title: 'Cảnh báo Đang Mở',
      value: `${k?.openAlerts?.value ?? 0}`,
      delta: k?.openAlerts?.delta || 'Chưa phát hiện vấn đề',
      icon: <WarningAmberIcon sx={{ fontSize: 22 }} />,
      color: '#ef4444',
      bg: '#fef2f2'
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
              sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 2, borderColor: '#cbd5e1', color: '#334155', '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe' } }}
            >
              Xuất CSV Lớp Học
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
              onClick={loadData}
              sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 2, borderColor: '#cbd5e1', color: '#334155', '&:hover': { bgcolor: '#f8fafc' } }}
            >
              Làm mới
            </Button>
          </Stack>
        }
      />

      {!isSynced && !loading && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2, border: '1px solid #bfdbfe', bgcolor: '#eff6ff', color: '#1e40af' }}
          action={
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/connections')}
              sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, fontSize: '0.8125rem', borderRadius: 2 }}
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
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)', bgcolor: '#ffffff' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {kpi.title}
                  </Typography>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: kpi.bg, color: kpi.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {kpi.icon}
                  </Box>
                </Box>
                {loading ? (
                  <Skeleton variant="text" width="50%" height={40} />
                ) : (
                  <Typography sx={{ fontSize: '1.85rem', fontWeight: 800, color: '#0f172a', my: 0.5, letterSpacing: '-0.03em' }}>
                    {kpi.value}
                  </Typography>
                )}
                <Chip
                  label={kpi.delta}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.72rem',
                    height: 22,
                    bgcolor: '#f8fafc',
                    color: '#64748b',
                    border: '1px solid #e2e8f0'
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Bảng Xếp Hạng & So Sánh Lớp Học Thực Tế */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px 0 rgba(15,23,42,0.04)', bgcolor: '#ffffff' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
              So Sánh Tiến Độ Học Tập Theo Lớp Hành Chính
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
              Tổng hợp từ tất cả các khóa học Google Classroom đã liên kết với từng lớp
            </Typography>
          </Box>
          <Chip
            label={`${classComparison.length} lớp học`}
            size="small"
            sx={{
              bgcolor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              fontWeight: 700,
              fontSize: '0.75rem',
              px: 0.5
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lớp</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Khối</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Sĩ số</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Số khóa học</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Bài tập đã giao</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tỷ lệ nộp bài</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Nộp đúng hạn</TableCell>
                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Điểm trung bình</TableCell>
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
                  <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2.5,
                        border: '1px solid #bfdbfe',
                        background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
                        color: '#2563eb',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2,
                        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.12)'
                      }}
                    >
                      <SchoolIcon sx={{ fontSize: 26 }} />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                      Chưa có dữ liệu lớp học để so sánh
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 460, mx: 'auto', mb: 2.5 }}>
                      Khi bạn đồng bộ Google Classroom, hệ thống sẽ tự động gộp các khóa học theo mã lớp (ví dụ: 6A1, 9A2) và xếp hạng tiến độ nộp bài.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<CloudSyncIcon sx={{ fontSize: 18 }} />}
                      onClick={() => navigate('/connections')}
                      sx={{ bgcolor: '#2563eb', color: '#ffffff', '&:hover': { bgcolor: '#1d4ed8' }, fontWeight: 700, fontSize: '0.84rem', textTransform: 'none', borderRadius: 2 }}
                    >
                      Kết Nối & Đồng Bộ Ngay
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                classComparison.map((item) => (
                  <TableRow key={item.id} hover sx={{ '&:hover': { bgcolor: 'rgba(239, 246, 255, 0.6) !important' } }}>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{item.className}</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>Khối {item.grade || '—'}</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{item.activeStudents || '—'}</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{item.courseCount || 0} khóa</TableCell>
                    <TableCell sx={{ color: '#64748b' }}>{item.totalCoursework || 0}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.completionRate || 0}
                          sx={{
                            flex: 1,
                            height: 7,
                            borderRadius: 3,
                            bgcolor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: (item.completionRate || 0) >= 80 ? '#10b981' : '#f59e0b'
                            }
                          }}
                        />
                        <Typography variant="caption" fontWeight={700} sx={{ color: '#0f172a' }}>
                          {item.completionRate || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: (item.onTimeRate || 0) >= 80 ? '#10b981' : '#f59e0b' }}>
                      {item.onTimeRate ? `${item.onTimeRate}%` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>
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
