import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Paper
} from '@mui/material';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip
} from 'recharts';
import CompareArrowsIcon from '@mui/icons-material/CompareArrowsRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import LightbulbIcon from '@mui/icons-material/LightbulbRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import GroupIcon from '@mui/icons-material/GroupRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import AssessmentIcon from '@mui/icons-material/AssessmentRounded';
import GradeIcon from '@mui/icons-material/GradeRounded';
import EmojiEventsIcon from '@mui/icons-material/EmojiEventsRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export interface ClassItem {
  id: string;
  classId: string;
  className: string;
  grade: number | null;
  source: string;
  active: boolean;
  homeroomTeacher: string;
  teacherEmail: string;
  room: string;
  expectedStudents: number;
  studentCount: number;
  courseCount: number;
  totalCoursework: number;
  submissionsTotal: number;
  submissionsTurnedIn: number;
  submissionsLate: number;
  completionRate: number;
  onTimeRate: number;
  averageScore: number | null;
}

export interface DuelData {
  classA: ClassItem | null;
  classB: ClassItem | null;
  deltas: {
    completionRate: number;
    onTimeRate: number;
    averageScore: number;
    attendanceRate: number;
    totalCoursework: number;
  } | null;
  radarData: Array<{
    metric: string;
    classA: number;
    classB: number;
    fullMark: number;
  }>;
  insights: string[];
  recommendations: string[];
}

export interface CompareBenchmarkData {
  total: number;
  grade: string;
  benchmarks: {
    avgCompletion: number;
    avgOnTime: number;
    avgScore: number;
  };
  items: ClassItem[];
}

const GRADES = [
  { value: 'all', label: 'Tất cả các khối' },
  { value: '6', label: 'Khối 6' },
  { value: '7', label: 'Khối 7' },
  { value: '8', label: 'Khối 8' },
  { value: '9', label: 'Khối 9' },
  { value: '10', label: 'Khối 10' },
  { value: '11', label: 'Khối 11' },
  { value: '12', label: 'Khối 12' }
];

