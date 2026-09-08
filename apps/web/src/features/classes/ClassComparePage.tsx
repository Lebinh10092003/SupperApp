import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  Stack,
  Tabs,
  Tab,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Tooltip,
  IconButton,
  Divider,
  Alert
} from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import EmojiEventsIcon from '@mui/icons-material/EmojiEventsRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTimeRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import SwapHorizIcon from '@mui/icons-material/SwapHorizRounded';
import FileDownloadIcon from '@mui/icons-material/FileDownloadRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function ClassComparePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Head-to-head Duel state
  const [classAId, setClassAId] = useState<string>('');
  const [classBId, setClassBId] = useState<string>('');
  const [duelData, setDuelData] = useState<any>(null);
  const [duelLoading, setDuelLoading] = useState(false);

  // 1. Tải toàn bộ danh sách lớp và chuẩn so sánh
  const loadClasses = async () => {
    try {
      setLoading(true);
      const res = await api<any>('/api/classes');
      const items = res?.items || [];
      setClasses(items);
      if (items.length >= 2) {
        setClassAId(items[0].classId || items[0].id);
        setClassBId(items[1].classId || items[1].id);
      } else if (items.length === 1) {
        setClassAId(items[0].classId || items[0].id);
        setClassBId('');
      } else {
        setClassAId('');
        setClassBId('');
      }
    } catch (e) {
      console.error('Lỗi tải danh sách lớp:', e);
    } finally {
      setLoading(false);
    }
  };

  // 2. Tải phân tích đối đầu 1 vs 1 khi đổi lớp A hoặc B
  const loadDuel = async (aId: string, bId: string) => {
    if (!aId || !bId) return;
    try {
      setDuelLoading(true);
      const res = await api<any>(`/api/classes/duel?classA=${encodeURIComponent(aId)}&classB=${encodeURIComponent(bId)}`);
      setDuelData(res);
    } catch (e) {
      console.error('Lỗi tải đối đầu:', e);
    } finally {
      setDuelLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, []);

  useEffect(() => {
    if (classAId && classBId) {
      loadDuel(classAId, classBId);
    } else {
      setDuelData(null);
    }
  }, [classAId, classBId]);

  // Danh sách các khối thực tế từ dữ liệu lớp học
  const availableGrades = useMemo(() => {
    const grades = new Set<string>();
    classes.forEach((c) => {
      if (c.grade != null && c.grade !== '') grades.add(String(c.grade));
    });
    const sorted = Array.from(grades).sort((a, b) => {
      const numA = parseInt(a, 10);
      const numB = parseInt(b, 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
    return ['all', ...sorted];
  }, [classes]);

  // Bộ lọc danh sách lớp theo khối cho Tab 2
  const filteredClasses = useMemo(() => {
    if (selectedGrade === 'all') return classes;
    return classes.filter((c) => String(c.grade) === selectedGrade);
  }, [classes, selectedGrade]);

  // Nhóm lớp theo khối cho Tab 3
  const classesByGrade = useMemo(() => {
    const groups: Record<string, any[]> = {};
    classes.forEach((c) => {
      const g = c.grade ? `Khối ${c.grade}` : 'Chưa phân khối';
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return groups;
  }, [classes]);

  // Thống kê tổng hợp toàn trường
  const stats = useMemo(() => {
    if (!classes.length) {
      return { topClass: null, avgCompletion: 0, avgOnTime: 0, warningCount: 0 };
    }
    const top = classes[0];
    const avgComp = Math.round((classes.reduce((acc, c) => acc + (c.completionRate || 0), 0) / classes.length) * 10) / 10;
    const avgOn = Math.round((classes.reduce((acc, c) => acc + (c.onTimeRate || 0), 0) / classes.length) * 10) / 10;
    const warn = classes.filter((c) => (c.completionRate || 0) < 90).length;
    return { topClass: top, avgCompletion: avgComp, avgOnTime: avgOn, warningCount: warn };
  }, [classes]);

  // Hoán đổi 2 lớp đối đầu
  const handleSwapClasses = () => {
    const temp = classAId;
    setClassAId(classBId);
    setClassBId(temp);
  };

  // Xuất bảng xếp hạng ra file CSV
  const handleExportCSV = () => {
    if (!filteredClasses.length) return;
    const headers = ['Hạng', 'Tên Lớp', 'Khối', 'Sĩ số', 'GVCN', 'Tỷ lệ nộp bài (%)', 'Đúng hạn (%)', 'Điểm TB', 'Chuyên cần (%)', 'Trạng thái'];
    const rows = filteredClasses.map((c, idx) => [
      idx + 1,
      c.className,
      `Khối ${c.grade}`,
      c.expectedStudents || 0,
      `"${c.homeroomTeacher || ''}"`,
      c.completionRate || 0,
      c.onTimeRate || 0,
      c.averageScore || 0,
      c.attendanceRate || 0,
      c.completionRate >= 95 ? 'Xuất sắc' : c.completionRate >= 90 ? 'Tốt' : 'Cần hỗ trợ'
    ]);
    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `THCS_Giang_Vo_So_Sanh_Lop_Hoc_${selectedGrade}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ maxWidth: 1440, mx: 'auto', p: { xs: 2, md: 3 } }}>
      {/* Page Header */}
      <PageHeader
        title="So Sánh Lớp Học Đối Đầu & Chuẩn Đối Sánh Sư Phạm"
        subtitle="Phân tích tương quan đối đầu giữa các lớp học, đánh giá tiến độ nộp bài và khuyến nghị điều hành cho Ban Giám hiệu"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshRoundedIcon />}
              onClick={() => {
                loadClasses();
                if (classAId && classBId) loadDuel(classAId, classBId);
              }}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
            >
              Làm mới
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              sx={{
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.25)'
              }}
            >
              Xuất báo cáo CSV
            </Button>
          </Stack>
        }
      />

      {/* KPI Highlight Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#64748b" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lớp Dẫn Đầu Toàn Trường
                </Typography>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center' }}>
                  <EmojiEventsIcon sx={{ fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={800} color="#0f172a">
                {stats.topClass?.className || '—'}
              </Typography>
              <Typography variant="caption" fontWeight={600} color="#059669" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                <CheckCircleRoundedIcon sx={{ fontSize: 14 }} />
                Tỷ lệ nộp bài đạt {stats.topClass?.completionRate || 0}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#64748b" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Tỷ Lệ Nộp Bài TB Trường
                </Typography>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}>
                  <AssignmentTurnedInIcon sx={{ fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={800} color="#0f172a">
                {stats.avgCompletion}%
              </Typography>
              <Typography variant="caption" color="#64748b" sx={{ mt: 0.5, display: 'block' }}>
                Chuẩn đối sánh toàn trường THCS Giảng Võ
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#64748b" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Nộp Bài Đúng Hạn TB
                </Typography>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: '#f0fdf4', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
                  <AccessTimeIcon sx={{ fontSize: 20 }} />
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={800} color="#0f172a">
                {stats.avgOnTime}%
              </Typography>
              <Typography variant="caption" color="#16a34a" sx={{ mt: 0.5, display: 'block', fontWeight: 600 }}>
                Học sinh duy trì kỷ luật nộp bài tốt
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" fontWeight={700} color="#64748b" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lớp Cần Hỗ Trợ Bài Tập
                </Typography>
                <Box sx={{ p: 0.75, borderRadius: '8px', bgcolor: stats.warningCount > 0 ? '#fef2f2' : '#f0fdf4', color: stats.warningCount > 0 ? '#dc2626' : '#16a34a', display: 'grid', placeItems: 'center' }}>
                  {stats.warningCount > 0 ? <WarningAmberRoundedIcon sx={{ fontSize: 20 }} /> : <CheckCircleRoundedIcon sx={{ fontSize: 20 }} />}
                </Box>
              </Box>
              <Typography variant="h5" fontWeight={800} color={stats.warningCount > 0 ? '#dc2626' : '#0f172a'}>
                {stats.warningCount} lớp
              </Typography>
              <Typography variant="caption" color="#64748b" sx={{ mt: 0.5, display: 'block' }}>
                Tỷ lệ hoàn thành dưới 90% cần đôn đốc
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: '#e2e8f0', mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: '0.9rem',
              py: 1.5,
              minHeight: 48,
              color: '#64748b',
              '&.Mui-selected': { color: '#2563eb' }
            },
            '& .MuiTabs-indicator': { backgroundColor: '#2563eb', height: 3, borderRadius: '3px 3px 0 0' }
          }}
        >
          <Tab icon={<CompareArrowsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="So Sánh Đối Đầu 1 vs 1 (Head-to-Head Duel)" />
          <Tab icon={<TrendingUpIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Bảng Xếp Hạng & So Sánh Toàn Khối" />
          <Tab icon={<LightbulbOutlinedIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Khuyến Nghị Điều Hành Cho Ban Giám Hiệu" />
        </Tabs>
      </Box>

      {/* ========================================================================= */}
      {/* TAB 1: SO SÁNH ĐỐI ĐẦU 1 VS 1 (HEAD-TO-HEAD DUEL)                         */}
      {/* ========================================================================= */}
      {activeTab === 0 && (
        <Box>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={36} />
            </Box>
          ) : classes.length < 2 ? (
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', p: 5, textAlign: 'center', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: '#eff6ff',
                  color: '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
                }}
              >
                <CompareArrowsIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a" sx={{ mb: 1 }}>
                Cần Ít Nhất 2 Lớp Học Để So Sánh Đối Đầu
              </Typography>
              <Typography variant="body2" color="#64748b" sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
                Hiện hệ thống chỉ ghi nhận {classes.length} lớp học. Vui lòng kết nối Google Classroom và đồng bộ các khóa học thực tế để sử dụng tính năng so sánh đối đầu sư phạm.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/connections')}
                sx={{
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  textTransform: 'none',
                  fontWeight: 700,
                  px: 3,
                  py: 1,
                  borderRadius: '8px'
                }}
              >
                Đến Trang Kết Nối Google Classroom
              </Button>
            </Card>
          ) : (
            <>
              {/* Class Selectors Bar */}
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3, bgcolor: '#ffffff' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Grid container spacing={2} alignItems="center" justifyContent="center">
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="class-a-label" sx={{ fontWeight: 600 }}>Lớp thứ nhất (Lớp A)</InputLabel>
                        <Select
                          labelId="class-a-label"
                          value={classAId}
                          label="Lớp thứ nhất (Lớp A)"
                          onChange={(e) => setClassAId(e.target.value)}
                          sx={{ borderRadius: '8px', fontWeight: 700 }}
                        >
                          {classes.map((c) => (
                            <MenuItem key={c.classId || c.id} value={c.classId || c.id}>
                              <strong>{c.className}</strong> &nbsp;— Khối {c.grade} ({c.homeroomTeacher})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 2 }} sx={{ textAlign: 'center' }}>
                      <Tooltip title="Hoán đổi 2 lớp">
                        <IconButton
                          onClick={handleSwapClasses}
                          sx={{
                            bgcolor: '#eff6ff',
                            color: '#2563eb',
                            border: '1px solid #bfdbfe',
                            '&:hover': { bgcolor: '#dbeafe' }
                          }}
                        >
                          <SwapHorizIcon />
                        </IconButton>
                      </Tooltip>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 5 }}>
                      <FormControl fullWidth size="small">
                        <InputLabel id="class-b-label" sx={{ fontWeight: 600 }}>Lớp thứ hai (Lớp B)</InputLabel>
                        <Select
                          labelId="class-b-label"
                          value={classBId}
                          label="Lớp thứ hai (Lớp B)"
                          onChange={(e) => setClassBId(e.target.value)}
                          sx={{ borderRadius: '8px', fontWeight: 700 }}
                        >
                          {classes.map((c) => (
                            <MenuItem key={c.classId || c.id} value={c.classId || c.id}>
                              <strong>{c.className}</strong> &nbsp;— Khối {c.grade} ({c.homeroomTeacher})
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {duelLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <CircularProgress size={36} />
                </Box>
              ) : duelData?.classA && duelData?.classB ? (
            <Box>
              {/* Comparative Head-to-Head Cards */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                {/* LỚP A */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card
                    sx={{
                      borderRadius: '12px',
                      border: '2px solid #2563eb',
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                      bgcolor: '#ffffff',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ p: 2.5, bgcolor: '#eff6ff', borderBottom: '1px solid #bfdbfe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={800} color="#2563eb" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          LỚP A (XANH DƯƠNG)
                        </Typography>
                        <Typography variant="h5" fontWeight={800} color="#0f172a">
                          {duelData.classA.className}
                        </Typography>
                        <Typography variant="body2" color="#64748b">
                          GVCN: <strong>{duelData.classA.homeroomTeacher}</strong> • {duelData.classA.room}
                        </Typography>
                      </Box>
                      <Chip
                        label={duelData.classA.completionRate >= (duelData.classB.completionRate || 0) ? 'DẪN ĐẦU' : 'BÁM ĐUỔI'}
                        size="small"
                        sx={{
                          bgcolor: duelData.classA.completionRate >= (duelData.classB.completionRate || 0) ? '#2563eb' : '#64748b',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>

                    <CardContent sx={{ p: 2.5 }}>
                      <Stack spacing={2}>
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Tỷ lệ nộp bài</Typography>
                            <Typography variant="body2" fontWeight={800} color="#2563eb">{duelData.classA.completionRate}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={duelData.classA.completionRate} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#2563eb' } }} />
                        </Box>

                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Nộp bài đúng hạn</Typography>
                            <Typography variant="body2" fontWeight={800} color="#16a34a">{duelData.classA.onTimeRate}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={duelData.classA.onTimeRate} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' } }} />
                        </Box>

                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Điểm trung bình các môn</Typography>
                            <Typography variant="body2" fontWeight={800} color="#d97706">{duelData.classA.averageScore} / 10</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={(duelData.classA.averageScore / 10) * 100} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#d97706' } }} />
                        </Box>

                        <Grid container spacing={2} sx={{ pt: 1 }}>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Sĩ số</Typography>
                              <Typography variant="h6" fontWeight={800} color="#0f172a">{duelData.classA.expectedStudents}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Số bài tập</Typography>
                              <Typography variant="h6" fontWeight={800} color="#0f172a">{duelData.classA.totalCoursework}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Chuyên cần</Typography>
                              <Typography variant="h6" fontWeight={800} color="#16a34a">{duelData.classA.attendanceRate}%</Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* LỚP B */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card
                    sx={{
                      borderRadius: '12px',
                      border: '2px solid #7c3aed',
                      boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)',
                      bgcolor: '#ffffff',
                      height: '100%'
                    }}
                  >
                    <Box sx={{ p: 2.5, bgcolor: '#f5f3ff', borderBottom: '1px solid #ddd6fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="caption" fontWeight={800} color="#7c3aed" sx={{ letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                          LỚP B (TÍM INDIGO)
                        </Typography>
                        <Typography variant="h5" fontWeight={800} color="#0f172a">
                          {duelData.classB.className}
                        </Typography>
                        <Typography variant="body2" color="#64748b">
                          GVCN: <strong>{duelData.classB.homeroomTeacher}</strong> • {duelData.classB.room}
                        </Typography>
                      </Box>
                      <Chip
                        label={duelData.classB.completionRate >= (duelData.classA.completionRate || 0) ? 'DẪN ĐẦU' : 'BÁM ĐUỔI'}
                        size="small"
                        sx={{
                          bgcolor: duelData.classB.completionRate >= (duelData.classA.completionRate || 0) ? '#7c3aed' : '#64748b',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>

                    <CardContent sx={{ p: 2.5 }}>
                      <Stack spacing={2}>
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Tỷ lệ nộp bài</Typography>
                            <Typography variant="body2" fontWeight={800} color="#7c3aed">{duelData.classB.completionRate}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={duelData.classB.completionRate} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' } }} />
                        </Box>

                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Nộp bài đúng hạn</Typography>
                            <Typography variant="body2" fontWeight={800} color="#16a34a">{duelData.classB.onTimeRate}%</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={duelData.classB.onTimeRate} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' } }} />
                        </Box>

                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={600} color="#475569">Điểm trung bình các môn</Typography>
                            <Typography variant="body2" fontWeight={800} color="#d97706">{duelData.classB.averageScore} / 10</Typography>
                          </Box>
                          <LinearProgress variant="determinate" value={(duelData.classB.averageScore / 10) * 100} sx={{ height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#d97706' } }} />
                        </Box>

                        <Grid container spacing={2} sx={{ pt: 1 }}>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Sĩ số</Typography>
                              <Typography variant="h6" fontWeight={800} color="#0f172a">{duelData.classB.expectedStudents}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Số bài tập</Typography>
                              <Typography variant="h6" fontWeight={800} color="#0f172a">{duelData.classB.totalCoursework}</Typography>
                            </Box>
                          </Grid>
                          <Grid size={{ xs: 4 }}>
                            <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: '8px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                              <Typography variant="caption" color="#64748b" display="block">Chuyên cần</Typography>
                              <Typography variant="h6" fontWeight={800} color="#16a34a">{duelData.classB.attendanceRate}%</Typography>
                            </Box>
                          </Grid>
                        </Grid>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Radar Chart & AI Insights */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff', height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                        Biểu Đồ Radar So Sánh 5 Trục Năng Lực
                      </Typography>
                      <Typography variant="caption" color="#64748b" display="block" sx={{ mb: 2 }}>
                        Đánh giá toàn diện: Nộp bài, Đúng hạn, Điểm số, Chuyên cần và Khối lượng học tập
                      </Typography>

                      <Box sx={{ height: 320, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={duelData.radarData || []}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                            <Radar
                              name={duelData.classA.className}
                              dataKey="classA"
                              stroke="#2563eb"
                              fill="#2563eb"
                              fillOpacity={0.4}
                            />
                            <Radar
                              name={duelData.classB.className}
                              dataKey="classB"
                              stroke="#7c3aed"
                              fill="#7c3aed"
                              fillOpacity={0.4}
                            />
                            <Legend wrapperStyle={{ fontSize: '0.85rem', fontWeight: 700 }} />
                            <RechartsTooltip />
                          </RadarChart>
                        </ResponsiveContainer>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff', height: '100%' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LightbulbOutlinedIcon sx={{ color: '#d97706', fontSize: 22 }} />
                        <Typography variant="subtitle1" fontWeight={700} color="#0f172a">
                          Nhận Định Sư Phạm & Khuyến Nghị Vận Hành
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="#64748b" display="block" sx={{ mb: 2 }}>
                        Phân tích tự động từ máy chủ School Intelligence dành cho Ban Giám hiệu
                      </Typography>

                      <Stack spacing={1.5} sx={{ mb: 2.5 }}>
                        {duelData.insights?.map((ins: string, i: number) => (
                          <Alert key={i} severity="info" sx={{ py: 0.5, borderRadius: '8px', fontSize: '0.825rem', bgcolor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                            {ins}
                          </Alert>
                        ))}
                      </Stack>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="subtitle2" fontWeight={700} color="#0f172a" sx={{ mb: 1 }}>
                        📋 Chỉ Đạo Chuyên Môn Đề Xuất:
                      </Typography>
                      <Stack spacing={1}>
                        {duelData.recommendations?.map((rec: string, i: number) => (
                          <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                            <Box sx={{ minWidth: 6, minHeight: 6, borderRadius: '50%', bgcolor: '#2563eb', mt: 1 }} />
                            <Typography variant="body2" color="#334155" sx={{ fontSize: '0.825rem', lineHeight: 1.5 }}>
                              {rec}
                            </Typography>
                          </Box>
                        ))}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {/* Subject Breakdown Table */}
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                    Bảng Đối Sánh Chi Tiết Theo Từng Bộ Môn
                  </Typography>
                  <Typography variant="caption" color="#64748b" display="block" sx={{ mb: 2 }}>
                    So sánh mức độ hoàn thành bài tập và điểm số các môn giữa {duelData.classA.className} và {duelData.classB.className}
                  </Typography>

                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <Table size="small">
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Môn Học</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#2563eb' }}>{duelData.classA.className} — Nộp bài</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#2563eb' }}>{duelData.classA.className} — Điểm TB</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{duelData.classB.className} — Nộp bài</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>{duelData.classB.className} — Điểm TB</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#0f172a' }}>Đánh Giá</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(duelData.classA.subjects || []).map((subA: any, idx: number) => {
                          const subB = duelData.classB.subjects?.find((s: any) => s.name === subA.name) || {
                            completionRate: 0,
                            avgScore: 0
                          };
                          const isAWinner = subA.completionRate >= subB.completionRate;
                          return (
                            <TableRow key={idx} hover>
                              <TableCell sx={{ fontWeight: 700, color: '#0f172a' }}>{subA.name}</TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, color: '#2563eb' }}>
                                {subA.completionRate}%
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, color: '#d97706' }}>
                                {subA.avgScore}
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                                {subB.completionRate}%
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 700, color: '#d97706' }}>
                                {subB.avgScore}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={isAWinner ? `${duelData.classA.className} +${Math.round((subA.completionRate - subB.completionRate) * 10) / 10}%` : `${duelData.classB.className} +${Math.round((subB.completionRate - subA.completionRate) * 10) / 10}%`}
                                  size="small"
                                  sx={{
                                    bgcolor: isAWinner ? '#eff6ff' : '#f5f3ff',
                                    color: isAWinner ? '#2563eb' : '#7c3aed',
                                    fontWeight: 700,
                                    fontSize: '0.72rem'
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Box>
          ) : (
            <Alert severity="warning">Không tìm thấy dữ liệu đối đầu giữa 2 lớp đã chọn.</Alert>
          )}
            </>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BẢNG XẾP HẠNG & SO SÁNH TOÀN KHỐI (GRADE BENCHMARK)                 */}
      {/* ========================================================================= */}
      {activeTab === 1 && (
        <Box>
          {classes.length === 0 ? (
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', p: 5, textAlign: 'center', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: 3,
                  bgcolor: '#eff6ff',
                  color: '#2563eb',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.15)'
                }}
              >
                <TrendingUpIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a" sx={{ mb: 1 }}>
                Chưa Có Dữ Liệu Lớp Học Để Lập Bảng Xếp Hạng
              </Typography>
              <Typography variant="body2" color="#64748b" sx={{ maxWidth: 480, mx: 'auto', mb: 3 }}>
                Vui lòng kết nối Google Classroom và đồng bộ các khóa học để hệ thống tự động tổng hợp hiệu suất và lập chuẩn đối sánh.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/connections')}
                sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 3 }}
              >
                Kết Nối Google Classroom
              </Button>
            </Card>
          ) : (
            <>
              {/* Filter Bar */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                <Typography variant="body2" fontWeight={700} color="#475569">
                  Lọc theo Khối lớp:
                </Typography>
                {availableGrades.map((g) => (
                  <Chip
                    key={g}
                    label={g === 'all' ? 'Tất cả các khối' : `Khối ${g}`}
                    clickable
                    color={selectedGrade === g ? 'primary' : 'default'}
                    onClick={() => setSelectedGrade(g)}
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      bgcolor: selectedGrade === g ? '#2563eb' : '#f1f5f9',
                      color: selectedGrade === g ? '#ffffff' : '#475569',
                      '&:hover': { bgcolor: selectedGrade === g ? '#1d4ed8' : '#e2e8f0' }
                    }}
                  />
                ))}
              </Box>

              {/* Benchmark Bar Chart */}
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3, bgcolor: '#ffffff' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                    Chuẩn Đối Sánh Tỷ Lệ Nộp Bài (Benchmark Comparison)
                  </Typography>
                  <Typography variant="caption" color="#64748b" display="block" sx={{ mb: 2 }}>
                    Đường nét đứt màu đỏ thể hiện mức trung bình toàn trường ({stats.avgCompletion}%)
                  </Typography>

                  {filteredClasses.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: '8px' }}>Không có lớp học nào thuộc khối được chọn.</Alert>
                  ) : (
                    <Box sx={{ height: 320, width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={filteredClasses} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="className" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                          <YAxis domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 12 }} />
                          <RechartsTooltip
                            formatter={(val: any) => [`${val}%`, 'Tỷ lệ hoàn thành']}
                            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                          />
                          <ReferenceLine y={stats.avgCompletion} stroke="#ef4444" strokeDasharray="4 4" label={{ value: `TB: ${stats.avgCompletion}%`, fill: '#ef4444', fontSize: 12, fontWeight: 700, position: 'top' }} />
                          <Bar dataKey="completionRate" radius={[6, 6, 0, 0]}>
                            {filteredClasses.map((entry, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={entry.completionRate >= 95 ? '#10b981' : entry.completionRate >= 90 ? '#2563eb' : '#f59e0b'}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* Full Interactive Grid */}
              <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 0.5 }}>
                    Bảng Xếp Hạng Hiệu Suất Học Tập Toàn Bộ Các Lớp
                  </Typography>
                  <Typography variant="caption" color="#64748b" display="block" sx={{ mb: 2 }}>
                    Dữ liệu đồng bộ trực tiếp từ Google Classroom và CSDL trường học THCS Giảng Võ
                  </Typography>

                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                    <Table>
                      <TableHead sx={{ bgcolor: '#f8fafc' }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 700, color: '#475569', width: 60 }}>Hạng</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Lớp Học</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Khối</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Sĩ Số</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Giáo Viên Chủ Nhiệm</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569', width: 220 }}>Tỷ Lệ Hoàn Thành</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>Đúng Hạn</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>Điểm TB</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>Trạng Thái</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700, color: '#475569' }}>Thao Tác</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredClasses.map((cls, idx) => {
                          const isTop3 = idx < 3;
                          return (
                            <TableRow key={cls.id || cls.classId} hover>
                              <TableCell>
                                {isTop3 ? (
                                  <Box
                                    sx={{
                                      width: 26,
                                      height: 26,
                                      borderRadius: '50%',
                                      bgcolor: idx === 0 ? '#fef3c7' : idx === 1 ? '#f1f5f9' : '#ffedd5',
                                      color: idx === 0 ? '#d97706' : idx === 1 ? '#475569' : '#c2410c',
                                      display: 'grid',
                                      placeItems: 'center',
                                      fontWeight: 800,
                                      fontSize: '0.8rem',
                                      border: idx === 0 ? '1px solid #fde68a' : '1px solid #cbd5e1'
                                    }}
                                  >
                                    {idx + 1}
                                  </Box>
                                ) : (
                                  <Typography variant="body2" color="#64748b" fontWeight={600} sx={{ pl: 1 }}>
                                    {idx + 1}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <SchoolIcon sx={{ color: '#2563eb', fontSize: 18 }} />
                                  <Typography variant="body2" fontWeight={700} color="#0f172a">
                                    {cls.className}
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip label={`Khối ${cls.grade}`} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }} />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" fontWeight={600} color="#334155">
                                  {cls.expectedStudents || '—'} HS
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" color="#334155">
                                  {cls.homeroomTeacher || 'Chưa phân công'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                  <Box sx={{ flex: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={cls.completionRate || 0}
                                      sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: '#e2e8f0',
                                        '& .MuiLinearProgress-bar': {
                                          bgcolor: cls.completionRate >= 95 ? '#10b981' : cls.completionRate >= 90 ? '#2563eb' : '#f59e0b'
                                        }
                                      }}
                                    />
                                  </Box>
                                  <Typography variant="body2" fontWeight={800} color="#0f172a" sx={{ minWidth: 45 }}>
                                    {cls.completionRate}%
                                  </Typography>
                                </Box>
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" fontWeight={700} color="#16a34a">
                                  {cls.onTimeRate}%
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Typography variant="body2" fontWeight={800} color="#d97706">
                                  {cls.averageScore}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={cls.completionRate >= 95 ? 'Xuất sắc' : cls.completionRate >= 90 ? 'Tốt' : 'Cần hỗ trợ'}
                                  size="small"
                                  sx={{
                                    bgcolor: cls.completionRate >= 95 ? '#ecfdf5' : cls.completionRate >= 90 ? '#eff6ff' : '#fef2f2',
                                    color: cls.completionRate >= 95 ? '#059669' : cls.completionRate >= 90 ? '#2563eb' : '#dc2626',
                                    fontWeight: 700,
                                    fontSize: '0.75rem',
                                    border: cls.completionRate >= 95 ? '1px solid #a7f3d0' : cls.completionRate >= 90 ? '1px solid #bfdbfe' : '1px solid #fecaca'
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
                                  onClick={() => {
                                    setClassAId(cls.classId || cls.id);
                                    setActiveTab(0);
                                  }}
                                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', color: '#2563eb' }}
                                >
                                  So sánh
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </>
          )}
        </Box>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: KHUYẾN NGHỊ ĐIỀU HÀNH CHO BAN GIÁM HIỆU                              */}
      {/* ========================================================================= */}
      {activeTab === 2 && (
        <Box>
          {classes.length === 0 ? (
            <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', p: 5, textAlign: 'center', bgcolor: '#ffffff' }}>
              <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: '#eff6ff', color: '#2563eb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <LightbulbOutlinedIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" fontWeight={800} color="#0f172a" sx={{ mb: 1 }}>
                Chưa Có Dữ Liệu Lớp Học Để Tạo Khuyến Nghị Điều Hành
              </Typography>
              <Typography variant="body2" color="#64748b" sx={{ maxWidth: 480, mx: 'auto', mb: 3 }}>
                Sau khi kết nối và đồng bộ các khóa học Google Classroom, hệ thống sẽ tự động tổng hợp hiệu suất và lập danh mục chỉ đạo chuyên môn cho Ban Giám hiệu.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/connections')}
                sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
              >
                Kết Nối Google Classroom
              </Button>
            </Card>
          ) : (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 8 }}>
                <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff', mb: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="h6" fontWeight={800} color="#0f172a" sx={{ mb: 1 }}>
                      Chỉ Đạo Điều Hành Sư Phạm Theo Khối Lớp Thực Tế
                    </Typography>
                    <Typography variant="body2" color="#64748b" sx={{ mb: 3 }}>
                      Khuyến nghị tự động dựa trên kết quả nộp bài và chuyên cần thực tế từ Google Classroom
                    </Typography>

                    <Stack spacing={2.5}>
                      {Object.entries(classesByGrade).map(([gradeName, gradeClasses], idx) => {
                        const topInGrade = [...gradeClasses].sort((a, b) => (b.completionRate || 0) - (a.completionRate || 0))[0];
                        const lowInGrade = [...gradeClasses].sort((a, b) => (a.completionRate || 0) - (b.completionRate || 0))[0];
                        const avgGradeComp = Math.round((gradeClasses.reduce((acc, c) => acc + (c.completionRate || 0), 0) / gradeClasses.length) * 10) / 10;
                        const borderColor = idx % 3 === 0 ? '#10b981' : idx % 3 === 1 ? '#2563eb' : '#f59e0b';

                        return (
                          <Box key={gradeName} sx={{ p: 2.25, bgcolor: '#f8fafc', borderRadius: '10px', borderLeft: `4px solid ${borderColor}`, border: '1px solid #e2e8f0', borderLeftWidth: '4px' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5, flexWrap: 'wrap', gap: 1 }}>
                              <Typography variant="subtitle2" fontWeight={800} color="#0f172a">
                                {idx + 1}. {gradeName} — {gradeClasses.length} lớp học (Tỷ lệ hoàn thành TB: {avgGradeComp}%)
                              </Typography>
                              <Chip
                                label={avgGradeComp >= 90 ? 'Tiến độ tốt' : 'Cần đôn đốc'}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  fontSize: '0.72rem',
                                  bgcolor: avgGradeComp >= 90 ? '#ecfdf5' : '#fffbeb',
                                  color: avgGradeComp >= 90 ? '#059669' : '#d97706',
                                  border: avgGradeComp >= 90 ? '1px solid #a7f3d0' : '1px solid #fde68a'
                                }}
                              />
                            </Box>
                            <Typography variant="body2" color="#475569" sx={{ mt: 0.5, fontSize: '0.85rem', lineHeight: 1.6 }}>
                              • <strong>Lớp dẫn đầu:</strong> {topInGrade?.className || '—'} đạt tỷ lệ nộp bài {topInGrade?.completionRate || 0}%{topInGrade?.homeroomTeacher ? ` (GVCN: ${topInGrade.homeroomTeacher})` : ''}.<br />
                              • <strong>Chỉ đạo chuyên môn:</strong> {lowInGrade && lowInGrade !== topInGrade ? `Phối hợp cùng GVCN lớp ${lowInGrade.className} đôn đốc việc hoàn thành bài tập trực tuyến (hiện đạt ${lowInGrade.completionRate || 0}%).` : 'Duy trì nề nếp giao và nộp bài đều đặn qua Google Classroom.'}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff', mb: 3 }}>
                  <CardContent sx={{ p: 3 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="#0f172a" sx={{ mb: 2 }}>
                      Lịch Họp Giao Ban Đề Xuất
                    </Typography>

                    <Stack spacing={2}>
                      <Box sx={{ p: 1.5, bgcolor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <Typography variant="caption" fontWeight={700} color="#2563eb" display="block">
                          ĐỊNH KỲ — ĐẦU TUẦN
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="#0f172a">
                          Họp Ban Giám Hiệu & Khối Chuyên Môn
                        </Typography>
                        <Typography variant="caption" color="#64748b">
                          Đánh giá tỷ lệ nộp bài ({stats.avgCompletion}%) và đôn đốc các lớp cần hỗ trợ ({stats.warningCount} lớp)
                        </Typography>
                      </Box>

                      <Box sx={{ p: 1.5, bgcolor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <Typography variant="caption" fontWeight={700} color="#16a34a" display="block">
                          SINH HOẠT TỔ BỘ MÔN
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color="#0f172a">
                          Rà Soát Tiến Độ Chấm Điểm Classroom
                        </Typography>
                        <Typography variant="caption" color="#64748b">
                          Thống nhất khối lượng bài tập trực tuyến và công bố điểm cho học sinh
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </Box>
      )}
    </Box>
  );
}
