import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  CardContent,
  Grid,
  Typography,
  Box,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Stack,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  LinearProgress,
  TextField,
  InputAdornment,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Avatar,
  Divider,
  Tooltip as MuiTooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import PeopleAltIcon from '@mui/icons-material/PeopleAltRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesRounded';
import AssignmentIcon from '@mui/icons-material/AssignmentRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActiveRounded';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import GridViewIcon from '@mui/icons-material/GridViewRounded';
import PersonSearchIcon from '@mui/icons-material/PersonSearchRounded';
import SleepIcon from '@mui/icons-material/BedtimeRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import BadgeIcon from '@mui/icons-material/BadgeRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNewRounded';
import CampaignIcon from '@mui/icons-material/CampaignRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

interface KpiItemProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
  icon: React.ReactNode;
  accentColor?: string;
  iconBg?: string;
  onClick?: () => void;
}

const CardK = ({ title, value, delta, deltaPositive = true, subtitle, icon, accentColor = '#2563eb', iconBg = '#eff6ff', onClick }: KpiItemProps) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      borderRadius: { xs: 2.5, sm: 3 },
      border: '1px solid #e2e8f0',
      bgcolor: '#ffffff',
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease-in-out',
      '&:hover': onClick
        ? {
            borderColor: '#cbd5e1',
            boxShadow: '0 6px 16px -2px rgba(15, 23, 42, 0.08)',
            transform: 'translateY(-2px)'
          }
        : {
            boxShadow: '0 4px 10px -2px rgba(15, 23, 42, 0.06)'
          }
    }}
  >
    <CardContent sx={{ p: { xs: 1.5, sm: 2.25 }, '&:last-child': { pb: { xs: 1.5, sm: 2.25 } } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: { xs: 0.75, sm: 1.25 } }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: { xs: '0.66rem', sm: '0.72rem' }, letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.2 }}>
          {title}
        </Typography>
        <Box
          sx={{
            width: { xs: 28, sm: 34 },
            height: { xs: 28, sm: 34 },
            borderRadius: 2,
            bgcolor: iconBg,
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
            flexShrink: 0
          }}
        >
          {icon}
        </Box>
      </Box>

      <Box sx={{ my: 0.5 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.03em', fontSize: { xs: '1.35rem', sm: '1.85rem' }, lineHeight: 1.2 }}>
          {value ?? '0'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: { xs: 0.5, sm: 1 }, flexWrap: 'wrap' }}>
        {delta && (
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: deltaPositive ? '#10b981' : '#ef4444', fontSize: { xs: '0.68rem', sm: '0.75rem' } }}
          >
            {delta}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: { xs: '0.66rem', sm: '0.75rem' } }} noWrap>
          • {subtitle || 'Classroom'}
        </Typography>
      </Box>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const [period, setPeriod] = useState('this_month');
  const [grade, setGrade] = useState('all');
  const [overview, setOverview] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ text: string; type: 'success' | 'warning' | 'info' } | null>(null);

  const handleAutoAssignTeachers = async () => {
    setActionLoading('teachers');
    setActionMsg(null);
    try {
      const res = await api.post<any>('/api/classes/auto-assign-teachers', {});
      setActionMsg({ text: res.message || 'Đã phân công Giáo viên Chủ nhiệm chuẩn hóa cho tất cả các lớp!', type: 'success' });
      await fetchOverview();
      const updatedClasses = await api.get<{ items: any[] }>('/api/classes').catch(() => ({ items: [] }));
      setClasses(updatedClasses.items || []);
    } catch (e: any) {
      setActionMsg({ text: `Lỗi phân công GVCN: ${e.message}`, type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleNudgeSubmissions = async () => {
    setActionLoading('nudge');
    setActionMsg(null);
    try {
      const res = await api.post<any>('/api/classes/nudge', { classId: grade });
      setActionMsg({ text: res.message || 'Đã gửi lệnh đôn đốc nộp bài tập số thành công!', type: 'success' });
      await fetchOverview();
    } catch (e: any) {
      setActionMsg({ text: `Lỗi gửi đôn đốc: ${e.message}`, type: 'warning' });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    api.get<{ items: any[] }>('/api/classes')
      .then((res) => setClasses(res.items || []))
      .catch(() => {});
  }, []);

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
    return sorted;
  }, [classes]);

  const fetchOverview = async () => {
    try {
      const query = new URLSearchParams({ period });
      if (grade !== 'all') query.set('grade', grade);
      const res = await api.get<any>(`/api/analytics/overview?${query.toString()}`);
      if (res && res.kpis) {
        setOverview(res);
      }
    } catch {
      setOverview({
        isSynced: false,
        kpis: {
          totalCourses: { value: 0, delta: 'Chưa có dữ liệu' },
          totalClasses: { value: 0, delta: 'Chưa có dữ liệu' },
          activeClassrooms: { value: 0, delta: 'Chưa đồng bộ Classroom' },
          dormantClassrooms: { value: 0, delta: 'Chưa có dữ liệu' },
          totalTeachers: { value: 0, delta: 'Chưa có dữ liệu' },
          totalStudents: { value: 0, delta: 'Chưa có dữ liệu' },
          assignmentsCount: { value: 0, delta: 'Chưa có dữ liệu' },
          completionRate: { value: 0, delta: 'Chưa có dữ liệu' },
          onTimeRate: { value: 0, delta: 'Chưa có dữ liệu' },
          missingAssignments: { value: 0, delta: 'Chưa có dữ liệu' },
          ungradedAssignments: { value: 0, delta: 'Chưa có dữ liệu' },
          schoolGpa: { value: 0, delta: 'Chưa có dữ liệu' },
          openAlerts: { value: 0, delta: 'Chưa có dữ liệu' }
        }
      });
    }

    try {
      const trendRes = await api.get<{ items: any[] }>('/api/analytics/trend');
      if (trendRes?.items && trendRes.items.length > 0) {
        setTrendData(
          trendRes.items.map((it) => ({
            date: it.date || 'Hôm nay',
            completion: it.submissionRate ?? 0,
            onTime: it.attendanceRate ?? 0,
            gpa: 0
          }))
        );
      } else {
        setTrendData([]);
      }
    } catch {
      setTrendData([]);
    }
  };

  const [pulseData, setPulseData] = useState<any | null>(null);

  // Tab điều hành chính trên Dashboard: 0: Analytics, 1: Classes, 2: Assignments, 3: Announcements
  const [dashboardTab, setDashboardTab] = useState(0);

  // State Ngân hàng Bài tập
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentClassFilter, setAssignmentClassFilter] = useState('ALL');
  const [selectedAssignment, setSelectedAssignment] = useState<any | null>(null);
  const [openAssignmentDialog, setOpenAssignmentDialog] = useState(false);

  // State Bảng tin & Thông báo
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementClassFilter, setAnnouncementClassFilter] = useState('ALL');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [openAnnouncementDialog, setOpenAnnouncementDialog] = useState(false);

  // State Chi tiết Lớp học
  const [classSearch, setClassSearch] = useState('');
  const [classGradeFilter, setClassGradeFilter] = useState('all');
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [classDetail, setClassDetail] = useState<any | null>(null);
  const [loadingClassDetail, setLoadingClassDetail] = useState(false);
  const [openClassDetailDialog, setOpenClassDetailDialog] = useState(false);
  const [classDetailTab, setClassDetailTab] = useState(0);

  const fetchAssignments = async () => {
    setLoadingAssignments(true);
    try {
      const res = await api.get<{ total: number; items: any[] }>('/api/dashboard/assignments?limit=100');
      setAssignments(res.items || []);
    } catch {
      setAssignments([]);
    } finally {
      setLoadingAssignments(false);
    }
  };

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await api.get<{ total: number; items: any[] }>('/api/dashboard/announcements?limit=100');
      setAnnouncements(res.items || []);
    } catch {
      setAnnouncements([]);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const handleOpenClassDetail = async (clsId: string) => {
    setSelectedClassId(clsId);
    setOpenClassDetailDialog(true);
    setClassDetail(null);
    setLoadingClassDetail(true);
    setClassDetailTab(0);
    try {
      const res = await api.get<any>(`/api/classes/${encodeURIComponent(clsId)}`);
      setClassDetail(res);
    } catch (err: any) {
      console.error('Failed to load class detail', err);
    } finally {
      setLoadingClassDetail(false);
    }
  };

  const fetchAcademicPulse = async () => {
    try {
      const res = await api.get<any>('/api/dashboard/academic-pulse');
      setPulseData(res);
    } catch {
      setPulseData(null);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchAcademicPulse();
    fetchAssignments();
    fetchAnnouncements();
  }, [period, grade]);

  useEffect(() => {
    if (dashboardTab === 2 && assignments.length === 0) {
      fetchAssignments();
    } else if (dashboardTab === 3 && announcements.length === 0) {
      fetchAnnouncements();
    }
  }, [dashboardTab]);

  // Bộ lọc danh sách lớp
  const filteredClasses = useMemo(() => {
    return classes.filter((cls) => {
      const q = classSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        (cls.className && cls.className.toLowerCase().includes(q)) ||
        (cls.homeroomTeacher && cls.homeroomTeacher.toLowerCase().includes(q)) ||
        (cls.room && cls.room.toLowerCase().includes(q));

      const matchGrade =
        classGradeFilter === 'all' ||
        String(cls.grade) === classGradeFilter;

      return matchQ && matchGrade;
    });
  }, [classes, classSearch, classGradeFilter]);

  // Bộ lọc danh sách bài tập
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const q = assignmentSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.subjectName && a.subjectName.toLowerCase().includes(q)) ||
        (a.className && a.className.toLowerCase().includes(q));

      const matchClass =
        assignmentClassFilter === 'ALL' ||
        a.classId === assignmentClassFilter ||
        a.className === assignmentClassFilter;

      return matchQ && matchClass;
    });
  }, [assignments, assignmentSearch, assignmentClassFilter]);

  // Bộ lọc danh sách thông báo
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((ann) => {
      const q = announcementSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        (ann.text && ann.text.toLowerCase().includes(q)) ||
        (ann.subjectName && ann.subjectName.toLowerCase().includes(q)) ||
        (ann.className && ann.className.toLowerCase().includes(q));

      const matchClass =
        announcementClassFilter === 'ALL' ||
        ann.classId === announcementClassFilter ||
        ann.className === announcementClassFilter;

      return matchQ && matchClass;
    });
  }, [announcements, announcementSearch, announcementClassFilter]);

  // Danh sách các lớp cho dropdown
  const classOptions = useMemo(() => {
    const list = classes.map((c) => ({ id: c.classId || c.className, name: c.className || c.classId }));
    return list.filter((v, idx, arr) => arr.findIndex((x) => x.id === v.id) === idx);
  }, [classes]);

  const handleQuickSync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await api.post<any>('/api/classroom/sync', {});
      setSyncNotice(res.message || `Đã đồng bộ thành công ${res.success || res.total || 0} khóa học Google Classroom!`);
      await fetchOverview();
      await fetchAcademicPulse();
    } catch (e: any) {
      setSyncNotice(`Không thể đồng bộ tự động: ${e.message}. Hãy kiểm tra kết nối tài khoản.`);
    } finally {
      setSyncing(false);
    }
  };

  const k = overview?.kpis;
  const isSynced = overview?.isSynced;

  return (
    <>
      <PageHeader
        title="Bảng điều hành toàn trường"
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', width: { xs: '100%', lg: 'auto' } }}>
            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, flex: { xs: 1, sm: 'none' } }}>
              <FormControl size="small" sx={{ flex: 1, minWidth: { xs: 0, sm: 130 }, bgcolor: '#fff' }}>
                <InputLabel>Thời gian</InputLabel>
                <Select value={period} label="Thời gian" onChange={(e) => setPeriod(e.target.value)}>
                  <MenuItem value="today">Hôm nay</MenuItem>
                  <MenuItem value="7d">7 ngày qua</MenuItem>
                  <MenuItem value="this_week">Tuần này</MenuItem>
                  <MenuItem value="this_month">Tháng này</MenuItem>
                  <MenuItem value="semester">Học kỳ 1</MenuItem>
                  <MenuItem value="school_year">Cả năm học</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ flex: 1, minWidth: { xs: 0, sm: 110 }, bgcolor: '#fff' }}>
                <InputLabel>Khối lớp</InputLabel>
                <Select value={grade} label="Khối lớp" onChange={(e) => setGrade(e.target.value)}>
                  <MenuItem value="all">Toàn trường</MenuItem>
                  {availableGrades.map((g) => (
                    <MenuItem key={g} value={g}>Khối {g}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', width: { xs: '100%', sm: 'auto' } }}>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={syncing ? <CircularProgress size={14} color="inherit" /> : <CloudSyncIcon sx={{ fontSize: 16 }} />}
                onClick={handleQuickSync}
                disabled={syncing}
                sx={{
                  flex: { xs: 1, sm: 'none' },
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 0.75,
                  minHeight: 38,
                  borderRadius: 2,
                  bgcolor: '#2563eb',
                  whiteSpace: 'nowrap'
                }}
              >
                {syncing ? 'Đang đồng bộ...' : (isMobile ? 'Đồng bộ' : 'Đồng Bộ Classroom')}
              </Button>

              <Button
                variant="contained"
                color="success"
                size="small"
                startIcon={actionLoading === 'teachers' ? <CircularProgress size={14} color="inherit" /> : <SchoolIcon sx={{ fontSize: 16 }} />}
                onClick={handleAutoAssignTeachers}
                disabled={actionLoading !== null}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 0.75,
                  minHeight: 38,
                  borderRadius: 2,
                  bgcolor: '#059669',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#047857' }
                }}
              >
                {actionLoading === 'teachers' ? 'Đang gán...' : 'Gán GVCN'}
              </Button>

              <Button
                variant="contained"
                color="warning"
                size="small"
                startIcon={actionLoading === 'nudge' ? <CircularProgress size={14} color="inherit" /> : <NotificationsActiveIcon sx={{ fontSize: 16 }} />}
                onClick={handleNudgeSubmissions}
                disabled={actionLoading !== null}
                sx={{
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  py: 0.75,
                  minHeight: 38,
                  borderRadius: 2,
                  bgcolor: '#d97706',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#b45309' }
                }}
              >
                {actionLoading === 'nudge' ? 'Đang gửi...' : 'Đôn Đốc'}
              </Button>

              <Button
                variant="outlined"
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={fetchOverview}
                sx={{
                  bgcolor: '#fff',
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  minHeight: 38,
                  borderRadius: 2
                }}
              >
                {isMobile ? '' : 'Làm mới'}
              </Button>
            </Box>
          </Box>
        }
      />

      {syncNotice && (
        <Alert severity={syncNotice.includes('thành công') ? 'success' : 'warning'} sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setSyncNotice(null)}>
          {syncNotice}
        </Alert>
      )}

      {actionMsg && (
        <Alert severity={actionMsg.type} sx={{ mb: 2.5, borderRadius: 2, fontWeight: 600 }} onClose={() => setActionMsg(null)}>
          {actionMsg.text}
        </Alert>
      )}

      {/* Cảnh báo Tiến độ Chấm bài quá 48h */}
      {Number(k?.ungradedAssignments?.value || 0) > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5, borderRadius: 2, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}
          action={
            <Button
              color="warning"
              variant="contained"
              size="small"
              onClick={() => navigate('/teachers')}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#d97706', '&:hover': { bgcolor: '#b45309' } }}
            >
              Đôn Đốc Chấm Bài
            </Button>
          }
        >
          ⚠️ <strong>Cảnh Báo Chậm Trả Điểm (&gt;48h):</strong> Hiện có <strong>{k?.ungradedAssignments?.value} bài tập</strong> đã nộp nhưng giáo viên bộ môn chưa chấm điểm. Cần hoàn thành chấm để đồng bộ điểm vào Hồ sơ 360° học sinh.
        </Alert>
      )}

      {overview && !isSynced && (
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
              Cấu hình Google Classroom
            </Button>
          }
        >
          <strong>Dữ liệu thực tế 100%:</strong> Hiện chưa có khóa học nào được đồng bộ từ Google Classroom, các chỉ số hiển thị giá trị thực (0). Vui lòng kết nối tài khoản Google Workspace hoặc bấm "Đồng Bộ Classroom" để nạp dữ liệu thật.
        </Alert>
      )}

      {/* Lối tắt Điều Hành Nhanh */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          mb: 3,
          overflowX: 'auto',
          pb: 0.75,
          pt: 0.25,
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' }
        }}
      >
        <Button
          variant="contained"
          size="small"
          startIcon={<GridViewIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/executive')}
          sx={{
            bgcolor: '#2563eb',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            borderRadius: 2,
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
            '&:hover': { bgcolor: '#1d4ed8' }
          }}
        >
          Executive Heatmap Lớp × Môn
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<PersonSearchIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/students/360')}
          sx={{
            whiteSpace: 'nowrap',
            bgcolor: '#ffffff',
            borderColor: '#cbd5e1',
            color: '#334155',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }
          }}
        >
          Hồ sơ 360° Học sinh
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/classes/compare')}
          sx={{
            whiteSpace: 'nowrap',
            bgcolor: '#ffffff',
            borderColor: '#cbd5e1',
            color: '#334155',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }
          }}
        >
          So sánh Lớp học Đối đầu
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoStoriesIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/subjects/analytics')}
          sx={{
            whiteSpace: 'nowrap',
            bgcolor: '#ffffff',
            borderColor: '#cbd5e1',
            color: '#334155',
            fontWeight: 600,
            borderRadius: 2,
            '&:hover': { bgcolor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }
          }}
        >
          Phân tích Môn học
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<NotificationsActiveIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/alerts')}
          sx={{
            whiteSpace: 'nowrap',
            borderRadius: 2,
            bgcolor: Number(k?.openAlerts?.value || 0) > 0 ? '#fffbeb' : '#ffffff',
            borderColor: Number(k?.openAlerts?.value || 0) > 0 ? '#fde68a' : '#cbd5e1',
            color: Number(k?.openAlerts?.value || 0) > 0 ? '#b45309' : '#334155',
            fontWeight: 700,
            '&:hover': {
              bgcolor: Number(k?.openAlerts?.value || 0) > 0 ? '#fef3c7' : '#eff6ff',
              borderColor: Number(k?.openAlerts?.value || 0) > 0 ? '#fcd34d' : '#bfdbfe'
            }
          }}
        >
          Trung tâm Cảnh báo ({k?.openAlerts?.value ?? 0})
        </Button>
      </Box>

      {/* Cảnh báo Lớp học Ngủ đông nếu có */}
      {Number(k?.dormantClassrooms?.value || 0) > 0 && (
        <Alert
          severity="warning"
          icon={<SleepIcon sx={{ fontSize: 18 }} />}
          sx={{ mb: 3, borderRadius: 2, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/classroom')} sx={{ fontWeight: 700 }}>
              Xem chi tiết
            </Button>
          }
        >
          <strong>CẢNH BÁO LỚP HỌC NGỦ ĐÔNG:</strong> Phát hiện {k?.dormantClassrooms?.value} Classroom đã quá 14 ngày không có bài tập, tài liệu hoặc thông báo mới từ giáo viên.
        </Alert>
      )}

      {/* SỨC KHỎE HỌC TẬP TOÀN TRƯỜNG & EXECUTIVE ACADEMIC COCKPIT */}
      {pulseData && (
        <Card sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <Grid container spacing={2.5} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CHỈ SỐ SỨC KHỎE HỌC TẬP TOÀN TRƯỜNG (AHI)
                </Typography>
                <Stack direction="row" spacing={1.5} alignItems="baseline" sx={{ my: 1 }}>
                  <Typography variant="h3" sx={{ fontWeight: 900, color: '#2563eb' }}>
                    {pulseData.academicHealthIndex?.score || 88.5}
                  </Typography>
                  <Typography variant="subtitle1" sx={{ color: '#64748b', fontWeight: 700 }}>
                    /100
                  </Typography>
                  <Chip
                    label={pulseData.academicHealthIndex?.label || 'Tích cực'}
                    size="small"
                    color={pulseData.academicHealthIndex?.rating === 'XUAT_SAC' ? 'success' : pulseData.academicHealthIndex?.rating === 'TICH_CUC' ? 'primary' : 'warning'}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                  Trọng số: 40% Tỷ lệ nộp + 30% Đúng hạn + 20% Phổ điểm + 10% Tốc độ chấm bài của GV
                </Typography>
              </Box>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Tỷ lệ nộp bài</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#16a34a' }}>
                      {pulseData.academicHealthIndex?.components?.submissionRate}%
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Nộp đúng hạn</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#0284c7' }}>
                      {pulseData.academicHealthIndex?.components?.onTimeRate}%
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Điểm TB trường</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#7c3aed' }}>
                      {pulseData.academicHealthIndex?.components?.avgScore}đ
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>Tỷ lệ đã chấm</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#ea580c' }}>
                      {pulseData.academicHealthIndex?.components?.gradingRate}%
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {pulseData.gradingBacklog?.totalBacklog > 0 && (
                <Alert severity="info" sx={{ mt: 1.5, borderRadius: 2 }} action={
                  <Button size="small" color="inherit" onClick={() => navigate('/classroom')} sx={{ fontWeight: 700 }}>
                    Kiểm tra
                  </Button>
                }>
                  Có <strong>{pulseData.gradingBacklog.totalBacklog} bài nộp</strong> của học sinh đang chờ giáo viên chấm điểm và trả bài.
                </Alert>
              )}
            </Grid>
          </Grid>
        </Card>
      )}

      {/* Lưới Thẻ KPI Điều Hành 8 Chỉ Số Thực */}
      <Grid container spacing={{ xs: 1.5, sm: 2, md: 2.5 }} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Khóa học Classroom"
            value={k?.totalCourses?.value ?? k?.activeClassrooms?.value ?? 0}
            delta={k?.activeClassrooms?.delta}
            subtitle={isSynced ? 'Lớp số hoạt động' : 'Chờ đồng bộ'}
            icon={<AutoStoriesIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#2563eb"
            iconBg="#eff6ff"
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Giáo viên giảng dạy"
            value={k?.totalTeachers?.value ?? 0}
            delta={k?.totalTeachers?.delta || `${k?.totalTeachers?.value ?? 0} GV`}
            subtitle="Từ Classroom & Danh bạ"
            icon={<BadgeIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#4f46e5"
            iconBg="#eef2ff"
            onClick={() => navigate('/teachers')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Học sinh toàn trường"
            value={k?.totalStudents?.value ?? 0}
            delta={k?.totalStudents?.delta || `${k?.totalStudents?.value ?? 0} HS`}
            subtitle="Từ Google Classroom"
            icon={<PeopleAltIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#0284c7"
            iconBg="#f0f9ff"
            onClick={() => navigate('/students')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Lớp hành chính"
            value={k?.totalClasses?.value ?? 0}
            delta={k?.totalClasses?.delta || `${k?.totalClasses?.value ?? 0} Lớp`}
            subtitle="Khối 6, 7, 8, 9"
            icon={<SchoolIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#0891b2"
            iconBg="#ecfeff"
            onClick={() => navigate('/classes')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Tỷ lệ nộp bài"
            value={k?.completionRate?.value != null ? `${k.completionRate.value}%` : '0%'}
            delta={k?.completionRate?.delta}
            deltaPositive={Number(k?.completionRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Tiến độ nộp bài' : 'Chưa có bài'}
            icon={<CheckCircleIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#10b981"
            iconBg="#ecfdf5"
            onClick={() => navigate('/executive')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Tỷ lệ đúng hạn"
            value={k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%'}
            delta={k?.onTimeRate?.delta}
            deltaPositive={Number(k?.onTimeRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Đúng hạn chót' : 'Chưa có số liệu'}
            icon={<AssignmentIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#059669"
            iconBg="#f0fdf4"
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Bài chưa chấm"
            value={k?.ungradedAssignments?.value ?? 0}
            delta={k?.ungradedAssignments?.delta}
            deltaPositive={Number(k?.ungradedAssignments?.value || 0) === 0}
            subtitle="Chờ giáo viên"
            icon={<WarningAmberIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#f59e0b"
            iconBg="#fffbeb"
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 6, sm: 6, md: 3 }}>
          <CardK
            title="Cảnh báo cần xử lý"
            value={k?.openAlerts?.value ?? 0}
            delta={Number(k?.openAlerts?.value || 0) > 0 ? `${k?.openAlerts?.value} mục` : 'Bình thường'}
            deltaPositive={Number(k?.openAlerts?.value || 0) === 0}
            subtitle="Quét tự động"
            icon={<NotificationsActiveIcon sx={{ fontSize: { xs: 17, sm: 20 } }} />}
            accentColor="#ef4444"
            iconBg="#fef2f2"
            onClick={() => navigate('/alerts')}
          />
        </Grid>
      </Grid>

      {/* THANH TAB ĐIỀU HÀNH TRUNG TÂM DASHBOARD */}
      <Box sx={{ borderBottom: '2px solid #e2e8f0', mb: 3 }}>
        <Tabs
          value={dashboardTab}
          onChange={(_, val) => setDashboardTab(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 700,
              fontSize: { xs: '0.82rem', sm: '0.92rem' },
              py: { xs: 1.25, sm: 1.5 },
              minHeight: 48,
              minWidth: { xs: 'auto', sm: 120 }
            }
          }}
        >
          <Tab
            icon={<GridViewIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={isMobile ? "Chỉ báo AHI" : "📊 Phân Tích & Chỉ Báo Học Tập"}
          />
          <Tab
            icon={<SchoolIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={isMobile ? `Lớp (${classes.length})` : `🏫 Chi Tiết Lớp Học (${classes.length})`}
          />
          <Tab
            icon={<AssignmentIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={isMobile ? `Bài tập (${assignments.length})` : `📝 Ngân Hàng Bài Tập (${assignments.length})`}
          />
          <Tab
            icon={<CampaignIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label={isMobile ? `Bảng tin (${announcements.length})` : `📢 Bảng Tin & Thông Báo (${announcements.length})`}
          />
        </Tabs>
      </Box>

      {dashboardTab === 0 && (
        <>
          {/* Biểu đồ Xu hướng Hoàn thành theo thời gian */}
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.04)', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2.5, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Xu Hướng Học Tập Toàn Trường
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.78rem' }}>
              Theo dõi tiến độ hoàn thành bài tập và nộp bài đúng hạn từ Google Classroom
            </Typography>
          </Box>
          <Chip
            label={trendData.length > 0 ? 'Dữ liệu thời gian thực' : 'Đang chờ chu kỳ đồng bộ'}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.72rem',
              bgcolor: trendData.length > 0 ? '#ecfdf5' : '#f8fafc',
              color: trendData.length > 0 ? '#065f46' : '#64748b',
              border: '1px solid',
              borderColor: trendData.length > 0 ? '#a7f3d0' : '#e2e8f0'
            }}
          />
        </Box>

        {trendData.length > 0 ? (
          <Box sx={{ width: '100%', height: { xs: 240, sm: 290 } }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: isMobile ? -20 : -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="#94a3b8" fontSize={12} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="completion"
                  name="Tỷ lệ nộp bài (%)"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="onTime"
                  name="Tỷ lệ đúng hạn (%)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 2.5 }}>
            <Typography variant="body2" fontWeight={700} color="#0f172a" sx={{ mb: 0.5, fontSize: '0.84rem' }}>
              Chưa có dữ liệu lịch sử theo dõi
            </Typography>
            <Typography variant="caption" color="#64748b">
              Biểu đồ sẽ tự động hiển thị tiến trình khi dữ liệu bài nộp được tích lũy theo từng chu kỳ đồng bộ Google Classroom.
            </Typography>
          </Box>
        )}
      </Card>

      {/* BẢN ĐỒ NHIỆT KHỐI & BỘ MÔN (GRADE-SUBJECT HEATMAP MATRIX) */}
      {pulseData?.heatmap && (
        <Card sx={{ p: 2.5, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                Bản Đồ Nhiệt Học Tập Khối & Bộ Môn (Grade-Subject Heatmap)
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Ma trận tỷ lệ hoàn thành bài tập theo khối và bộ môn — Giúp Ban Giám hiệu phát hiện điểm nghẽn
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label="> 85% Xuất sắc" size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.7rem' }} />
              <Chip label="70–85% Tốt" size="small" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.7rem' }} />
              <Chip label="50–70% Cảnh báo" size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 700, fontSize: '0.7rem' }} />
              <Chip label="< 50% Nguy cơ" size="small" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 700, fontSize: '0.7rem' }} />
            </Stack>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', width: 220 }}>Bộ môn</TableCell>
                  {(pulseData.heatmap.grades || [6, 7, 8, 9]).map((g: number) => (
                    <TableCell key={g} align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>
                      Khối {g}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {(pulseData.heatmap.subjects || []).map((sub: any) => (
                  <TableRow key={sub.code} hover>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>{sub.name}</TableCell>
                    {(pulseData.heatmap.grades || [6, 7, 8, 9]).map((g: number) => {
                      const cell = (pulseData.heatmap.cells || []).find((c: any) => c.grade === g && c.subjectCode === sub.code);
                      const rate = cell?.completionRate || 0;
                      let bg = '#fee2e2';
                      let color = '#b91c1c';
                      if (rate >= 85) {
                        bg = '#dcfce7';
                        color = '#15803d';
                      } else if (rate >= 70) {
                        bg = '#e0f2fe';
                        color = '#0369a1';
                      } else if (rate >= 50) {
                        bg = '#fef3c7';
                        color = '#b45309';
                      }
                      return (
                        <TableCell key={g} align="center">
                          <Chip
                            label={`${rate}%`}
                            size="small"
                            sx={{
                              bgcolor: bg,
                              color,
                              fontWeight: 800,
                              borderRadius: 1.5,
                              minWidth: 54
                            }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* KHỐI CHỈ HUY SƯ PHẠM: TOP LỚP CẦN ĐÔN ĐỐC & GIÁM SÁT TỒN ĐỌNG CHẤM BÀI */}
      {pulseData && (
        <Grid container spacing={2.5} sx={{ mb: 4 }}>
          {/* CỘT TRÁI: TOP 5 LỚP CẦN ĐÔN ĐỐC */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Top Lớp Cần Đôn Đốc Nộp Bài Nhất
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Các lớp có tỷ lệ nộp bài tập Classroom thấp nhất toàn trường
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate('/classes')}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                >
                  Tất cả lớp
                </Button>
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Lớp</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>GVCN</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Sĩ số</TableCell>
                      <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Tiến độ nộp</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Hành động</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(pulseData.topAtRiskClasses || []).map((cls: any) => (
                      <TableRow key={cls.classId} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#1e293b' }}>
                          {cls.className}
                        </TableCell>
                        <TableCell sx={{ color: '#475569', fontSize: '0.82rem' }}>
                          {cls.homeroomTeacher}
                        </TableCell>
                        <TableCell sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                          {cls.studentCount} HS
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <Stack spacing={0.5}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: cls.completionRate < 70 ? '#dc2626' : '#2563eb' }}>
                              {cls.completionRate}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, cls.completionRate)}
                              color={cls.completionRate < 60 ? 'error' : cls.completionRate < 75 ? 'warning' : 'primary'}
                              sx={{ height: 5, borderRadius: 2.5 }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => {
                              handleNudgeSubmissions();
                            }}
                            sx={{ textTransform: 'none', fontWeight: 700, color: '#d97706', p: 0.5, minWidth: 0 }}
                          >
                            Đôn đốc
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Card>
          </Grid>

          {/* CỘT PHẢI: TỒN ĐỌNG CHẤM BÀI CỦA GIÁO VIÊN */}
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', height: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Giám Sát Tồn Đọng Chấm Bài (Backlog Tracker)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Khóa học có bài tập học sinh đã nộp nhưng giáo viên chưa trả điểm
                  </Typography>
                </Box>
                <Chip
                  label={`${pulseData.gradingBacklog?.totalBacklog || 0} bài chờ`}
                  size="small"
                  color={pulseData.gradingBacklog?.totalBacklog > 0 ? 'warning' : 'success'}
                  sx={{ fontWeight: 700 }}
                />
              </Box>

              {(!pulseData.gradingBacklog?.courses || pulseData.gradingBacklog.courses.length === 0) ? (
                <Box sx={{ py: 4, textAlign: 'center', bgcolor: '#f0fdf4', borderRadius: 2, border: '1px solid #bbf7d0' }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#166534' }}>
                    ✓ Xuất sắc! Tất cả bài nộp của học sinh đã được giáo viên chấm và trả điểm đầy đủ.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Khóa học Classroom</TableCell>
                        <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Lớp</TableCell>
                        <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Giáo viên</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Bài chờ chấm</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Thao tác</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pulseData.gradingBacklog.courses.map((c: any) => (
                        <TableRow key={c.id} hover>
                          <TableCell sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {c.name}
                          </TableCell>
                          <TableCell sx={{ color: '#475569', fontSize: '0.82rem' }}>
                            {c.className}
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                            {c.teacherName}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={`${c.pendingCount} bài`}
                              size="small"
                              sx={{
                                fontWeight: 800,
                                bgcolor: c.pendingCount > 10 ? '#fee2e2' : '#fef3c7',
                                color: c.pendingCount > 10 ? '#b91c1c' : '#b45309'
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            {c.alternateLink ? (
                              <Button
                                size="small"
                                variant="outlined"
                                href={c.alternateLink}
                                target="_blank"
                                rel="noreferrer"
                                endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5, py: 0.25 }}
                              >
                                Mở lớp
                              </Button>
                            ) : (
                              <Button
                                size="small"
                                variant="text"
                                onClick={() => navigate('/teachers')}
                                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem' }}
                              >
                                Nhắc GV
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Card>
          </Grid>
        </Grid>
      )}
    </>
  )}

  {/* TAB 1: CHI TIẾT TỪNG LỚP HỌC (SCHOOL CLASSES COCKPIT) */}
  {dashboardTab === 1 && (
    <Box sx={{ mb: 4 }}>
      {/* Thanh công cụ tìm kiếm và lọc lớp */}
      <Card sx={{ p: 2, mb: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Tìm theo tên lớp, GVCN, phòng..."
              value={classSearch}
              onChange={(e) => setClassSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 2.5 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Khối</InputLabel>
              <Select
                value={classGradeFilter}
                label="Khối"
                onChange={(e) => setClassGradeFilter(e.target.value)}
              >
                <MenuItem value="all">Tất cả các khối</MenuItem>
                <MenuItem value="6">Khối 6</MenuItem>
                <MenuItem value="7">Khối 7</MenuItem>
                <MenuItem value="8">Khối 8</MenuItem>
                <MenuItem value="9">Khối 9</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 5.5 }}>
            <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-start', md: 'flex-end' }, alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Hiển thị <strong>{filteredClasses.length}</strong> / {classes.length} lớp học
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<SchoolIcon />}
                onClick={() => navigate('/classes')}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
              >
                Quản Lý Lớp Học
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Bảng/Thẻ danh sách lớp học */}
      {isMobile ? (
        <Stack spacing={1.5}>
          {filteredClasses.length === 0 ? (
            <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
              <Typography variant="body2" color="#64748b">
                Không tìm thấy lớp học nào phù hợp với điều kiện tìm kiếm.
              </Typography>
            </Card>
          ) : (
            filteredClasses.map((cls, idx) => (
              <Card
                key={cls.classId || idx}
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{
                        fontWeight: 800,
                        color: '#2563eb',
                        lineHeight: 1.2,
                        cursor: 'pointer'
                      }}
                      onClick={() => handleOpenClassDetail(cls.classId)}
                    >
                      Lớp {cls.className}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.25 }}>
                      GVCN: <strong>{cls.homeroomTeacher || 'Chưa phân công'}</strong> • {cls.room || 'Phòng —'}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={0.75} alignItems="center">
                    <Chip label={`Khối ${cls.grade || '—'}`} size="small" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                    <Chip label={`${cls.studentCount || 0} HS`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                  </Stack>
                </Box>

                <Box sx={{ bgcolor: '#f8fafc', p: 1.25, borderRadius: 2, mb: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 600 }}>
                      Nộp bài: <strong>{cls.completionRate || 0}%</strong> ({cls.courseCount || 0} môn)
                    </Typography>
                    <Typography variant="caption" sx={{ color: (cls.onTimeRate || 0) >= 75 ? '#0284c7' : '#d97706', fontWeight: 700 }}>
                      {cls.onTimeRate || 0}% đúng hạn
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(100, cls.completionRate || 0)}
                    color={(cls.completionRate || 0) >= 80 ? 'success' : (cls.completionRate || 0) >= 60 ? 'warning' : 'error'}
                    sx={{ height: 6, borderRadius: 3 }}
                  />
                </Box>

                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    startIcon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
                    onClick={() => handleOpenClassDetail(cls.classId)}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.8rem',
                      borderRadius: 2,
                      py: 0.85,
                      minHeight: 40,
                      bgcolor: '#2563eb',
                      boxShadow: 'none'
                    }}
                  >
                    Xem Chi Tiết Lớp
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={handleNudgeSubmissions}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.78rem',
                      borderRadius: 2,
                      minHeight: 40,
                      px: 1.5,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Đôn đốc
                  </Button>
                </Stack>
              </Card>
            ))
          )}
        </Stack>
      ) : (
        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', width: 45 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Lớp học</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Khối</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Giáo viên chủ nhiệm</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Phòng</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Sĩ số SSOT</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', minWidth: 150 }}>Tiến độ nộp bài</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Đúng hạn</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClasses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 6, color: '#64748b' }}>
                      Không tìm thấy lớp học nào phù hợp với điều kiện tìm kiếm.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClasses.map((cls, idx) => (
                    <TableRow key={cls.classId || idx} hover>
                      <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>{idx + 1}</TableCell>
                      <TableCell>
                        <Typography
                          variant="subtitle2"
                          sx={{
                            fontWeight: 800,
                            color: '#2563eb',
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline' }
                          }}
                          onClick={() => handleOpenClassDetail(cls.classId)}
                        >
                          {cls.className}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={`Khối ${cls.grade || '—'}`} size="small" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                      </TableCell>
                      <TableCell sx={{ color: '#334155', fontWeight: 600, fontSize: '0.85rem' }}>
                        {cls.homeroomTeacher || 'Chưa phân công'}
                      </TableCell>
                      <TableCell sx={{ color: '#64748b', fontSize: '0.82rem' }}>
                        {cls.room || '—'}
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={`${cls.studentCount || 0} HS`} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="caption" sx={{ fontWeight: 700, color: (cls.completionRate || 0) < 70 ? '#dc2626' : '#16a34a' }}>
                              {cls.completionRate || 0}%
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {cls.courseCount || 0} môn
                            </Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, cls.completionRate || 0)}
                            color={(cls.completionRate || 0) >= 80 ? 'success' : (cls.completionRate || 0) >= 60 ? 'warning' : 'error'}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" sx={{ fontWeight: 700, color: (cls.onTimeRate || 0) >= 75 ? '#0284c7' : '#d97706' }}>
                          {cls.onTimeRate || 0}%
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<VisibilityRoundedIcon sx={{ fontSize: 14 }} />}
                            onClick={() => handleOpenClassDetail(cls.classId)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75rem', borderRadius: 1.5, bgcolor: '#2563eb', px: 1.5 }}
                          >
                            Chi tiết
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="warning"
                            onClick={handleNudgeSubmissions}
                            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5, px: 1 }}
                          >
                            Đôn đốc
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  )}

  {/* TAB 2: NGÂN HÀNG BÀI TẬP (COURSEWORK FEED) */}
  {dashboardTab === 2 && (
    <Box sx={{ mb: 4 }}>
      {/* Thanh lọc bài tập */}
      <Card sx={{ p: 2, mb: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Tìm theo tiêu đề bài tập, tên môn..."
              value={assignmentSearch}
              onChange={(e) => setAssignmentSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Lọc theo Lớp</InputLabel>
              <Select
                value={assignmentClassFilter}
                label="Lọc theo Lớp"
                onChange={(e) => setAssignmentClassFilter(e.target.value)}
              >
                <MenuItem value="ALL">Tất cả các lớp</MenuItem>
                {classOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Có <strong>{filteredAssignments.length}</strong> bài tập
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchAssignments}
                disabled={loadingAssignments}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Làm mới
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Bảng/Thẻ danh sách bài tập */}
      {loadingAssignments ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
            Đang nạp ngân hàng bài tập Google Classroom...
          </Typography>
        </Box>
      ) : filteredAssignments.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center', borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
          <AssignmentIcon sx={{ fontSize: 44, color: '#cbd5e1', mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#64748b' }}>
            Chưa có bài tập nào phù hợp
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Các bài tập được tự động đồng bộ từ Google Classroom
          </Typography>
        </Card>
      ) : isMobile ? (
        <Stack spacing={1.5}>
          {filteredAssignments.map((a, idx) => (
            <Card
              key={a.id || idx}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2.5,
                border: '1px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Chip label={a.subjectName} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }} />
                  <Chip label={a.className} size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9', fontSize: '0.7rem', height: 22 }} />
                </Stack>
                <Chip label={`${a.maxPoints}đ`} size="small" sx={{ fontWeight: 700, bgcolor: '#f0fdf4', color: '#166534', height: 22, fontSize: '0.7rem' }} />
              </Box>

              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 800,
                  color: '#0f172a',
                  lineHeight: 1.35,
                  mb: 1,
                  cursor: 'pointer',
                  '&:hover': { color: '#2563eb' }
                }}
                onClick={() => {
                  setSelectedAssignment(a);
                  setOpenAssignmentDialog(true);
                }}
              >
                {a.title}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.25, color: '#64748b', fontSize: '0.78rem' }}>
                <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                <span>Hạn nộp: <strong>{a.dueDate || 'Không hạn chót'}</strong></span>
              </Stack>

              <Box sx={{ bgcolor: '#f8fafc', p: 1.25, borderRadius: 2, mb: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: a.completionRate >= 70 ? '#16a34a' : '#d97706', display: 'block', mb: 0.5 }}>
                  Tiến độ nộp: {a.turnedInCount}/{a.totalStudents} HS ({a.completionRate}%)
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, a.completionRate)}
                  color={a.completionRate >= 70 ? 'success' : 'warning'}
                  sx={{ height: 6, borderRadius: 3 }}
                />
              </Box>

              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setSelectedAssignment(a);
                    setOpenAssignmentDialog(true);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', borderRadius: 2, minHeight: 40 }}
                >
                  Chi tiết đề bài
                </Button>
                {a.alternateLink && (
                  <Button
                    size="small"
                    variant="contained"
                    component="a"
                    href={a.alternateLink}
                    target="_blank"
                    rel="noreferrer"
                    startIcon={<OpenInNewIcon sx={{ fontSize: 14 }} />}
                    sx={{
                      minWidth: 44,
                      minHeight: 40,
                      borderRadius: 2,
                      bgcolor: '#2563eb',
                      color: '#fff',
                      px: 1.5,
                      textTransform: 'none',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Classroom
                  </Button>
                )}
              </Stack>
            </Card>
          ))}
        </Stack>
      ) : (
        <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', width: 45 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', minWidth: 240 }}>Tiêu đề bài tập</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Môn học</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Lớp</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Hạn nộp</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Thang điểm</TableCell>
                  <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', minWidth: 140 }}>Tiến độ nộp</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc' }}>Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAssignments.map((a, idx) => (
                  <TableRow key={a.id || idx} hover>
                    <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>{idx + 1}</TableCell>
                    <TableCell>
                      <Typography
                        variant="subtitle2"
                        sx={{
                          fontWeight: 700,
                          color: '#0f172a',
                          cursor: 'pointer',
                          '&:hover': { color: '#2563eb', textDecoration: 'underline' }
                        }}
                        onClick={() => {
                          setSelectedAssignment(a);
                          setOpenAssignmentDialog(true);
                        }}
                      >
                        {a.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={a.subjectName} size="small" color="primary" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                    </TableCell>
                    <TableCell>
                      <Chip label={a.className} size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9', fontSize: '0.72rem' }} />
                    </TableCell>
                    <TableCell sx={{ color: '#475569', fontSize: '0.82rem' }}>
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <CalendarTodayRoundedIcon sx={{ fontSize: 13, color: '#94a3b8' }} />
                        <span>{a.dueDate || 'Không hạn chót'}</span>
                      </Stack>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={`${a.maxPoints}đ`} size="small" sx={{ fontWeight: 700, bgcolor: '#f0fdf4', color: '#166534' }} />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: a.completionRate >= 70 ? '#16a34a' : '#d97706' }}>
                          {a.turnedInCount}/{a.totalStudents} HS ({a.completionRate}%)
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, a.completionRate)}
                          color={a.completionRate >= 70 ? 'success' : 'warning'}
                          sx={{ height: 5, borderRadius: 2.5 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.75} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setSelectedAssignment(a);
                            setOpenAssignmentDialog(true);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, py: 0.25 }}
                        >
                          Chi tiết
                        </Button>
                        {a.alternateLink && (
                          <MuiTooltip title="Mở trên Google Classroom">
                            <IconButton
                              size="small"
                              component="a"
                              href={a.alternateLink}
                              target="_blank"
                              rel="noreferrer"
                              sx={{ color: '#2563eb', bgcolor: '#eff6ff' }}
                            >
                              <OpenInNewIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </MuiTooltip>
                        )}
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}
    </Box>
  )}

  {/* TAB 3: BẢNG TIN & THÔNG BÁO LỚP HỌC (ANNOUNCEMENTS FEED) */}
  {dashboardTab === 3 && (
    <Box sx={{ mb: 4 }}>
      {/* Thanh lọc thông báo */}
      <Card sx={{ p: 2, mb: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 5 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Tìm kiếm nội dung thông báo..."
              value={announcementSearch}
              onChange={(e) => setAnnouncementSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 3 }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Lọc theo Lớp</InputLabel>
              <Select
                value={announcementClassFilter}
                label="Lọc theo Lớp"
                onChange={(e) => setAnnouncementClassFilter(e.target.value)}
              >
                <MenuItem value="ALL">Tất cả các lớp</MenuItem>
                {classOptions.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 6, sm: 3, md: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Có <strong>{filteredAnnouncements.length}</strong> thông báo
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchAnnouncements}
                disabled={loadingAnnouncements}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Làm mới
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Danh sách thông báo */}
      {loadingAnnouncements ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
            Đang tải thông báo từ Google Classroom...
          </Typography>
        </Box>
      ) : filteredAnnouncements.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center', borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <CampaignIcon sx={{ fontSize: 44, color: '#cbd5e1', mb: 1 }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#64748b' }}>
            Chưa có thông báo nào từ các lớp
          </Typography>
          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
            Khi giáo viên đăng thông báo hoặc dặn dò trên Google Classroom, nội dung sẽ lập tức hiển thị tại đây.
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredAnnouncements.map((ann, idx) => (
            <Grid size={{ xs: 12, md: 6 }} key={ann.id || idx}>
              <Card
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  bgcolor: '#ffffff',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    borderColor: '#bfdbfe',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                  }
                }}
              >
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip label={ann.className} size="small" color="primary" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                      <Chip label={ann.subjectName} size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                    </Stack>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                      {ann.creationTime ? new Date(ann.creationTime).toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </Typography>
                  </Box>

                  <Typography
                    variant="body2"
                    sx={{
                      color: '#1e293b',
                      fontWeight: 500,
                      lineHeight: 1.6,
                      display: '-webkit-box',
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {ann.text}
                  </Typography>

                  {ann.materials?.length > 0 && (
                    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <AttachFileRoundedIcon sx={{ fontSize: 15, color: '#64748b' }} />
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                        {ann.materials.length} tệp / liên kết đính kèm
                      </Typography>
                    </Box>
                  )}
                </Box>

                <Box sx={{ pt: 2, borderTop: '1px solid #f1f5f9', mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => {
                      setSelectedAnnouncement(ann);
                      setOpenAnnouncementDialog(true);
                    }}
                    sx={{ textTransform: 'none', fontWeight: 700, color: '#2563eb', p: 0 }}
                  >
                    Xem toàn văn
                  </Button>
                  {ann.alternateLink && (
                    <Button
                      size="small"
                      variant="outlined"
                      href={ann.alternateLink}
                      target="_blank"
                      rel="noreferrer"
                      endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                      sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, py: 0.25 }}
                    >
                      Classroom
                    </Button>
                  )}
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )}

  {/* DIALOG 1: CHI TIẾT LỚP HỌC TOÀN DIỆN NGAY TRÊN DASHBOARD */}
  <Dialog
    open={openClassDetailDialog}
    onClose={() => setOpenClassDetailDialog(false)}
    maxWidth="md"
    fullWidth
    fullScreen={isMobile}
  >
    <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Lớp {classDetail?.class?.className || selectedClassId} — Chi Tiết Điều Hành Lớp Học
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
            GVCN: <strong>{classDetail?.class?.homeroomTeacher || 'Chưa phân công'}</strong> • Sĩ số SSOT: <strong>{classDetail?.students?.length || 0} học sinh</strong> • Phòng: <strong>{classDetail?.class?.room || '—'}</strong>
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setOpenClassDetailDialog(false)} aria-label="Đóng" sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </DialogTitle>

    <DialogContent dividers sx={{ p: 0 }}>
      {loadingClassDetail ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" sx={{ color: '#64748b', mt: 1.5 }}>
            Đang nạp dữ liệu chi tiết lớp học từ Google Classroom...
          </Typography>
        </Box>
      ) : !classDetail ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Không thể tải thông tin chi tiết của lớp này.
          </Typography>
        </Box>
      ) : (
        <Box>
          <Tabs
            value={classDetailTab}
            onChange={(_, val) => setClassDetailTab(val)}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            sx={{ px: { xs: 1, sm: 2.5 }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
          >
            <Tab label={`Học sinh (${classDetail.students?.length || 0})`} sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.78rem', sm: '0.85rem' } }} />
            <Tab label={`Khóa học (${classDetail.courses?.length || 0})`} sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.78rem', sm: '0.85rem' } }} />
            <Tab label="Thống kê Bộ môn" sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.78rem', sm: '0.85rem' } }} />
            <Tab
              label={`Đối soát Liên môn (${classDetail.crossSubjectDiscrepancies?.length ? `⚠️ ${classDetail.crossSubjectDiscrepancies.length}` : '✓'})`}
              sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.78rem', sm: '0.85rem' }, color: classDetail.crossSubjectDiscrepancies?.length ? '#dc2626' : undefined }}
            />
            <Tab label="Lịch Tải Tuần" sx={{ textTransform: 'none', fontWeight: 700, fontSize: { xs: '0.78rem', sm: '0.85rem' } }} />
          </Tabs>

          <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxHeight: isMobile ? 'calc(100vh - 140px)' : 480, overflowY: 'auto' }}>
            {/* TAB 0: Danh sách học sinh */}
            {classDetailTab === 0 && (
              isMobile ? (
                <Stack spacing={1.25}>
                  {(classDetail.students || []).map((st: any, sIdx: number) => (
                    <Card key={st.userId || sIdx} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Avatar
                            src={st.photoUrl || undefined}
                            sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#e0e7ff', color: '#3730a3' }}
                          >
                            {(st.name || 'H')[0].toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {st.name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              {st.email || '—'}
                            </Typography>
                          </Box>
                        </Stack>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setOpenClassDetailDialog(false);
                            navigate(`/students/360?studentId=${encodeURIComponent(st.userId)}`);
                          }}
                          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, minHeight: 32 }}
                        >
                          Hồ sơ 360°
                        </Button>
                      </Box>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Nộp bài: <strong>{st.turnedInCount}/{st.totalAssignments}</strong> ({st.completionRate}%)
                        </Typography>
                        {st.averageScore != null && (
                          <Chip
                            label={`${st.averageScore.toFixed(1)}đ`}
                            size="small"
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              height: 20,
                              bgcolor: st.averageScore >= 8 ? '#f0fdf4' : '#eff6ff',
                              color: st.averageScore >= 8 ? '#15803d' : '#1d4ed8'
                            }}
                          />
                        )}
                      </Stack>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Học sinh</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Email Google</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Số môn</TableCell>
                        <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Tiến độ nộp bài</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Điểm TB</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Hồ sơ 360°</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(classDetail.students || []).map((st: any, sIdx: number) => (
                        <TableRow key={st.userId || sIdx} hover>
                          <TableCell sx={{ color: '#64748b' }}>{sIdx + 1}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Avatar
                                src={st.photoUrl || undefined}
                                sx={{ width: 26, height: 26, fontSize: '0.75rem', bgcolor: '#e0e7ff', color: '#3730a3' }}
                              >
                                {(st.name || 'H')[0].toUpperCase()}
                              </Avatar>
                              <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                                {st.name}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>{st.email || '—'}</TableCell>
                          <TableCell sx={{ color: '#475569' }}>{st.courseCount} môn</TableCell>
                          <TableCell sx={{ minWidth: 140 }}>
                            <Stack spacing={0.5}>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {st.turnedInCount}/{st.totalAssignments} bài
                                </Typography>
                                <Typography variant="caption" sx={{ fontWeight: 700, color: st.completionRate >= 70 ? '#16a34a' : '#d97706' }}>
                                  {st.completionRate}%
                                </Typography>
                              </Stack>
                              <LinearProgress
                                variant="determinate"
                                value={st.completionRate}
                                color={st.completionRate >= 70 ? 'success' : 'warning'}
                                sx={{ height: 5, borderRadius: 2.5 }}
                              />
                            </Stack>
                          </TableCell>
                          <TableCell align="center">
                            {st.averageScore != null ? (
                              <Chip
                                label={st.averageScore.toFixed(1)}
                                size="small"
                                sx={{
                                  fontWeight: 700,
                                  bgcolor: st.averageScore >= 8 ? '#f0fdf4' : '#eff6ff',
                                  color: st.averageScore >= 8 ? '#15803d' : '#1d4ed8'
                                }}
                              />
                            ) : (
                              <Typography variant="caption" sx={{ color: '#94a3b8' }}>—</Typography>
                            )}
                          </TableCell>
                          <TableCell align="right">
                            <Button
                              size="small"
                              variant="outlined"
                              endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                              onClick={() => {
                                setOpenClassDetailDialog(false);
                                navigate(`/students/360?studentId=${encodeURIComponent(st.userId)}`);
                              }}
                              sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, py: 0.25 }}
                            >
                              360°
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )
            )}

            {/* TAB 1: Khóa học Classroom */}
            {classDetailTab === 1 && (
              <Stack spacing={1.5}>
                {(classDetail.courses || []).map((c: any) => (
                  <Card key={c.id} variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {c.name}
                        </Typography>
                        {c.subjectName && (
                          <Chip label={c.subjectName} size="small" color="primary" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                        )}
                      </Stack>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 0.5 }}>
                        Mã khóa học: {c.id} • Bài tập: <strong>{c.contentCoursework || 0}</strong> • Lượt nộp: <strong>{c.submissionsTotal || 0}</strong>
                      </Typography>
                    </Box>
                    {c.alternateLink && (
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNewIcon sx={{ fontSize: 13 }} />}
                        href={c.alternateLink}
                        target="_blank"
                        rel="noreferrer"
                        sx={{ textTransform: 'none', borderRadius: 1.5 }}
                      >
                        Mở lớp
                      </Button>
                    )}
                  </Card>
                ))}
              </Stack>
            )}

            {/* TAB 2: Thống kê Bộ môn */}
            {classDetailTab === 2 && (
              <Grid container spacing={2}>
                {(classDetail.subjectsSummary || []).map((sub: any, idx: number) => (
                  <Grid size={{ xs: 12, sm: 6 }} key={idx}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                        {sub.name}
                      </Typography>
                      <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: '#64748b' }}>Tỷ lệ nộp bài:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#16a34a' }}>{sub.completionRate}%</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: '#64748b' }}>Đúng hạn:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#0284c7' }}>{sub.onTimeRate}%</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="caption" sx={{ color: '#64748b' }}>Điểm trung bình:</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#7c3aed' }}>{sub.averageScore != null ? `${sub.averageScore}đ` : '—'}</Typography>
                        </Stack>
                      </Stack>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}

            {/* TAB 3: Đối soát Liên môn */}
            {classDetailTab === 3 && (
              <Box>
                {(!classDetail.crossSubjectDiscrepancies || classDetail.crossSubjectDiscrepancies.length === 0) ? (
                  <Box sx={{ p: 4, border: '1px solid #bbf7d0', borderRadius: 2.5, bgcolor: '#f0fdf4', textAlign: 'center' }}>
                    <CheckCircleRoundedIcon sx={{ fontSize: 44, color: '#16a34a', mb: 1 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#166534' }}>
                      Dữ Liệu Khớp 100% — Không Có Độ Vênh Sĩ Số
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#15803d', mt: 0.5 }}>
                      Tất cả {classDetail.students?.length || 0} học sinh trong lớp đều tham gia đầy đủ tất cả {classDetail.courses?.length || 0} khóa học Google Classroom.
                    </Typography>
                  </Box>
                ) : (
                  <Stack spacing={2}>
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      Phát hiện <strong>{classDetail.crossSubjectDiscrepancies.length} học sinh</strong> chưa được thêm đầy đủ vào tất cả các khóa học bộ môn của lớp.
                    </Alert>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Học sinh</TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Email Google</TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Số môn đã vào</TableCell>
                            <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Môn học còn thiếu</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {classDetail.crossSubjectDiscrepancies.map((d: any, idx: number) => (
                            <TableRow key={d.userId || idx} hover>
                              <TableCell sx={{ fontWeight: 600 }}>{d.name}</TableCell>
                              <TableCell sx={{ color: '#64748b' }}>{d.email || '—'}</TableCell>
                              <TableCell>
                                <Chip label={`${d.enrolledCount}/${d.totalCourses} môn`} size="small" color="warning" sx={{ fontWeight: 700 }} />
                              </TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {(d.missingCourseNames || []).map((m: string, mIdx: number) => (
                                    <Chip key={mIdx} label={m} size="small" color="error" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.72rem' }} />
                                  ))}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                )}
              </Box>
            )}

            {/* TAB 4: Lịch Tải Bài Tập Tuần */}
            {classDetailTab === 4 && (
              <Box>
                <Grid container spacing={1.5}>
                  {(classDetail.weeklyWorkload || []).map((w: any, idx: number) => (
                    <Grid size={{ xs: 6, sm: 3, md: 1.7 }} key={idx}>
                      <Card
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 2,
                          textAlign: 'center',
                          borderColor: w.isHeavy ? '#fca5a5' : '#e2e8f0',
                          bgcolor: w.isHeavy ? '#fef2f2' : '#ffffff'
                        }}
                      >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155' }}>
                          {w.day}
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, my: 0.5, color: w.isHeavy ? '#dc2626' : '#2563eb' }}>
                          {w.count} bài
                        </Typography>
                        <Chip
                          label={w.isHeavy ? 'Quá tải (> 3 bài)' : w.count > 0 ? 'Bình thường' : 'Không có'}
                          size="small"
                          color={w.isHeavy ? 'error' : w.count > 0 ? 'primary' : 'default'}
                          sx={{ fontSize: '0.68rem', fontWeight: 600, height: 20 }}
                        />
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </DialogContent>

    <DialogActions sx={{ px: 3, py: 2 }}>
      <Button onClick={() => setOpenClassDetailDialog(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
        Đóng
      </Button>
      <Button
        variant="contained"
        color="primary"
        onClick={() => {
          setOpenClassDetailDialog(false);
          navigate('/classes');
        }}
        sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, bgcolor: '#2563eb' }}
      >
        Quản Lý Toàn Bộ Lớp
      </Button>
    </DialogActions>
  </Dialog>

  {/* DIALOG 2: CHI TIẾT BÀI TẬP (COURSEWORK) */}
  <Dialog
    open={openAssignmentDialog}
    onClose={() => setOpenAssignmentDialog(false)}
    maxWidth="sm"
    fullWidth
    fullScreen={isMobile}
  >
    <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Chi Tiết Bài Tập
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Đồng bộ trực tiếp từ Google Classroom SSOT
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setOpenAssignmentDialog(false)} aria-label="Đóng" sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </DialogTitle>

    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {selectedAssignment && (
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', mb: 1, fontSize: { xs: '1.05rem', sm: '1.25rem' } }}>
              {selectedAssignment.title}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`Lớp ${selectedAssignment.className}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Chip label={selectedAssignment.subjectName} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
              <Chip label={selectedAssignment.state || 'PUBLISHED'} size="small" color="success" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Hạn nộp bài</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mt: 0.25 }}>
                  {selectedAssignment.dueDate || 'Không giới hạn'}
                </Typography>
              </Card>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ color: '#64748b' }}>Điểm tối đa</Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#16a34a', mt: 0.25 }}>
                  {selectedAssignment.maxPoints} điểm
                </Typography>
              </Card>
            </Grid>
          </Grid>

          <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tiến độ nộp bài của học sinh
            </Typography>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ my: 0.5 }}>
              <Typography variant="h5" sx={{ fontWeight: 800, color: '#2563eb' }}>
                {selectedAssignment.turnedInCount} / {selectedAssignment.totalStudents} HS
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#16a34a' }}>
                {selectedAssignment.completionRate}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, selectedAssignment.completionRate)}
              color="primary"
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Card>

          {selectedAssignment.description && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Mô tả & Hướng dẫn làm bài
              </Typography>
              <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#ffffff' }}>
                <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selectedAssignment.description}
                </Typography>
              </Card>
            </Box>
          )}

          {selectedAssignment.materials?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 0.5 }}>
                Tài liệu & Tệp đính kèm ({selectedAssignment.materials.length})
              </Typography>
              <Stack spacing={1}>
                {selectedAssignment.materials.map((m: any, idx: number) => {
                  const item = m.driveFile || m.youtubeVideo || m.link || m.form;
                  const title = item?.title || item?.name || 'Tài liệu liên kết';
                  const url = item?.alternateLink || item?.url;
                  return (
                    <Card key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AttachFileRoundedIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {title}
                        </Typography>
                      </Stack>
                      {url && (
                        <Button
                          size="small"
                          variant="outlined"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.25, fontSize: '0.72rem' }}
                        >
                          Xem
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </DialogContent>

    <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
      <Button fullWidth={isMobile} onClick={() => setOpenAssignmentDialog(false)} sx={{ textTransform: 'none', color: '#64748b', minHeight: 40 }}>
        Đóng
      </Button>
      {selectedAssignment?.alternateLink && (
        <Button
          fullWidth={isMobile}
          variant="contained"
          color="primary"
          component="a"
          href={selectedAssignment.alternateLink}
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNewIcon />}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, bgcolor: '#2563eb', minHeight: 40 }}
        >
          Mở Bài Tập Trên Classroom
        </Button>
      )}
    </DialogActions>
  </Dialog>

  {/* DIALOG 3: CHI TIẾT THÔNG BÁO LỚP HỌC */}
  <Dialog
    open={openAnnouncementDialog}
    onClose={() => setOpenAnnouncementDialog(false)}
    maxWidth="sm"
    fullWidth
    fullScreen={isMobile}
  >
    <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a', fontSize: { xs: '1rem', sm: '1.25rem' } }}>
            Chi Tiết Thông Báo Lớp Học
          </Typography>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Đăng trên Google Classroom
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setOpenAnnouncementDialog(false)} aria-label="Đóng" sx={{ bgcolor: '#ffffff', border: '1px solid #e2e8f0' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    </DialogTitle>

    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {selectedAnnouncement && (
        <Stack spacing={2.5}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Stack direction="row" spacing={1}>
              <Chip label={`Lớp ${selectedAnnouncement.className}`} size="small" color="primary" sx={{ fontWeight: 700 }} />
              <Chip label={selectedAnnouncement.subjectName} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {selectedAnnouncement.creationTime ? new Date(selectedAnnouncement.creationTime).toLocaleString('vi-VN') : ''}
            </Typography>
          </Box>

          <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
            <Typography variant="body1" sx={{ color: '#0f172a', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
              {selectedAnnouncement.text}
            </Typography>
          </Card>

          {selectedAnnouncement.materials?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a', mb: 1 }}>
                Tài liệu đính kèm ({selectedAnnouncement.materials.length})
              </Typography>
              <Stack spacing={1}>
                {selectedAnnouncement.materials.map((m: any, idx: number) => {
                  const item = m.driveFile || m.youtubeVideo || m.link || m.form;
                  const title = item?.title || item?.name || 'Tài liệu liên kết';
                  const url = item?.alternateLink || item?.url;
                  return (
                    <Card key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <AttachFileRoundedIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {title}
                        </Typography>
                      </Stack>
                      {url && (
                        <Button
                          size="small"
                          variant="outlined"
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
                          sx={{ textTransform: 'none', borderRadius: 1.5, py: 0.25, fontSize: '0.72rem' }}
                        >
                          Xem
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      )}
    </DialogContent>

    <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, flexDirection: { xs: 'column-reverse', sm: 'row' }, gap: 1 }}>
      <Button fullWidth={isMobile} onClick={() => setOpenAnnouncementDialog(false)} sx={{ textTransform: 'none', color: '#64748b', minHeight: 40 }}>
        Đóng
      </Button>
      {selectedAnnouncement?.alternateLink && (
        <Button
          fullWidth={isMobile}
          variant="contained"
          color="primary"
          component="a"
          href={selectedAnnouncement.alternateLink}
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNewIcon />}
          sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, bgcolor: '#2563eb', minHeight: 40 }}
        >
          Mở Trên Classroom
        </Button>
      )}
    </DialogActions>
  </Dialog>
</>
);
}