export default function ClassComparePage() {
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [allClasses, setAllClasses] = useState<ClassItem[]>([]);
  const [classAId, setClassAId] = useState<string>('');
  const [classBId, setClassBId] = useState<string>('');
  const [duelData, setDuelData] = useState<DuelData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<CompareBenchmarkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [duelLoading, setDuelLoading] = useState(false);
  const [error, setError] = useState('');

  // 1. Tải danh sách lớp và benchmark theo khối
  const loadClassesAndBenchmarks = async (grade = selectedGrade) => {
    setLoading(true);
    setError('');
    try {
      const res = await api<CompareBenchmarkData>(`/api/classes/compare?grade=${grade}`);
      setBenchmarkData(res);
      setAllClasses(res.items || []);

      if (res.items && res.items.length > 0) {
        // Mặc định chọn 2 lớp đầu tiên nếu chưa chọn hoặc lớp hiện tại không thuộc khối
        const first = res.items[0]!.classId;
        const second = res.items.length > 1 ? res.items[1]!.classId : res.items[0]!.classId;
        setClassAId((prev) => (res.items.some((c) => c.classId === prev) ? prev : first));
        setClassBId((prev) => (res.items.some((c) => c.classId === prev && c.classId !== first) ? prev : second));
      }
    } catch (err: any) {
      setError(err.message || 'Không thể tải dữ liệu so sánh lớp học');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClassesAndBenchmarks(selectedGrade);
  }, [selectedGrade]);

  // 2. Tải dữ liệu đối đầu 1-vs-1 khi thay đổi Lớp A hoặc Lớp B
  const loadDuel = async (aId: string, bId: string) => {
    if (!aId || !bId || aId === bId) return;
    setDuelLoading(true);
    try {
      const res = await api<DuelData>(`/api/classes/duel?classA=${encodeURIComponent(aId)}&classB=${encodeURIComponent(bId)}`);
      setDuelData(res);
    } catch (err: any) {
      console.warn('Lỗi tải duel:', err);
    } finally {
      setDuelLoading(false);
    }
  };

  useEffect(() => {
    if (classAId && classBId && classAId !== classBId) {
      loadDuel(classAId, classBId);
    }
  }, [classAId, classBId]);

  // Danh sách các lớp lọc theo khối hiện tại
  const availableClasses = useMemo(() => {
    if (selectedGrade === 'all') return allClasses;
    return allClasses.filter((c) => String(c.grade) === selectedGrade);
  }, [allClasses, selectedGrade]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="So sánh & Đối đầu Lớp học"
        subtitle="Phân tích đối đầu trực diện 1-vs-1 giữa các lớp học và xếp hạng chỉ số học tập so với chuẩn toàn khối."
        icon={<CompareArrowsIcon sx={{ color: '#2563eb' }} />}
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadClassesAndBenchmarks(selectedGrade)}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Làm mới
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* THANH ĐIỀU KHIỂN CHỌN LỚP ĐỐI ĐẦU */}
      <Card
        sx={{
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Thiết lập cặp lớp so sánh đối đầu (Head-to-Head Duel)
          </Typography>
        </Box>
        <CardContent sx={{ p: 2.5 }}>
          <Grid container spacing={2.5} alignItems="center">
            {/* Lọc Khối */}
            <Grid size={{ xs: 12, md: 3 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="grade-select-label">Phạm vi khối</InputLabel>
                <Select
                  labelId="grade-select-label"
                  label="Phạm vi khối"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                >
                  {GRADES.map((g) => (
                    <MenuItem key={g.value} value={g.value}>
                      {g.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Chọn Lớp A */}
            <Grid size={{ xs: 12, sm: 5, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="class-a-select-label" sx={{ color: '#2563eb', fontWeight: 600 }}>
                  Lớp A (Đội Xanh)
                </InputLabel>
                <Select
                  labelId="class-a-select-label"
                  label="Lớp A (Đội Xanh)"
                  value={classAId}
                  onChange={(e) => setClassAId(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#93c5fd' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb' }
                  }}
                >
                  {availableClasses.map((c) => (
                    <MenuItem key={c.classId} value={c.classId} disabled={c.classId === classBId}>
                      {c.className} {c.homeroomTeacher ? `(${c.homeroomTeacher})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* VS Badge */}
            <Grid size={{ xs: 12, sm: 2, md: 1 }} sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  fontWeight: 900,
                  fontSize: '0.8rem',
                  letterSpacing: '0.05em',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                }}
              >
                VS
              </Box>
            </Grid>

            {/* Chọn Lớp B */}
            <Grid size={{ xs: 12, sm: 5, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel id="class-b-select-label" sx={{ color: '#7c3aed', fontWeight: 600 }}>
                  Lớp B (Đội Tím)
                </InputLabel>
                <Select
                  labelId="class-b-select-label"
                  label="Lớp B (Đội Tím)"
                  value={classBId}
                  onChange={(e) => setClassBId(e.target.value)}
                  sx={{
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d8b4fe' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#7c3aed' }
                  }}
                >
                  {availableClasses.map((c) => (
                    <MenuItem key={c.classId} value={c.classId} disabled={c.classId === classAId}>
                      {c.className} {c.homeroomTeacher ? `(${c.homeroomTeacher})` : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* NỘI DUNG ĐỐI ĐẦU 1-VS-1 */}
      {duelLoading ? (
        <Box sx={{ p: 8, textAlign: 'center' }}>
          <CircularProgress size={36} color="primary" />
          <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>
            Đang tổng hợp dữ liệu đối đầu và phân tích nhận định...
          </Typography>
        </Box>
      ) : duelData && duelData.classA && duelData.classB ? (
        <>
          {/* HÀNG THẺ LỚP A & LỚP B */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Thẻ Lớp A */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '2px solid #93c5fd',
                  bgcolor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.08)'
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Chip label="ĐỘI XANH" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, mb: 1 }} />
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {duelData.classA.className}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        GVCN: <strong>{duelData.classA.homeroomTeacher || 'Chưa phân công'}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={duelData.classA.grade ? `Khối ${duelData.classA.grade}` : '—'}
                        size="small"
                        sx={{ bgcolor: '#f1f5f9', fontWeight: 600 }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5 }}>
                        Phòng: {duelData.classA.room || '—'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Tỷ lệ nộp bài
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#2563eb' }}>
                        {duelData.classA.completionRate}%
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Nộp đúng hạn
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                        {duelData.classA.onTimeRate}%
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Sĩ số lớp
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {duelData.classA.expectedStudents || duelData.classA.studentCount || 0} HS
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Thẻ Lớp B */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '2px solid #d8b4fe',
                  bgcolor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(124, 58, 237, 0.08)'
                }}
              >
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
                    <Box>
                      <Chip label="ĐỘI TÍM" size="small" sx={{ bgcolor: '#faf5ff', color: '#7e22ce', fontWeight: 700, mb: 1 }} />
                      <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                        {duelData.classB.className}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        GVCN: <strong>{duelData.classB.homeroomTeacher || 'Chưa phân công'}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={duelData.classB.grade ? `Khối ${duelData.classB.grade}` : '—'}
                        size="small"
                        sx={{ bgcolor: '#f1f5f9', fontWeight: 600 }}
                      />
                      <Typography variant="caption" sx={{ display: 'block', color: '#64748b', mt: 0.5 }}>
                        Phòng: {duelData.classB.room || '—'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Tỷ lệ nộp bài
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#7c3aed' }}>
                        {duelData.classB.completionRate}%
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Nộp đúng hạn
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#059669' }}>
                        {duelData.classB.onTimeRate}%
                      </Typography>
                    </Grid>
                    <Grid size={{ xs: 4 }}>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                        Sĩ số lớp
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {duelData.classB.expectedStudents || duelData.classB.studentCount || 0} HS
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* BIỂU ĐỒ RADAR 5 CHIỀU VÀ BẢNG CHÊNH LỆCH */}
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            {/* Radar Chart */}
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Radar So sánh 5 Chỉ số Toàn diện
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Quy đổi trên thang chuẩn 100 điểm: Nộp bài, Đúng hạn, Điểm số, Chuyên cần, Bài tập đã giao
                  </Typography>
                </Box>
                <CardContent sx={{ p: 2, height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={duelData.radarData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: '#475569', fontSize: 12, fontWeight: 600 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#cbd5e1" />
                      <Radar
                        name={duelData.classA.className}
                        dataKey="classA"
                        stroke="#2563eb"
                        fill="#3b82f6"
                        fillOpacity={0.4}
                      />
                      <Radar
                        name={duelData.classB.className}
                        dataKey="classB"
                        stroke="#7c3aed"
                        fill="#8b5cf6"
                        fillOpacity={0.4}
                      />
                      <Legend />
                      <RechartsTooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>

            {/* Thẻ Delta Chênh Lệch */}
            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Box sx={{ p: 2.5, borderBottom: '1px solid #e2e8f0' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                    Chênh lệch Chỉ số (Delta: Lớp A − Lớp B)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Giá trị dương (+) nghĩa là Lớp A đang dẫn trước
                  </Typography>
                </Box>
                <CardContent sx={{ p: 2.5 }}>
                  {duelData.deltas ? (
                    <Stack spacing={2}>
                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: duelData.deltas.completionRate >= 0 ? '#eff6ff' : '#faf5ff' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                          TỶ LỆ NỘP BÀI TẬP
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: duelData.deltas.completionRate >= 0 ? '#2563eb' : '#7c3aed' }}>
                          {duelData.deltas.completionRate > 0 ? `+${duelData.deltas.completionRate}%` : `${duelData.deltas.completionRate}%`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {duelData.deltas.completionRate > 0
                            ? `${duelData.classA.className} hoàn thành tốt hơn`
                            : `${duelData.classB.className} có tỷ lệ nộp vượt trội hơn`}
                        </Typography>
                      </Box>

                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: duelData.deltas.onTimeRate >= 0 ? '#f0fdf4' : '#fef2f2' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                          TỶ LỆ NỘP ĐÚNG HẠN
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: duelData.deltas.onTimeRate >= 0 ? '#15803d' : '#b91c1c' }}>
                          {duelData.deltas.onTimeRate > 0 ? `+${duelData.deltas.onTimeRate}%` : `${duelData.deltas.onTimeRate}%`}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {duelData.deltas.onTimeRate > 0
                            ? `${duelData.classA.className} kiểm soát hạn chót tốt hơn`
                            : `${duelData.classB.className} có kỷ luật nộp bài đúng giờ hơn`}
                        </Typography>
                      </Box>

                      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                          CHÊNH LỆCH ĐIỂM SỐ TRUNG BÌNH
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {duelData.deltas.averageScore > 0 ? `+${duelData.deltas.averageScore} điểm` : `${duelData.deltas.averageScore} điểm`}
                        </Typography>
                      </Box>
                    </Stack>
                  ) : null}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* NHẬN ĐỊNH SƯ PHẠM & KHUYẾN NGHỊ BGH */}
          <Grid container spacing={2.5} sx={{ mb: 4 }}>
            {/* Insights */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#f8faff' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <TrendingUpIcon sx={{ color: '#2563eb' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1e3a8a' }}>
                      Nhận định Chuyên môn Tự động
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {duelData.insights.map((text, idx) => (
                      <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                        <CheckCircleIcon sx={{ fontSize: 18, color: '#2563eb', mt: 0.3 }} />
                        <Typography variant="body2" sx={{ color: '#334155', lineHeight: 1.6 }}>
                          {text}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>

            {/* Recommendations */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%', borderRadius: 3, border: '1px solid #fde68a', bgcolor: '#fffdf5' }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <LightbulbIcon sx={{ color: '#d97706' }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#92400e' }}>
                      Khuyến nghị Điều hành Ban Giám hiệu
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    {duelData.recommendations.map((text, idx) => (
                      <Stack key={idx} direction="row" spacing={1.5} alignItems="flex-start">
                        <EmojiEventsIcon sx={{ fontSize: 18, color: '#d97706', mt: 0.3 }} />
                        <Typography variant="body2" sx={{ color: '#451a03', lineHeight: 1.6 }}>
                          {text}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      ) : null}

      {/* BẢNG XẾP HẠNG & BENCHMARK TOÀN KHỐI / TOÀN TRƯỜNG */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a' }}>
              Bảng Xếp hạng & Đối sánh Chuẩn (Benchmark)
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              So sánh chỉ số từng lớp với mức trung bình của toàn khối
            </Typography>
          </Box>
          {benchmarkData?.benchmarks && (
            <Stack direction="row" spacing={2} flexWrap="wrap">
              <Chip
                label={`TB Hoàn thành: ${benchmarkData.benchmarks.avgCompletion}%`}
                size="small"
                sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
              />
              <Chip
                label={`TB Đúng hạn: ${benchmarkData.benchmarks.avgOnTime}%`}
                size="small"
                sx={{ bgcolor: '#ecfdf5', color: '#047857', fontWeight: 700 }}
              />
            </Stack>
          )}
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 750 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Thứ hạng</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Lớp học</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Khối</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Giáo viên Chủ nhiệm</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Sĩ số</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Khóa học số</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Tỷ lệ nộp bài</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Đúng hạn</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allClasses.map((cls, idx) => {
                const isTop3 = idx < 3;
                const isDuelA = cls.classId === classAId;
                const isDuelB = cls.classId === classBId;
                return (
                  <TableRow
                    key={cls.classId}
                    hover
                    sx={{
                      bgcolor: isDuelA ? 'rgba(37, 99, 235, 0.04)' : isDuelB ? 'rgba(124, 58, 237, 0.04)' : 'inherit'
                    }}
                  >
                    <TableCell>
                      <Box
                        sx={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: idx === 0 ? '#fef08a' : idx === 1 ? '#e2e8f0' : idx === 2 ? '#fed7aa' : '#f1f5f9',
                          color: '#0f172a',
                          fontWeight: 800,
                          fontSize: '0.75rem'
                        }}
                      >
                        {idx + 1}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {cls.className}
                        </Typography>
                        {isDuelA && <Chip label="Đội Xanh" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />}
                        {isDuelB && <Chip label="Đội Tím" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: '#f3e8ff', color: '#7e22ce', fontWeight: 700 }} />}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip label={cls.grade ? `Khối ${cls.grade}` : '—'} size="small" sx={{ borderRadius: 1.5 }} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                        {cls.homeroomTeacher || 'Chưa phân công'}
                      </Typography>
                    </TableCell>
                    <TableCell>{cls.expectedStudents || cls.studentCount || 0} HS</TableCell>
                    <TableCell>{cls.courseCount || 0} khóa</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          color: cls.completionRate >= 70 ? '#15803d' : cls.completionRate >= 50 ? '#d97706' : '#b91c1c'
                        }}
                      >
                        {cls.completionRate}%
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: '#475569' }}>
                        {cls.onTimeRate}%
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          variant={isDuelA ? 'contained' : 'outlined'}
                          onClick={() => setClassAId(cls.classId)}
                          sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.2, px: 1, minWidth: 64 }}
                        >
                          Chọn A
                        </Button>
                        <Button
                          size="small"
                          color="secondary"
                          variant={isDuelB ? 'contained' : 'outlined'}
                          onClick={() => setClassBId(cls.classId)}
                          sx={{ textTransform: 'none', fontSize: '0.72rem', py: 0.2, px: 1, minWidth: 64 }}
                        >
                          Chọn B
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </Box>
  );
}
