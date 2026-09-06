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
      icon: <AssignmentTurnedInIcon color="success" sx={{ fontSize: 32 }} />,
      color: '#16a34a'
    },
    {
      title: 'Tỷ lệ Nộp Đúng Hạn',
      value: k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%',
      delta: k?.onTimeRate?.delta || 'Nộp trước hạn chót',
      icon: <AutoStoriesIcon color="primary" sx={{ fontSize: 32 }} />,
      color: '#2563eb'
    },
    {
      title: 'Điểm Trung Bình (GPA)',
      value: k?.schoolGpa?.value != null && Number(k.schoolGpa.value) > 0 ? `${k.schoolGpa.value}/10` : '—',
      delta: k?.schoolGpa?.delta || 'Thang điểm 10 quy chuẩn',
      icon: <SchoolIcon color="secondary" sx={{ fontSize: 32 }} />,
      color: '#7c3aed'
    },
    {
      title: 'Cảnh báo Đang Mở',
      value: `${k?.openAlerts?.value ?? 0}`,
      delta: k?.openAlerts?.delta || 'Chưa phát hiện vấn đề',
      icon: <WarningAmberIcon color="error" sx={{ fontSize: 32 }} />,
      color: '#dc2626'
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
              startIcon={<DownloadIcon />}
              component="a"
              href="/api/reports/classroom.csv"
              download="bao-cao-google-classroom.csv"
              sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#334155', fontWeight: 600 }}
            >
              Xuất CSV Lớp Học
            </Button>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadData}
              sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#334155', fontWeight: 600 }}
            >
              Làm mới
            </Button>
          </Stack>
        }
      />

      {!isSynced && !loading && (
        <Alert
          severity="info"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button
              color="primary"
              variant="contained"
              size="small"
              onClick={() => navigate('/connections')}
              sx={{ textTransform: 'none', fontWeight: 700 }}
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
            <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={700}>
                    {kpi.title}
                  </Typography>
                  {kpi.icon}
                </Box>
                {loading ? (
                  <Skeleton variant="text" width="50%" height={48} />
                ) : (
                  <Typography variant="h4" fontWeight={900} sx={{ my: 0.5, color: '#0f172a' }}>
                    {kpi.value}
                  </Typography>
                )}
                <Chip
                  label={kpi.delta}
                  size="small"
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    bgcolor: '#f8fafc',
                    color: '#475569',
                    border: '1px solid #e2e8f0'
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Bảng Xếp Hạng & So Sánh Lớp Học Thực Tế */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <Box sx={{ p: 2.5, borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
              So Sánh Tiến Độ Học Tập Theo Lớp Hành Chính
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tổng hợp từ tất cả các khóa học Google Classroom đã liên kết với từng lớp
            </Typography>
          </Box>
          <Chip label={`${classComparison.length} lớp học`} size="small" color="primary" sx={{ fontWeight: 700 }} />
        </Box>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Lớp</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Khối</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Sĩ số</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Số khóa học</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Bài tập đã giao</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Tỷ lệ nộp bài</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Nộp đúng hạn</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#334155' }}>Điểm trung bình</TableCell>
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
                  <TableCell colSpan={8} sx={{ py: 8, textAlign: 'center' }}>
                    <Box sx={{ color: '#94a3b8', fontSize: '2.5rem', mb: 1.5 }}>📊</Box>
                    <Typography variant="h6" fontWeight={700} color="#1e293b" sx={{ mb: 0.5 }}>
                      Chưa có dữ liệu lớp học để so sánh
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', mb: 2.5 }}>
                      Khi bạn đồng bộ Google Classroom, hệ thống sẽ tự động gộp các khóa học theo mã lớp (ví dụ: 6A1, 9A2) và xếp hạng tiến độ nộp bài.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<CloudSyncIcon />}
                      onClick={() => navigate('/connections')}
                      sx={{ bgcolor: '#2563eb', fontWeight: 700 }}
                    >
                      Kết Nối & Đồng Bộ Ngay
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                classComparison.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{item.className}</TableCell>
                    <TableCell>Khối {item.grade || '—'}</TableCell>
                    <TableCell>{item.activeStudents || '—'}</TableCell>
                    <TableCell>{item.courseCount || 0} khóa</TableCell>
                    <TableCell>{item.totalCoursework || 0}</TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <LinearProgress
                          variant="determinate"
                          value={item.completionRate || 0}
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: '#f1f5f9',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: (item.completionRate || 0) >= 80 ? '#16a34a' : '#ea580c'
                            }
                          }}
                        />
                        <Typography variant="caption" fontWeight={700}>
                          {item.completionRate || 0}%
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, color: (item.onTimeRate || 0) >= 80 ? '#16a34a' : '#ea580c' }}>
                      {item.onTimeRate ? `${item.onTimeRate}%` : '—'}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
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
