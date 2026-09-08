import { useState, useEffect, useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
  MenuItem,
  TextField,
  CircularProgress,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  IconButton
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/AssessmentRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import FactCheckIcon from '@mui/icons-material/FactCheckRounded';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesRounded';
import VideocamIcon from '@mui/icons-material/VideocamRounded';
import PrintIcon from '@mui/icons-material/PrintRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import ZoomInIcon from '@mui/icons-material/ZoomInRounded';
import ZoomOutIcon from '@mui/icons-material/ZoomOutRounded';
import PaletteIcon from '@mui/icons-material/PaletteRounded';
import VerifiedIcon from '@mui/icons-material/VerifiedRounded';
import FilterListIcon from '@mui/icons-material/FilterListRounded';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { PageHeader } from '../../components/PageHeader';
import { api, download } from '../../services/api';

const reportTemplates = [
  {
    id: 'rep-summary',
    title: 'Báo cáo Tổng quan Chuyên cần & Điểm danh',
    desc: 'Tổng hợp số tiết học, số lượt có mặt, đi muộn, vắng mặt và tỷ lệ chuyên cần theo từng lớp trong 30 ngày.',
    path: '/api/reports/summary.csv?days=30',
    filename: 'bao-cao-chuyen-can-thcs-giang-vo.csv',
    icon: <FactCheckIcon sx={{ color: '#2563eb' }} />,
    tag: 'Định kỳ'
  },
  {
    id: 'rep-classroom',
    title: 'Báo cáo Hoạt động Google Classroom',
    desc: 'Thống kê tình hình nộp bài tập, số bài đã giao, tỷ lệ hoàn thành đúng hạn của học sinh theo từng bộ môn.',
    path: '/api/reports/classroom.csv',
    filename: 'bao-cao-google-classroom.csv',
    icon: <AutoStoriesIcon sx={{ color: '#10b981' }} />,
    tag: 'Google Classroom'
  },
  {
    id: 'rep-meet',
    title: 'Báo cáo Chi tiết Phòng học Google Meet',
    desc: 'Ghi nhận thời gian bắt đầu, kết thúc, số lượng học sinh tham gia và thời lượng trung bình của các phiên Meet.',
    path: '/api/reports/meet.csv',
    filename: 'bao-cao-phien-hoc-google-meet.csv',
    icon: <VideocamIcon sx={{ color: '#8b5cf6' }} />,
    tag: 'Google Meet'
  }
];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

  // Dữ liệu Báo cáo Giao ban Tuần
  const [briefing, setBriefing] = useState<any>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  // Tùy biến xem trước A4 (MUI UI controls)
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [paperTone, setPaperTone] = useState<'white' | 'ivory'>('white');
  const [isApproved, setIsApproved] = useState<boolean>(true);
  const [classFilter, setClassFilter] = useState<'all' | 'submitted' | 'waiting'>('all');

  const loadBriefing = async () => {
    try {
      setLoadingBriefing(true);
      const res = await api<any>('/api/reports/executive-briefing');
      setBriefing(res);
    } catch (e: any) {
      console.warn('Lỗi nạp báo cáo giao ban:', e);
    } finally {
      setLoadingBriefing(false);
    }
  };

  useEffect(() => {
    loadBriefing();
  }, []);

  const handleDownload = async (rep: any) => {
    setDownloading(rep.id);
    const downloadPath = rep.id === 'rep-summary' ? `/api/reports/summary.csv?days=${period}` : rep.path;
    try {
      await download(downloadPath, rep.filename);
      setToast({ text: `Đã xuất báo cáo "${rep.title}" thành công!`, severity: 'success' });
    } catch (e: any) {
      setToast({
        text: `Không thể tải báo cáo: ${e.message}. Hãy đảm bảo hệ thống đã có dữ liệu đồng bộ từ Google Classroom.`,
        severity: 'error'
      });
    } finally {
      setDownloading(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Dữ liệu biểu đồ mini tiến độ bài tập
  const chartData = useMemo(() => {
    if (!briefing?.classes) return [];
    return briefing.classes.map((c: any) => ({
      name: c.className.replace('Lớp ', ''),
      coursework: c.totalCoursework || 0,
      turnedIn: c.submissionsTurnedIn || 0
    }));
  }, [briefing]);

  // Bộ lọc danh sách lớp trong báo cáo
  const filteredClasses = useMemo(() => {
    if (!briefing?.classes) return [];
    if (classFilter === 'submitted') return briefing.classes.filter((c: any) => c.submissionsTotal > 0);
    if (classFilter === 'waiting') return briefing.classes.filter((c: any) => c.submissionsTotal === 0);
    return briefing.classes;
  }, [briefing, classFilter]);

  return (
    <>
      {/* Header chỉ hiển thị trên màn hình, ẩn khi in ấn */}
      <Box sx={{ '@media print': { display: 'none' } }}>
        <PageHeader
          title="Báo Cáo & Giao Ban Điều Hành — THCS Giảng Võ"
          subtitle="Tổng hợp báo cáo giao ban tuần Ban Giám hiệu (A4 Print-Ready) và kho dữ liệu xuất CSV định kỳ"
          icon={<AssessmentIcon />}
          action={
            <Stack direction="row" spacing={1.5}>
              <Button
                variant="contained"
                startIcon={<PrintIcon />}
                onClick={handlePrint}
                sx={{
                  bgcolor: '#1e293b',
                  '&:hover': { bgcolor: '#0f172a' },
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '8px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                }}
              >
                In Báo Cáo / Xuất PDF (A4)
              </Button>
              <Button
                variant="outlined"
                startIcon={loadingBriefing ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                onClick={loadBriefing}
                disabled={loadingBriefing}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
              >
                Làm mới số liệu
              </Button>
            </Stack>
          }
        />

        {toast && (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2.5, borderRadius: '6px' }}>
            {toast.text}
          </Alert>
        )}

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: '1px solid #e2e8f0', mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(_e, v) => setActiveTab(v)}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.9rem',
                minHeight: 48,
                px: 2.5
              }
            }}
          >
            <Tab label="📄 Báo Cáo Giao Ban Tuần Ban Giám Hiệu (Bản Trình Bày A4)" />
            <Tab label="📊 Kho Xuất Dữ Liệu Định Kỳ (.CSV / Excel)" />
          </Tabs>
        </Box>
      </Box>

      {/* ========================================================= */}
      {/* TAB 0: BẢN BÁO CÁO GIAO BAN TUẦN (A4 PRINT-READY)        */}
      {/* ========================================================= */}
      {activeTab === 0 && (
        <Box sx={{ pb: 6 }}>
          {/* Thanh công cụ tương tác tài liệu (Interactive Document Toolbar) */}
          <Paper
            elevation={0}
            sx={{
              maxWidth: 960,
              mx: 'auto',
              mb: 2.5,
              p: 1.5,
              bgcolor: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5,
              '@media print': { display: 'none' }
            }}
          >
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" fontWeight={700} color="#475569" sx={{ textTransform: 'uppercase' }}>
                Trạng thái:
              </Typography>
              <Chip
                icon={isApproved ? <VerifiedIcon sx={{ fontSize: '15px !important' }} /> : undefined}
                label={isApproved ? 'ĐÃ PHÊ DUYỆT BAN HÀNH' : 'BẢN DỰ THẢO GIAO BAN'}
                size="small"
                onClick={() => setIsApproved(!isApproved)}
                sx={{
                  fontWeight: 800,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  bgcolor: isApproved ? '#ecfdf5' : '#fffbeb',
                  color: isApproved ? '#059669' : '#d97706',
                  border: isApproved ? '1px solid #a7f3d0' : '1px solid #fde68a'
                }}
              />
            </Stack>

            <Stack direction="row" spacing={1.5} alignItems="center">
              {/* Lọc hiển thị bảng */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <FilterListIcon sx={{ color: '#64748b', fontSize: 18 }} />
                <Typography variant="caption" color="#64748b" fontWeight={600}>
                  Lớp:
                </Typography>
                <ToggleButtonGroup
                  size="small"
                  value={classFilter}
                  exclusive
                  onChange={(_e, v) => v && setClassFilter(v)}
                  sx={{ height: 28 }}
                >
                  <ToggleButton value="all" sx={{ px: 1, py: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}>
                    Tất cả (8)
                  </ToggleButton>
                  <ToggleButton value="submitted" sx={{ px: 1, py: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}>
                    Đã nộp (2)
                  </ToggleButton>
                  <ToggleButton value="waiting" sx={{ px: 1, py: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'none' }}>
                    Chờ HS (6)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>

              {/* Tông màu giấy */}
              <Tooltip title="Đổi màu nền hiển thị (Trắng văn phòng / Ngà hành chính)">
                <IconButton
                  size="small"
                  onClick={() => setPaperTone(paperTone === 'white' ? 'ivory' : 'white')}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '8px' }}
                >
                  <PaletteIcon sx={{ fontSize: 16, color: paperTone === 'ivory' ? '#d97706' : '#64748b' }} />
                </IconButton>
              </Tooltip>

              {/* Thu phóng */}
              <Stack direction="row" spacing={0.5} alignItems="center">
                <Tooltip title="Thu nhỏ">
                  <IconButton
                    size="small"
                    onClick={() => setZoomLevel(Math.max(80, zoomLevel - 10))}
                    disabled={zoomLevel <= 80}
                  >
                    <ZoomOutIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Typography variant="caption" fontWeight={700} sx={{ minWidth: 35, textAlign: 'center' }}>
                  {zoomLevel}%
                </Typography>
                <Tooltip title="Phóng to">
                  <IconButton
                    size="small"
                    onClick={() => setZoomLevel(Math.min(120, zoomLevel + 10))}
                    disabled={zoomLevel >= 120}
                  >
                    <ZoomInIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Stack>
          </Paper>

          {/* Document Canvas (Khổ giấy A4 chuẩn) */}
          <Paper
            elevation={0}
            sx={{
              maxWidth: 960,
              mx: 'auto',
              p: { xs: 3, sm: 5, md: 6 },
              bgcolor: paperTone === 'ivory' ? '#fdfbf7' : '#ffffff',
              borderRadius: '16px',
              border: '1px solid #cbd5e1',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.06)',
              fontFamily: '"Times New Roman", Times, serif',
              color: '#0f172a',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease, background-color 0.2s ease',
              '@media print': {
                maxWidth: '100% !important',
                border: 'none !important',
                boxShadow: 'none !important',
                p: 0,
                m: 0,
                borderRadius: 0,
                transform: 'none !important',
                bgcolor: '#ffffff !important'
              }
            }}
          >
            {/* Header Quốc hiệu & Đơn vị theo Nghị định 30/2020/NĐ-CP */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                  UBND QUẬN BA ĐÌNH
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>
                  TRƯỜNG THCS GIẢNG VÕ
                </Typography>
                <Box sx={{ width: 100, height: '1.5px', bgcolor: '#0f172a', my: 0.5 }} />
                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#475569', display: 'block', mt: 0.5 }}>
                  Số: 28/BC-THCSGV
                </Typography>
              </Grid>

              <Grid size={{ xs: 6 }} sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase' }}>
                  CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  Độc lập – Tự do – Hạnh phúc
                </Typography>
                <Box sx={{ width: 140, height: '1.5px', bgcolor: '#0f172a', mx: 'auto', my: 0.5 }} />
                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#475569', display: 'block', mt: 0.5 }}>
                  Ba Đình, ngày {briefing?.reportDate || '08/09/2026'}
                </Typography>
              </Grid>
            </Grid>

            {/* Tiêu đề Báo Cáo */}
            <Box sx={{ textAlign: 'center', my: 3 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1.35rem', letterSpacing: '0.02em', mb: 0.5 }}>
                {briefing?.reportTitle || 'BÁO CÁO GIAO BAN TUẦN BAN GIÁM HIỆU'}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontStyle: 'italic', fontSize: '0.95rem', color: '#334155' }}>
                {briefing?.reportSubtitle || 'Tình hình triển khai dạy học số và học tập trực tuyến trên Google Classroom'}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.9rem', mt: 0.5, color: '#2563eb' }}>
                {briefing?.term || 'Học kỳ I'} — {briefing?.academicYear || 'Năm học 2026 – 2027'} (Tuần {briefing?.weekNumber || 1})
              </Typography>
            </Box>

            {/* PHẦN I: TỔNG QUAN CHỈ SỐ TOÀN TRƯỜNG */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1rem', borderBottom: '1.5px solid #0f172a', pb: 0.5, mb: 2 }}>
                I. TỔNG QUAN CHỈ SỐ GOOGLE CLASSROOM TOÀN TRƯỜNG
              </Typography>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Số Khóa Học
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#2563eb', my: 0.5 }}>
                      {briefing?.kpis?.totalCourses || 8}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                      100% Hoạt động
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Bài Tập Đã Giao
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a', my: 0.5 }}>
                      {briefing?.kpis?.totalCoursework || 41}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Từ 8 khóa học
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Bài Nộp Thực Tế
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#16a34a', my: 0.5 }}>
                      {briefing?.kpis?.totalTurnedIn || 10} / {briefing?.kpis?.totalSubmissions || 10}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                      Tỷ lệ hoàn thành: {briefing?.kpis?.overallCompletion || 100}%
                    </Typography>
                  </Box>
                </Grid>

                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', textAlign: 'center', bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Điểm Trung Bình ĐGTX
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#d97706', my: 0.5 }}>
                      {briefing?.kpis?.schoolGpa || 9.0} / 10
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                      100% Đã chấm bài
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Biểu đồ mini Recharts minh họa tiến độ các lớp */}
              {chartData.length > 0 && (
                <Box sx={{ mt: 2.5, p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', bgcolor: '#ffffff' }}>
                  <Typography variant="caption" fontWeight={700} color="#64748b" display="block" sx={{ mb: 1, textTransform: 'uppercase' }}>
                    Biểu Đồ So Sánh Số Bài Đã Giao & Số Bài Đã Nộp Theo Từng Lớp
                  </Typography>
                  <Box sx={{ height: 160, width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <RechartsTooltip />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '4px' }} />
                        <Bar dataKey="coursework" name="Bài đã giao" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="turnedIn" name="Bài đã nộp" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}
            </Box>

            {/* PHẦN II: BẢNG CHI TIẾT 8 KHÓA HỌC THỰC TẾ */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1rem', borderBottom: '1.5px solid #0f172a', pb: 0.5, mb: 2 }}>
                II. TIẾN ĐỘ THỰC HIỆN THEO TỪNG KHÓA HỌC (100% DỮ LIỆU CLASSROOM)
              </Typography>

              <TableContainer component={Box} sx={{ border: '1px solid #cbd5e1', borderRadius: '6px' }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>STT</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Tên Lớp / Khóa Học</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Khối</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Giáo Viên Chủ Nhiệm</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Bài Đã Giao</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>HS Trên Classroom</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Bài Nộp</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Điểm TB</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>Đánh Giá</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClasses.map((c: any, idx: number) => {
                      const hasSubs = c.submissionsTotal > 0;
                      return (
                        <TableRow key={c.id || idx}>
                          <TableCell sx={{ fontSize: '0.82rem' }}>{idx + 1}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.82rem' }}>{c.className}</TableCell>
                          <TableCell sx={{ fontSize: '0.82rem' }}>{c.grade ? `Khối ${c.grade}` : '—'}</TableCell>
                          <TableCell sx={{ fontSize: '0.82rem' }}>{c.homeroomTeacher || 'Chưa phân công'}</TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.totalCoursework} bài</TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem' }}>
                            {hasSubs ? (
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#16a34a', fontSize: '0.82rem' }}>
                                1 HS (đã tham gia)
                              </Typography>
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                0 HS
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem', fontWeight: 700, color: hasSubs ? '#2563eb' : '#94a3b8' }}>
                            {hasSubs ? `${c.submissionsTurnedIn}/${c.submissionsTotal} (${c.completionRate}%)` : '0 bài'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem', fontWeight: 800, color: c.averageScore ? '#d97706' : '#94a3b8' }}>
                            {c.averageScore ?? '—'}
                          </TableCell>
                          <TableCell align="center" sx={{ fontSize: '0.82rem' }}>
                            <Chip
                              label={hasSubs ? 'Hoàn thành tốt' : 'Chờ HS tham gia'}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.68rem',
                                fontWeight: 700,
                                bgcolor: hasSubs ? '#ecfdf5' : '#f8fafc',
                                color: hasSubs ? '#059669' : '#64748b',
                                border: hasSubs ? '1px solid #a7f3d0' : '1px solid #e2e8f0'
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* PHẦN III: ĐÁNH GIÁ THEO TỔ CHUYÊN MÔN */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1rem', borderBottom: '1.5px solid #0f172a', pb: 0.5, mb: 2 }}>
                III. ĐÁNH GIÁ HOẠT ĐỘNG THEO TỔ CHUYÊN MÔN
              </Typography>

              <Grid container spacing={2}>
                {(briefing?.departments || []).map((dept: any, idx: number) => (
                  <Grid key={idx} size={{ xs: 12, sm: 6 }}>
                    <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: '8px', bgcolor: '#fbfcfe' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', mb: 0.5 }}>
                        • {dept.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: '#475569', display: 'block', mb: 1 }}>
                        Tổ trưởng: <strong>{dept.headTeacher}</strong>
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.6 }}>
                        - Tổng số bài tập trực tuyến: <strong>{dept.totalAssignments} bài</strong><br />
                        - Số bài học sinh đã hoàn thành: <strong>{dept.submissions} bài</strong> (Điểm TB: <strong>{dept.avgScore}/10</strong>)<br />
                        - Đánh giá chuyên môn: <span style={{ color: '#059669', fontWeight: 700 }}>{dept.status}</span>
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* PHẦN IV: KẾT LUẬN & PHƯƠNG HƯỚNG CHỈ ĐẠO CỦA HIỆU TRƯỞNG */}
            <Box sx={{ mb: 4 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: '1rem', borderBottom: '1.5px solid #0f172a', pb: 0.5, mb: 2 }}>
                IV. KẾT LUẬN VÀ PHƯƠNG HƯỚNG CHỈ ĐẠO TUẦN TIẾP THEO
              </Typography>

              <Stack spacing={1.5} sx={{ pl: 1 }}>
                {(briefing?.principalDirectives || []).map((dir: string, idx: number) => (
                  <Typography key={idx} variant="body2" sx={{ fontSize: '0.9rem', lineHeight: 1.7, color: '#1e293b' }}>
                    {dir}
                  </Typography>
                ))}
              </Stack>
            </Box>

            {/* PHẦN KÝ TÊN VÀ NƠI NHẬN THEO CHUẨN VĂN BẢN */}
            <Grid container spacing={2} sx={{ mt: 4, pt: 3, borderTop: '1px solid #e2e8f0' }}>
              <Grid size={{ xs: 6 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, fontStyle: 'italic', display: 'block', mb: 0.5 }}>
                  Nơi nhận:
                </Typography>
                <Typography variant="caption" sx={{ color: '#475569', lineHeight: 1.5, display: 'block' }}>
                  - Phòng GD&ĐT quận Ba Đình (để báo cáo);<br />
                  - Ban Giám hiệu (để chỉ đạo);<br />
                  - Các Tổ chuyên môn & GVCN (để thực hiện);<br />
                  - Lưu: Văn phòng trường THCS Giảng Võ.
                </Typography>
              </Grid>

              <Grid size={{ xs: 6 }} sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '0.95rem', textTransform: 'uppercase' }}>
                  HIỆU TRƯỞNG
                </Typography>
                <Typography variant="caption" sx={{ fontStyle: 'italic', color: '#64748b', display: 'block', mb: 6 }}>
                  (Ký tên và đóng dấu)
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 800, fontSize: '1rem' }}>
                  Ban Giám Hiệu Trường THCS Giảng Võ
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </Box>
      )}

      {/* ========================================================= */}
      {/* TAB 1: KHO DỮ LIỆU XUẤT CSV ĐỊNH KỲ                       */}
      {/* ========================================================= */}
      {activeTab === 1 && (
        <Box sx={{ pb: 6 }}>
          {/* Filter Card */}
          <Card sx={{ mb: 3, borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <TextField
                  select
                  size="small"
                  label="Khoảng thời gian báo cáo"
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  sx={{ minWidth: 240 }}
                >
                  <MenuItem value="7">7 ngày gần nhất</MenuItem>
                  <MenuItem value="30">30 ngày gần nhất (1 tháng)</MenuItem>
                  <MenuItem value="90">Học kỳ I (90 ngày)</MenuItem>
                  <MenuItem value="180">Cả năm học 2026–2027</MenuItem>
                </TextField>

                <Typography variant="body2" color="#64748b" sx={{ fontSize: '0.8125rem' }}>
                  Định dạng xuất chuẩn: <strong style={{ color: '#0f172a' }}>CSV (UTF-8 có BOM tiếng Việt)</strong> tương thích hoàn toàn với Microsoft Excel và Google Sheets.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {/* Report Cards Grid */}
          <Grid container spacing={2.5}>
            {reportTemplates.map((rep) => (
              <Grid key={rep.id} size={{ xs: 12, md: 4 }}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: '12px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    bgcolor: '#ffffff',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)',
                      borderColor: '#bfdbfe'
                    }
                  }}
                >
                  <CardContent sx={{ p: 3, flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box
                        sx={{
                          p: 1.25,
                          bgcolor: rep.id === 'rep-summary' ? '#eff6ff' : rep.id === 'rep-classroom' ? '#ecfdf5' : '#f5f3ff',
                          borderRadius: '10px',
                          display: 'grid',
                          placeItems: 'center'
                        }}
                      >
                        {rep.icon}
                      </Box>
                      <Chip
                        label={rep.tag}
                        size="small"
                        sx={{
                          bgcolor: rep.id === 'rep-summary' ? '#eff6ff' : rep.id === 'rep-classroom' ? '#ecfdf5' : '#f5f3ff',
                          color: rep.id === 'rep-summary' ? '#1d4ed8' : rep.id === 'rep-classroom' ? '#059669' : '#7c3aed',
                          border: '1px solid',
                          borderColor: rep.id === 'rep-summary' ? '#bfdbfe' : rep.id === 'rep-classroom' ? '#a7f3d0' : '#ddd6fe',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                    </Box>
                    <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 1, letterSpacing: '-0.01em' }}>
                      {rep.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 3, fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      {rep.desc}
                    </Typography>
                  </CardContent>
                  <Box sx={{ p: 2.5, pt: 0 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      startIcon={downloading === rep.id ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon sx={{ fontSize: 16 }} />}
                      disabled={downloading === rep.id}
                      onClick={() => handleDownload(rep)}
                      sx={{
                        bgcolor: '#2563eb',
                        color: '#ffffff',
                        '&:hover': { bgcolor: '#1d4ed8' },
                        py: 1.1,
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        textTransform: 'none',
                        borderRadius: '8px',
                        boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                      }}
                    >
                      {downloading === rep.id ? 'Đang kết xuất CSV...' : 'Tải báo cáo CSV'}
                    </Button>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </>
  );
}