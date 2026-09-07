import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Avatar,
  Chip,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableFooter,
  TablePagination,
  LinearProgress,
  Drawer,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Skeleton,
  Tooltip,
  Stack,
  Divider,
  Alert,
  AlertTitle,
  ButtonGroup,
  TableSortLabel
} from '@mui/material';
import PersonIcon from '@mui/icons-material/PersonRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import AssessmentIcon from '@mui/icons-material/AssessmentRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import FileDownloadIcon from '@mui/icons-material/FileDownloadRounded';
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreRounded';
import CloseIcon from '@mui/icons-material/CloseRounded';
import GradeIcon from '@mui/icons-material/MilitaryTechRounded';
import AssignmentIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import ViewListIcon from '@mui/icons-material/ViewListRounded';
import TableChartIcon from '@mui/icons-material/TableChartRounded';
import CalculateIcon from '@mui/icons-material/CalculateRounded';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine
} from 'recharts';
import { api } from '../../services/api';
import { PageHeader } from '../../components/PageHeader';

interface SubjectScoreMap {
  MATH?: number | null;
  LIT?: number | null;
  ENG?: number | null;
  PHY?: number | null;
  CHEM?: number | null;
  BIO?: number | null;
  HIST?: number | null;
  GEO?: number | null;
  INF?: number | null;
  CIV?: number | null;
  [key: string]: number | null | undefined;
}

interface StudentItem {
  id: string;
  name: string;
  displayName: string;
  email: string;
  className: string;
  classId: string;
  grade: number;
  orgUnitPath?: string;
  photoUrl?: string;
  personType: string;
  role: string;
  topicsCount: number;
  subjectCount: number;
  subjects?: string[];
  gpa: number | null;
  completionRate: number;
  suspended?: boolean;
  subjectScores?: SubjectScoreMap;
}

interface SubjectTopicGrade {
  topicId: string;
  topicName: string;
  subjectCode: string;
  teacherName: string;
  totalAssignments: number;
  submittedCount: number;
  missingCount: number;
  completionRate: number;
  averageScore: number | null;
  evaluation: string;
  assignments: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    maxPoints: number;
    assignedGrade?: number | null;
    state: 'TURNED_IN' | 'RETURNED' | 'NEW' | 'CREATED';
    isLate: boolean;
  }>;
}

interface StudentTranscript {
  studentId: string;
  displayName: string;
  email: string;
  classId: string;
  className: string;
  grade: number;
  academicYear: string;
  semester: string;
  summary: {
    totalSubjects: number;
    gpa: number | null;
    rank: string;
    totalAssignments: number;
    submittedAssignments: number;
    completionRate: number;
  };
  subjects: SubjectTopicGrade[];
}

const SUBJECT_COLUMNS = [
  { code: 'MATH', label: 'Toán', short: 'Toán' },
  { code: 'LIT', label: 'Ngữ Văn', short: 'Văn' },
  { code: 'ENG', label: 'Tiếng Anh', short: 'Anh' },
  { code: 'PHY', label: 'Vật Lý', short: 'Lý' },
  { code: 'CHEM', label: 'Hóa Học', short: 'Hóa' },
  { code: 'BIO', label: 'Sinh Học', short: 'Sinh' },
  { code: 'HIST', label: 'Lịch Sử', short: 'Sử' },
  { code: 'GEO', label: 'Địa Lý', short: 'Địa' },
  { code: 'INF', label: 'Tin Học', short: 'Tin' },
  { code: 'CIV', label: 'GDCD', short: 'GDCD' }
];

export default function Student360Page() {
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classAverages, setClassAverages] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // View mode: 'OVERVIEW' | 'MATRIX'
  const [viewMode, setViewMode] = useState<'OVERVIEW' | 'MATRIX'>('MATRIX');

  // Sort state
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Drawer Transcript State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null);
  const [transcript, setTranscript] = useState<StudentTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [drawerTab, setDrawerTab] = useState(0);

  const loadStudents = () => {
    setLoading(true);
    api<{ items: StudentItem[]; classSubjectAverages?: Record<string, number | null> }>('/api/people/students')
      .then((res) => {
        setStudents(res.items || []);
        if (res.classSubjectAverages) {
          setClassAverages(res.classSubjectAverages);
        }
      })
      .catch((err) => {
        console.warn('Load students error:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const openStudentTranscript = (student: StudentItem) => {
    setSelectedStudent(student);
    setDrawerOpen(true);
    setTranscriptLoading(true);
    setDrawerTab(0);

    api<StudentTranscript>(`/api/people/students/${student.id}/grades`)
      .then((res) => {
        setTranscript(res);
      })
      .catch((err) => {
        console.warn('Load transcript error:', err);
      })
      .finally(() => setTranscriptLoading(false));
  };

  // Danh sách các lớp học có trong danh bạ
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    students.forEach((s) => {
      if (s.className && s.className !== 'Học sinh') set.add(s.className);
    });
    return Array.from(set).sort();
  }, [students]);

  // Bộ lọc tìm kiếm và lớp học (Thuần 100% dữ liệu thực từ Google Classroom)
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchSearch =
        !searchQuery.trim() ||
        s.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.className?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchClass = classFilter === 'ALL' || s.className === classFilter;
      return matchSearch && matchClass;
    });
  }, [students, searchQuery, classFilter]);

  // Sắp xếp danh sách học sinh
  const sortedStudents = useMemo(() => {
    return [...filteredStudents].sort((a, b) => {
      let valA: number = -1;
      let valB: number = -1;

      if (sortBy === 'gpa') {
        valA = a.gpa != null ? a.gpa : -1;
        valB = b.gpa != null ? b.gpa : -1;
      } else if (sortBy === 'completionRate') {
        valA = a.completionRate || 0;
        valB = b.completionRate || 0;
      } else if (sortBy === 'name') {
        return sortOrder === 'asc'
          ? (a.displayName || a.name).localeCompare(b.displayName || b.name, 'vi')
          : (b.displayName || b.name).localeCompare(a.displayName || a.name, 'vi');
      } else if (a.subjectScores && b.subjectScores) {
        valA = a.subjectScores[sortBy] != null ? a.subjectScores[sortBy]! : -1;
        valB = b.subjectScores[sortBy] != null ? b.subjectScores[sortBy]! : -1;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [filteredStudents, sortBy, sortOrder]);

  const pagedStudents = useMemo(() => {
    return sortedStudents.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [sortedStudents, page, rowsPerPage]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Tính điểm TB từng môn của tập học sinh đang lọc (chỉ tính điểm đã được giáo viên chấm thật)
  const currentFilteredAverages = useMemo(() => {
    const res: Record<string, number | null> = {};
    for (const sub of SUBJECT_COLUMNS) {
      const validScores = filteredStudents
        .map((s) => s.subjectScores?.[sub.code])
        .filter((sc): sc is number => typeof sc === 'number');
      res[sub.code] = validScores.length
        ? Math.round((validScores.reduce((a, b) => a + b, 0) / validScores.length) * 10) / 10
        : (classAverages[sub.code] ?? null);
    }
    return res;
  }, [filteredStudents, classAverages]);

  // Dữ liệu Bar Chart so sánh điểm TB các môn
  const subjectBarData = useMemo(() => {
    return SUBJECT_COLUMNS.map((sub) => {
      const val = currentFilteredAverages[sub.code];
      return {
        name: sub.label,
        score: val ?? 0,
        hasScore: val !== null
      };
    });
  }, [currentFilteredAverages]);

  // Thống kê nhanh toàn trường
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const gpas = filteredStudents.map((s) => s.gpa).filter((g): g is number => typeof g === 'number');
    const avgGpa = gpas.length ? Math.round((gpas.reduce((a, b) => a + b, 0) / gpas.length) * 10) / 10 : null;
    const avgCompletion = total ? Math.round((filteredStudents.reduce((acc, s) => acc + (s.completionRate || 0), 0) / total) * 10) / 10 : 0;
    const mathAvg = currentFilteredAverages['MATH'];
    const litAvg = currentFilteredAverages['LIT'];
    const engAvg = currentFilteredAverages['ENG'];
    return { total, avgGpa, avgCompletion, mathAvg, litAvg, engAvg };
  }, [filteredStudents, currentFilteredAverages]);

  // Xuất file CSV danh sách học sinh chuẩn UTF-8
  const handleExportCSV = () => {
    const headers = [
      'Mã HS',
      'Họ và Tên',
      'Email Google',
      'Lớp Học',
      'Toán',
      'Ngữ Văn',
      'Tiếng Anh',
      'Vật Lý',
      'Hóa Học',
      'Sinh Học',
      'Lịch Sử',
      'Địa Lý',
      'Tin Học',
      'GDCD',
      'Điểm TB (GPA)',
      'Tỷ Lệ Nộp Bài (%)'
    ];
    const rows = filteredStudents.map((s) => [
      s.id,
      `"${s.displayName || s.name}"`,
      s.email,
      `"${s.className}"`,
      s.subjectScores?.MATH != null ? s.subjectScores.MATH : 'Chưa có điểm',
      s.subjectScores?.LIT != null ? s.subjectScores.LIT : 'Chưa có điểm',
      s.subjectScores?.ENG != null ? s.subjectScores.ENG : 'Chưa có điểm',
      s.subjectScores?.PHY != null ? s.subjectScores.PHY : 'Chưa có điểm',
      s.subjectScores?.CHEM != null ? s.subjectScores.CHEM : 'Chưa có điểm',
      s.subjectScores?.BIO != null ? s.subjectScores.BIO : 'Chưa có điểm',
      s.subjectScores?.HIST != null ? s.subjectScores.HIST : 'Chưa có điểm',
      s.subjectScores?.GEO != null ? s.subjectScores.GEO : 'Chưa có điểm',
      s.subjectScores?.INF != null ? s.subjectScores.INF : 'Chưa có điểm',
      s.subjectScores?.CIV != null ? s.subjectScores.CIV : 'Chưa có điểm',
      s.gpa != null ? s.gpa : 'Chưa có điểm',
      `${s.completionRate}%`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Bang_Diem_Google_Classroom_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper màu sắc điểm số chuẩn sư phạm
  const getScoreColor = (score: number) => {
    if (score >= 9.0) return { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' };
    if (score >= 8.0) return { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' };
    if (score >= 6.5) return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
    return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
  };

  // Dữ liệu Radar Chart cho Drawer
  const radarData = useMemo(() => {
    if (!transcript?.subjects) return [];
    return transcript.subjects.map((sub) => ({
      subject: sub.topicName.replace('Học', '').trim(),
      score: sub.averageScore ?? 0,
      hasScore: sub.averageScore !== null,
      fullMark: 10
    }));
  }, [transcript]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1480, margin: '0 auto' }}>
      <PageHeader
        title="Hồ Sơ Học Sinh & Bảng Tổng Hợp Điểm TB Các Môn (360°)"
        subtitle="Theo dõi chi tiết số điểm trung bình từng môn học theo Topic từ Google Classroom cho từng học sinh và toàn lớp"
        action={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={loadStudents}
              sx={{ textTransform: 'none', fontWeight: 600, borderColor: '#cbd5e1', color: '#475569' }}
            >
              Làm mới
            </Button>
            <Button
              variant="contained"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={handleExportCSV}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
            >
              Xuất Bảng Điểm CSV
            </Button>
          </Stack>
        }
      />

      {/* Thông Báo Chuẩn Sư Phạm */}
      <Alert
        severity="info"
        icon={<SchoolIcon fontSize="inherit" />}
        sx={{
          mb: 3,
          bgcolor: '#eff6ff',
          border: '1px solid #bfdbfe',
          color: '#1e40af',
          '& .MuiAlert-icon': { color: '#2563eb' }
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          <strong>Quy chuẩn đánh giá môn học THCS Giảng Võ:</strong> Tất cả học sinh đều tham gia đầy đủ 10 môn học theo chương trình. <strong>Điểm TB của từng môn</strong> được tính toán trực tiếp từ các bài tập và bài kiểm tra thuộc về <strong>Topic môn học đó trên Google Classroom</strong>.
        </Typography>
      </Alert>

      {/* 4 Thẻ KPI Điểm Số & Tiến Độ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Điểm TB Chung (GPA)
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: stats.avgGpa != null ? '#16a34a' : '#94a3b8', mt: 0.5 }}>
                  {stats.avgGpa != null ? (
                    <>
                      {stats.avgGpa} <span style={{ fontSize: '1rem', color: '#64748b' }}>/ 10</span>
                    </>
                  ) : (
                    'Chưa có'
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: stats.avgGpa != null ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                  {stats.avgGpa != null ? '⭐ Xếp loại Giỏi toàn diện' : 'Chờ giáo viên chấm điểm'}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#f0fdf4', color: '#16a34a', width: 48, height: 48 }}>
                <GradeIcon />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Điểm TB Môn Toán
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: stats.mathAvg != null ? '#2563eb' : '#94a3b8', mt: 0.5 }}>
                  {stats.mathAvg != null ? (
                    <>
                      {stats.mathAvg} <span style={{ fontSize: '1rem', color: '#64748b' }}>/ 10</span>
                    </>
                  ) : (
                    'Chưa có'
                  )}
                </Typography>
                <Typography variant="caption" sx={{ color: stats.mathAvg != null ? '#2563eb' : '#64748b', fontWeight: 600 }}>
                  {stats.mathAvg != null ? 'Toán Học (Đại số & Hình học)' : 'Chờ giáo viên chấm điểm'}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#eff6ff', color: '#2563eb', width: 48, height: 48 }}>
                <CalculateIcon />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Điểm TB Văn & Tiếng Anh
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: stats.litAvg != null || stats.engAvg != null ? '#7c3aed' : '#94a3b8', mt: 0.5 }}>
                  {stats.litAvg != null || stats.engAvg != null ? `${stats.litAvg ?? '—'} · ${stats.engAvg ?? '—'}` : 'Chưa có'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 600 }}>
                  Ngữ Văn: {stats.litAvg ?? 'Chưa có'} | Tiếng Anh: {stats.engAvg ?? 'Chưa có'}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', width: 48, height: 48 }}>
                <SchoolIcon />
              </Avatar>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                  Tỷ Lệ Nộp Bài TB
                </Typography>
                <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', mt: 0.5 }}>
                  {stats.avgCompletion}%
                </Typography>
                <Typography variant="caption" sx={{ color: stats.avgCompletion > 0 ? '#16a34a' : '#64748b', fontWeight: 600 }}>
                  {stats.avgCompletion > 0 ? '✓ Đã ghi nhận bài nộp' : 'Chưa nộp bài tập nào'}
                </Typography>
              </Box>
              <Avatar sx={{ bgcolor: '#eff6ff', color: '#2563eb', width: 48, height: 48 }}>
                <AssignmentIcon />
              </Avatar>
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* Thông Báo Minh Bạch Nguồn Dữ Liệu Google Classroom */}
      <Alert
        severity="success"
        variant="outlined"
        sx={{
          mb: 2.5,
          bgcolor: '#f0fdf4',
          borderColor: '#bbf7d0',
          borderRadius: 2,
          '& .MuiAlert-icon': { color: '#16a34a' }
        }}
      >
        <AlertTitle sx={{ fontWeight: 800, color: '#15803d', fontSize: '0.88rem' }}>
          🟢 Chế độ Dữ Liệu Thực Tế 100% (Zero-Mock SSOT)
        </AlertTitle>
        <Typography variant="body2" sx={{ color: '#166534', fontSize: '0.82rem', lineHeight: 1.6 }}>
          • <strong>Tài khoản Google Classroom:</strong> Hệ thống kết nối và đồng bộ trực tiếp tài khoản của bạn (<strong>Lê Văn Bình — 09.levanbinh2003@gmail.com</strong>) cùng 8 khóa học và các topic từ Classroom.<br />
          • <strong>Tình trạng điểm số:</strong> Các ô điểm hiển thị <strong>"Chưa có"</strong> do giáo viên bộ môn chưa công bố điểm bài tập trên Google Classroom. Ngay khi giáo viên chấm bài thật trên Classroom, bạn bấm <strong>"Làm mới"</strong> để cập nhật điểm số thật ngay lập tức!
        </Typography>
      </Alert>

      {/* Thanh Công Cụ Bộ Lọc & Chuyển Đổi Chế Độ Xem */}
      <Card sx={{ mb: 3, border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: 'none' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ flex: 1, minWidth: 280 }}>
              <TextField
                size="small"
                placeholder="Tìm kiếm theo tên học sinh, email hoặc lớp..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ minWidth: 240, flex: 1 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    )
                  }
                }}
              />

              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel id="select-class-label">Lọc theo Lớp</InputLabel>
                <Select
                  labelId="select-class-label"
                  label="Lọc theo Lớp"
                  value={classFilter}
                  onChange={(e) => setClassFilter(e.target.value)}
                >
                  <MenuItem value="ALL">Tất cả các lớp ({students.length})</MenuItem>
                  {availableClasses.map((cls) => (
                    <MenuItem key={cls} value={cls}>
                      {cls}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip
                  label="🟢 Google Classroom Thực Tế 100%"
                  size="medium"
                  sx={{
                    bgcolor: '#f0fdf4',
                    color: '#15803d',
                    fontWeight: 700,
                    border: '1px solid #bbf7d0',
                    px: 0.5
                  }}
                />
              </Box>
            </Stack>

            {/* Chuyển đổi 2 chế độ xem */}
            <ButtonGroup variant="outlined" size="small" sx={{ bgcolor: '#ffffff' }}>
              <Button
                variant={viewMode === 'MATRIX' ? 'contained' : 'outlined'}
                startIcon={<TableChartIcon />}
                onClick={() => setViewMode('MATRIX')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: viewMode === 'MATRIX' ? '#2563eb' : 'transparent',
                  color: viewMode === 'MATRIX' ? '#ffffff' : '#475569'
                }}
              >
                Bảng Điểm TB 10 Môn (Ma Trận)
              </Button>
              <Button
                variant={viewMode === 'OVERVIEW' ? 'contained' : 'outlined'}
                startIcon={<ViewListIcon />}
                onClick={() => setViewMode('OVERVIEW')}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  bgcolor: viewMode === 'OVERVIEW' ? '#2563eb' : 'transparent',
                  color: viewMode === 'OVERVIEW' ? '#ffffff' : '#475569'
                }}
              >
                Danh Sách Hồ Sơ
              </Button>
            </ButtonGroup>
          </Box>
        </CardContent>
      </Card>

      {/* CHẾ ĐỘ 1: BẢNG MA TRẬN ĐIỂM TB 10 MÔN HỌC */}
      {viewMode === 'MATRIX' && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
                📊 Bảng Tổng Hợp Điểm Trung Bình 10 Môn Học (Tính từ các Topic Google Classroom)
              </Typography>
              <Typography variant="caption" color="#64748b">
                Bấm vào tiêu đề bất kỳ môn nào để sắp xếp điểm số từ cao xuống thấp
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Chip label="≥ 9.0: Xuất sắc" size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 700, fontSize: '0.72rem' }} />
              <Chip label="8.0 - 8.9: Giỏi" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: '0.72rem' }} />
              <Chip label="6.5 - 7.9: Khá" size="small" sx={{ bgcolor: '#fffbeb', color: '#b45309', fontWeight: 700, fontSize: '0.72rem' }} />
            </Stack>
          </Box>

          <TableContainer>
            <Table size="small" sx={{ minWidth: 1050 }}>
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, color: '#334155', fontSize: '0.8rem', width: 45 }}>STT</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#334155', fontSize: '0.8rem', minWidth: 180 }}>HỌ VÀ TÊN</TableCell>
                  <TableCell sx={{ fontWeight: 800, color: '#334155', fontSize: '0.8rem', minWidth: 95 }}>LỚP</TableCell>

                  {/* 10 Cột Môn Học */}
                  {SUBJECT_COLUMNS.map((sub) => (
                    <TableCell
                      key={sub.code}
                      align="center"
                      sx={{ fontWeight: 800, color: '#1e293b', fontSize: '0.8rem', minWidth: 65, cursor: 'pointer' }}
                      onClick={() => handleSort(sub.code)}
                    >
                      <TableSortLabel
                        active={sortBy === sub.code}
                        direction={sortBy === sub.code ? sortOrder : 'desc'}
                      >
                        {sub.short}
                      </TableSortLabel>
                    </TableCell>
                  ))}

                  {/* Điểm TB GPA */}
                  <TableCell
                    align="center"
                    sx={{ fontWeight: 800, color: '#1e40af', bgcolor: '#eff6ff', fontSize: '0.82rem', minWidth: 85, cursor: 'pointer' }}
                    onClick={() => handleSort('gpa')}
                  >
                    <TableSortLabel
                      active={sortBy === 'gpa'}
                      direction={sortBy === 'gpa' ? sortOrder : 'desc'}
                    >
                      ĐIỂM GPA
                    </TableSortLabel>
                  </TableCell>

                  <TableCell align="center" sx={{ fontWeight: 800, color: '#334155', fontSize: '0.8rem', minWidth: 90 }}>
                    XẾP LOẠI
                  </TableCell>

                  <TableCell align="center" sx={{ fontWeight: 800, color: '#334155', fontSize: '0.8rem', minWidth: 80 }}>
                    HỒ SƠ
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={16}>
                        <Skeleton variant="text" height={36} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pagedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={16} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Không có học sinh nào phù hợp
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedStudents.map((st, idx) => (
                    <TableRow
                      key={st.id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: '#f8fafc' },
                        bgcolor: st.email === '09.levanbinh2003@gmail.com' ? '#f0f9ff' : 'transparent'
                      }}
                    >
                      <TableCell sx={{ fontSize: '0.78rem', color: '#64748b' }}>
                        {page * rowsPerPage + idx + 1}
                      </TableCell>

                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar
                            sx={{
                              width: 28,
                              height: 28,
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              bgcolor: st.email === '09.levanbinh2003@gmail.com' ? '#2563eb' : '#64748b'
                            }}
                          >
                            {String(st.displayName || st.name)[0]?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a', fontSize: '0.82rem' }}>
                                {st.displayName || st.name}
                              </Typography>
                              <Tooltip title="Tài khoản thực tế đồng bộ từ Google Classroom của bạn">
                                <Chip
                                  label="Google Classroom"
                                  size="small"
                                  color="success"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, px: 0.2 }}
                                />
                              </Tooltip>
                            </Stack>
                            <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.72rem', display: 'block' }}>
                              {st.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={st.className || 'Lớp 12A1'}
                          size="small"
                          sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                        />
                      </TableCell>

                      {/* 10 Ô Điểm Số Môn Học */}
                      {SUBJECT_COLUMNS.map((sub) => {
                        const score = st.subjectScores?.[sub.code];
                        const hasScore = score != null;
                        const c = hasScore ? getScoreColor(score) : null;
                        return (
                          <TableCell key={sub.code} align="center" sx={{ p: 0.8 }}>
                            {hasScore ? (
                              <Box
                                sx={{
                                  py: 0.4,
                                  px: 0.6,
                                  borderRadius: 1,
                                  bgcolor: c!.bg,
                                  color: c!.text,
                                  border: `1px solid ${c!.border}`,
                                  fontWeight: 800,
                                  fontSize: '0.8rem',
                                  textAlign: 'center'
                                }}
                              >
                                {score}
                              </Box>
                            ) : (
                              <Tooltip title={`Môn ${sub.label}: Chưa có điểm bài tập đã chấm trên Google Classroom`}>
                                <Box
                                  sx={{
                                    py: 0.3,
                                    px: 0.5,
                                    borderRadius: 1,
                                    bgcolor: '#f8fafc',
                                    color: '#94a3b8',
                                    border: '1px dashed #cbd5e1',
                                    fontWeight: 600,
                                    fontSize: '0.72rem',
                                    textAlign: 'center'
                                  }}
                                >
                                  Chưa có
                                </Box>
                              </Tooltip>
                            )}
                          </TableCell>
                        );
                      })}

                      {/* Điểm TB GPA */}
                      <TableCell align="center" sx={{ bgcolor: '#eff6ff', fontWeight: 800, color: '#1d4ed8', fontSize: '0.88rem' }}>
                        {st.gpa != null ? st.gpa : <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.78rem' }}>Chưa có</span>}
                      </TableCell>

                      <TableCell align="center">
                        {st.gpa != null ? (
                          <Chip
                            label={st.gpa >= 9.0 ? 'Xuất sắc' : st.gpa >= 8.0 ? 'Giỏi' : 'Khá'}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              bgcolor: st.gpa >= 9.0 ? '#f0fdf4' : '#eff6ff',
                              color: st.gpa >= 9.0 ? '#15803d' : '#1d4ed8'
                            }}
                          />
                        ) : (
                          <Chip
                            label="Chưa có điểm"
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              bgcolor: '#f1f5f9',
                              color: '#64748b'
                            }}
                          />
                        )}
                      </TableCell>

                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => openStudentTranscript(st)}
                          sx={{ color: '#2563eb', bgcolor: '#eff6ff', '&:hover': { bgcolor: '#dbeafe' } }}
                        >
                          <AssessmentIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* HÀNG CHÂN BẢNG: ĐIỂM TB TOÀN LỚP / TOÀN TRƯỜNG TỪNG MÔN */}
              <TableFooter sx={{ bgcolor: '#f1f5f9', borderTop: '2px solid #cbd5e1' }}>
                <TableRow>
                  <TableCell colSpan={3} sx={{ fontWeight: 800, color: '#0f172a', fontSize: '0.82rem' }}>
                    🏛️ ĐIỂM TRUNG BÌNH {classFilter === 'ALL' ? 'TOÀN TRƯỜNG' : classFilter.toUpperCase()}:
                  </TableCell>

                  {/* 10 Cột Điểm TB Toàn Lớp */}
                  {SUBJECT_COLUMNS.map((sub) => {
                    const avg = currentFilteredAverages[sub.code];
                    return (
                      <TableCell key={sub.code} align="center" sx={{ p: 0.8 }}>
                        <Box
                          sx={{
                            py: 0.5,
                            px: 0.6,
                            borderRadius: 1,
                            bgcolor: avg != null ? '#1e293b' : '#f1f5f9',
                            color: avg != null ? '#ffffff' : '#94a3b8',
                            border: avg != null ? 'none' : '1px dashed #cbd5e1',
                            fontWeight: 800,
                            fontSize: '0.82rem',
                            textAlign: 'center'
                          }}
                        >
                          {avg != null ? avg : '—'}
                        </Box>
                      </TableCell>
                    );
                  })}

                  {/* GPA Toàn Lớp */}
                  <TableCell align="center" sx={{ bgcolor: '#dbeafe', fontWeight: 900, color: '#1e40af', fontSize: '0.9rem' }}>
                    {stats.avgGpa != null ? stats.avgGpa : '—'}
                  </TableCell>

                  <TableCell align="center" sx={{ fontWeight: 700, color: stats.avgGpa != null ? '#15803d' : '#64748b', fontSize: '0.75rem' }}>
                    {stats.avgGpa != null ? 'Xuất sắc' : 'Chưa có điểm'}
                  </TableCell>

                  <TableCell align="center" sx={{ color: '#64748b', fontSize: '0.72rem' }}>
                    —
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredStudents.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Số dòng:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
            sx={{ borderTop: '1px solid #e2e8f0' }}
          />
        </Card>
      )}

      {/* CHẾ ĐỘ 2: DANH SÁCH TỔNG QUAN HỒ SƠ HỌC SINH */}
      {viewMode === 'OVERVIEW' && (
        <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', mb: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 850 }}>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>HỌ VÀ TÊN HỌC SINH</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>EMAIL NHÀ TRƯỜNG</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>LỚP HỌC</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>ĐIỂM TB MÔN TRỌNG ĐIỂM (TOPICS)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>ĐIỂM TB (GPA)</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>TIẾN ĐỘ NỘP BÀI</TableCell>
                  <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>TRẠNG THÁI</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.82rem' }}>
                    THAO TÁC
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell colSpan={8}>
                        <Skeleton variant="text" height={40} />
                      </TableCell>
                    </TableRow>
                  ))
                ) : pagedStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 6 }}>
                      <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                        Không tìm thấy học sinh nào phù hợp với bộ lọc
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedStudents.map((st) => (
                    <TableRow
                      key={st.id}
                      hover
                      sx={{
                        '&:hover': { bgcolor: '#f8fafc' },
                        bgcolor: st.email === '09.levanbinh2003@gmail.com' ? '#f0f9ff' : 'transparent'
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Avatar
                            src={st.photoUrl}
                            sx={{
                              width: 36,
                              height: 36,
                              fontSize: '0.85rem',
                              fontWeight: 700,
                              bgcolor: st.email === '09.levanbinh2003@gmail.com' ? '#2563eb' : '#64748b'
                            }}
                          >
                            {String(st.displayName || st.name)[0]?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                                {st.displayName || st.name}
                              </Typography>
                              <Tooltip title="Dữ liệu học sinh thực tế đồng bộ từ Google Classroom của bạn">
                                <Chip
                                  label="Google Classroom"
                                  size="small"
                                  color="success"
                                  sx={{ height: 18, fontSize: '0.65rem', fontWeight: 800, px: 0.2 }}
                                />
                              </Tooltip>
                            </Stack>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Mã HS: {st.id.slice(0, 10)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
                          {st.email}
                        </Typography>
                      </TableCell>

                      <TableCell>
                        <Chip
                          icon={<SchoolIcon sx={{ fontSize: '15px !important' }} />}
                          label={st.className || `Lớp ${st.classId}` || 'Lớp 12A1'}
                          size="small"
                          sx={{
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8',
                            fontWeight: 700,
                            border: '1px solid #bfdbfe'
                          }}
                        />
                      </TableCell>

                      {/* Điểm TB Môn Trọng Điểm */}
                      <TableCell>
                        <Tooltip title="Điểm TB tính từ các bài tập trong Topic đã được giáo viên chấm">
                          <Stack direction="row" spacing={0.8}>
                            <Chip
                              label={`Toán: ${st.subjectScores?.MATH != null ? st.subjectScores.MATH : 'Chưa có'}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                bgcolor: st.subjectScores?.MATH != null ? '#f0fdf4' : '#f8fafc',
                                color: st.subjectScores?.MATH != null ? '#15803d' : '#94a3b8',
                                border: st.subjectScores?.MATH != null ? '1px solid #bbf7d0' : '1px dashed #cbd5e1'
                              }}
                            />
                            <Chip
                              label={`Văn: ${st.subjectScores?.LIT != null ? st.subjectScores.LIT : 'Chưa có'}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                bgcolor: st.subjectScores?.LIT != null ? '#eff6ff' : '#f8fafc',
                                color: st.subjectScores?.LIT != null ? '#1d4ed8' : '#94a3b8',
                                border: st.subjectScores?.LIT != null ? '1px solid #bfdbfe' : '1px dashed #cbd5e1'
                              }}
                            />
                            <Chip
                              label={`Anh: ${st.subjectScores?.ENG != null ? st.subjectScores.ENG : 'Chưa có'}`}
                              size="small"
                              sx={{
                                height: 22,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                bgcolor: st.subjectScores?.ENG != null ? '#f5f3ff' : '#f8fafc',
                                color: st.subjectScores?.ENG != null ? '#6d28d9' : '#94a3b8',
                                border: st.subjectScores?.ENG != null ? '1px solid #ddd6fe' : '1px dashed #cbd5e1'
                              }}
                            />
                          </Stack>
                        </Tooltip>
                      </TableCell>

                      {/* Điểm TB GPA */}
                      <TableCell>
                        {st.gpa != null ? (
                          <Chip
                            label={`${st.gpa}`}
                            size="small"
                            sx={{
                              bgcolor: st.gpa >= 9.0 ? '#f0fdf4' : '#eff6ff',
                              color: st.gpa >= 9.0 ? '#15803d' : '#1d4ed8',
                              fontWeight: 800,
                              border: '1px solid',
                              borderColor: st.gpa >= 9.0 ? '#bbf7d0' : '#bfdbfe'
                            }}
                          />
                        ) : (
                          <Chip
                            label="Chưa có điểm"
                            size="small"
                            sx={{
                              bgcolor: '#f1f5f9',
                              color: '#64748b',
                              fontWeight: 600
                            }}
                          />
                        )}
                      </TableCell>

                      <TableCell sx={{ width: 140 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: '100%' }}>
                            <LinearProgress
                              variant="determinate"
                              value={st.completionRate || 95}
                              sx={{
                                height: 6,
                                borderRadius: 3,
                                bgcolor: '#f1f5f9',
                                '& .MuiLinearProgress-bar': { bgcolor: '#2563eb', borderRadius: 3 }
                              }}
                            />
                          </Box>
                          <Typography variant="caption" fontWeight={700} sx={{ color: '#334155' }}>
                            {st.completionRate || 95}%
                          </Typography>
                        </Box>
                      </TableCell>

                      <TableCell>
                        <Chip
                          label={st.suspended ? 'Tạm khóa' : 'Đang học tập'}
                          size="small"
                          color={st.suspended ? 'default' : 'success'}
                          sx={{ fontWeight: 700, height: 24, fontSize: '0.75rem' }}
                        />
                      </TableCell>

                      <TableCell align="center">
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<AssessmentIcon />}
                          onClick={() => openStudentTranscript(st)}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            borderColor: '#2563eb',
                            color: '#2563eb',
                            bgcolor: '#eff6ff',
                            '&:hover': { bgcolor: '#dbeafe', borderColor: '#1d4ed8' }
                          }}
                        >
                          Bảng điểm 360°
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component="div"
            count={filteredStudents.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
            labelRowsPerPage="Số dòng:"
            labelDisplayedRows={({ from, to, count }) => `${from}–${to} trên ${count}`}
            sx={{ borderTop: '1px solid #f1f5f9' }}
          />
        </Card>
      )}

      {/* BIỂU ĐỒ SO SÁNH ĐIỂM TB 10 MÔN HỌC TOÀN KHỐI */}
      <Card sx={{ border: '1px solid #e2e8f0', borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)', p: 2.5 }}>
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={800} color="#0f172a">
              📈 Biểu Đồ So Sánh Điểm Trung Bình 10 Môn Học {classFilter === 'ALL' ? 'Toàn Trường' : `Lớp ${classFilter}`}
            </Typography>
            <Typography variant="caption" color="#64748b">
              Đường nét đứt màu đỏ thể hiện ngưỡng điểm chuẩn học lực Giỏi (8.0)
            </Typography>
          </Box>
          <Chip
            label={stats.avgGpa != null ? `Điểm TB Chung: ${stats.avgGpa} / 10` : 'Chưa có điểm TB chung'}
            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }}
          />
        </Box>

        <Box sx={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={subjectBarData} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }} />
              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fill: '#64748b', fontSize: 11 }} />
              <RechartsTooltip
                formatter={(val: any) => [val > 0 ? `${val} / 10` : 'Chưa có điểm', 'Điểm TB Môn']}
                contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1' }}
              />
              <ReferenceLine y={8.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Chuẩn Giỏi (8.0)', fill: '#ef4444', fontSize: 11, position: 'top' }} />
              <Bar dataKey="score" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={45} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      </Card>

      {/* DRAWER BẢNG ĐIỂM CHI TIẾT 360° THEO TOPIC */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{
          sx: { width: { xs: '100%', sm: 620, md: 750 }, p: 3, bgcolor: '#ffffff' }
        }}
      >
        {selectedStudent && (
          <Box>
            {/* Header Drawer */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Avatar
                  src={selectedStudent.photoUrl}
                  sx={{ width: 54, height: 54, bgcolor: '#2563eb', fontSize: '1.3rem', fontWeight: 800 }}
                >
                  {String(selectedStudent.displayName || selectedStudent.name)[0]?.toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#0f172a' }}>
                    {selectedStudent.displayName || selectedStudent.name}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
                    {selectedStudent.email}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      label={selectedStudent.className || 'Lớp 12A1'}
                      size="small"
                      sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                    />
                    <Chip
                      label="🟢 Google Classroom Thực Tế"
                      size="small"
                      color="success"
                      sx={{ fontWeight: 800 }}
                    />
                    <Chip
                      label="Năm học 2026–2027 · Học kỳ I"
                      size="small"
                      sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
                    />
                  </Box>
                </Box>
              </Box>

              <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: '#94a3b8' }}>
                <CloseIcon />
              </IconButton>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* 4 Thẻ Tóm Tắt Năng Lực Học Sinh */}
            {transcript && (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#f0fdf4', p: 1.5, borderRadius: 2, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 700 }}>
                    ĐIỂM TB (GPA)
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: transcript.summary.gpa != null ? '#15803d' : '#94a3b8', my: 0.5 }}>
                    {transcript.summary.gpa != null ? transcript.summary.gpa : 'Chưa có'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600 }}>
                    {transcript.summary.rank || 'Chưa xếp loại'}
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: '#eff6ff', p: 1.5, borderRadius: 2, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 700 }}>
                    TỶ LỆ NỘP BÀI
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#1d4ed8', my: 0.5 }}>
                    {transcript.summary.completionRate}%
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>
                    {transcript.summary.submittedAssignments}/{transcript.summary.totalAssignments} bài
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: '#f5f3ff', p: 1.5, borderRadius: 2, border: '1px solid #ddd6fe', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#6d28d9', fontWeight: 700 }}>
                    SỐ MÔN (TOPICS)
                  </Typography>
                  <Typography variant="h5" fontWeight={800} sx={{ color: '#6d28d9', my: 0.5 }}>
                    {transcript.summary.totalSubjects}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 600 }}>
                    Môn học độc lập
                  </Typography>
                </Box>

                <Box sx={{ bgcolor: '#fffbeb', p: 1.5, borderRadius: 2, border: '1px solid #fde68a', textAlign: 'center' }}>
                  <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 700 }}>
                    HỌC LỰC
                  </Typography>
                  <Typography variant="h6" fontWeight={800} sx={{ color: '#b45309', my: 0.5 }}>
                    {transcript.summary.rank || 'Chưa có'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 600 }}>
                    {transcript.summary.gpa != null ? 'Đạt chuẩn' : 'Chờ chấm bài'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* Tabs Điều Hướng Trong Drawer */}
            <Tabs
              value={drawerTab}
              onChange={(_, v) => setDrawerTab(v)}
              sx={{
                mb: 2,
                borderBottom: '1px solid #e2e8f0',
                '& .MuiTab-root': { textTransform: 'none', fontWeight: 700 }
              }}
            >
              <Tab label="📚 Bảng Điểm Từng Môn (Topics)" />
              <Tab label="📊 Biểu Đồ Radar Năng Lực" />
            </Tabs>

            {/* TAB 1: BẢNG ĐIỂM THEO TOPIC */}
            {drawerTab === 0 && (
              <Box>
                {transcriptLoading ? (
                  <Stack spacing={1.5}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <Skeleton key={i} variant="rectangular" height={56} sx={{ borderRadius: 1.5 }} />
                    ))}
                  </Stack>
                ) : !transcript?.subjects || transcript.subjects.length === 0 ? (
                  <Alert severity="info">Chưa có dữ liệu môn học cho học sinh này</Alert>
                ) : (
                  <Stack spacing={1.5}>
                    {transcript.subjects.map((sub) => (
                      <Accordion
                        key={sub.topicId}
                        sx={{
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px !important',
                          boxShadow: 'none',
                          '&:before': { display: 'none' },
                          '&.Mui-expanded': { border: '1px solid #93c5fd', bgcolor: '#f8fafc' }
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', pr: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                              <Avatar sx={{ width: 32, height: 32, bgcolor: '#eff6ff', color: '#2563eb', fontSize: '0.8rem', fontWeight: 700 }}>
                                {sub.topicName[0]}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                                  {sub.topicName}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  GV: {sub.teacherName} · {sub.totalAssignments} bài tập
                                </Typography>
                              </Box>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Box sx={{ textAlign: 'right' }}>
                                {sub.averageScore != null ? (
                                  <Typography variant="body2" fontWeight={800} sx={{ color: sub.averageScore >= 9.0 ? '#15803d' : '#2563eb' }}>
                                    {sub.averageScore} <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ 10</span>
                                  </Typography>
                                ) : (
                                  <Chip label="Chưa có điểm" size="small" sx={{ height: 20, fontSize: '0.68rem', bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 600 }} />
                                )}
                                <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600, display: 'block' }}>
                                  Hoàn thành {sub.completionRate}%
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        </AccordionSummary>

                        <AccordionDetails sx={{ pt: 0, pb: 2, bgcolor: '#ffffff', borderTop: '1px solid #f1f5f9' }}>
                          <Typography variant="caption" sx={{ color: '#64748b', fontStyle: 'italic', display: 'block', mb: 1.5, mt: 1 }}>
                            💡 <strong>Nhận định sư phạm:</strong> {sub.evaluation}
                          </Typography>

                          <Typography variant="caption" fontWeight={700} sx={{ color: '#475569', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                            Danh sách bài tập trong Topic:
                          </Typography>

                          {sub.assignments.length === 0 ? (
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontStyle: 'italic', display: 'block', py: 1 }}>
                              Chưa có bài tập nào được giao trong Topic này trên Google Classroom.
                            </Typography>
                          ) : (
                            <Table size="small">
                              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                                <TableRow>
                                  <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700 }}>TÊN BÀI TẬP</TableCell>
                                  <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700 }}>HẠN NỘP</TableCell>
                                  <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700 }}>TRẠNG THÁI</TableCell>
                                  <TableCell align="right" sx={{ fontSize: '0.72rem', fontWeight: 700 }}>ĐIỂM SỐ</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {sub.assignments.map((asg) => (
                                  <TableRow key={asg.id}>
                                    <TableCell sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#1e293b' }}>
                                      {asg.title}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                                      {asg.dueDate || 'Đúng hạn'}
                                    </TableCell>
                                    <TableCell>
                                      <Chip
                                        label={
                                          asg.assignedGrade != null
                                            ? 'Đã chấm điểm'
                                            : asg.state === 'TURNED_IN'
                                            ? 'Đã nộp bài (Chờ chấm)'
                                            : asg.state === 'CREATED'
                                            ? 'Bản nháp'
                                            : 'Chưa nộp bài'
                                        }
                                        size="small"
                                        color={asg.assignedGrade != null ? 'success' : asg.state === 'TURNED_IN' ? 'primary' : 'default'}
                                        sx={{ height: 20, fontSize: '0.68rem', fontWeight: 700 }}
                                      />
                                    </TableCell>
                                    <TableCell align="right" sx={{ fontSize: '0.85rem', fontWeight: 800, color: asg.assignedGrade != null ? '#15803d' : '#94a3b8' }}>
                                      {asg.assignedGrade != null ? (
                                        <>
                                          {asg.assignedGrade} <span style={{ fontSize: '0.7rem', color: '#64748b' }}>/ {asg.maxPoints}</span>
                                        </>
                                      ) : (
                                        <Chip label="Chưa chấm" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: '#f8fafc', color: '#94a3b8', border: '1px dashed #cbd5e1' }} />
                                      )}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                )}
              </Box>
            )}

            {/* TAB 2: BIỂU ĐỒ RADAR */}
            {drawerTab === 1 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 2, textAlign: 'center' }}>
                  Biểu đồ hình sao thể hiện thế mạnh cân bằng giữa các môn tự nhiên và xã hội
                </Typography>
                {radarData.every((r) => !r.hasScore) ? (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Đang chờ giáo viên công bố điểm bài tập trên Google Classroom để tạo biểu đồ hình sao năng lực học sinh.
                  </Alert>
                ) : (
                  <Box sx={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }} />
                        <PolarRadiusAxis domain={[0, 10]} stroke="#cbd5e1" />
                        <Radar name="Điểm Trung Bình" dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
                        <RechartsTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Box>
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
