import { useEffect, useState } from 'react';
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
  CircularProgress
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

import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

interface KpiItemProps {
  title: string;
  value: string | number;
  delta?: string;
  deltaPositive?: boolean;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  bgLight: string;
  onClick?: () => void;
}

const CardK = ({ title, value, delta, deltaPositive = true, subtitle, icon, color, bgLight, onClick }: KpiItemProps) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      borderRadius: 3,
      border: '1px solid #e2e8f0',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.2s ease',
      '&:hover': onClick
        ? {
            transform: 'translateY(-3px)',
            boxShadow: '0 12px 20px -5px rgba(0, 0, 0, 0.08)'
          }
        : {}
    }}
  >
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Typography color="text.secondary" variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
          {title}
        </Typography>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            bgcolor: bgLight,
            color: color,
            display: 'grid',
            placeItems: 'center'
          }}
        >
          {icon}
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, my: 0.5 }}>
        <Typography variant="h4" fontWeight={900} sx={{ color: '#0f172a', letterSpacing: '-0.02em' }}>
          {value ?? '0'}
        </Typography>
        {delta && (
          <Typography
            variant="caption"
            fontWeight={800}
            sx={{ color: deltaPositive ? '#16a34a' : '#dc2626' }}
          >
            {delta}
          </Typography>
        )}
      </Box>

      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
        {subtitle || 'Dữ liệu chuẩn hóa trường học'}
      </Typography>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this_month');
  const [grade, setGrade] = useState('all');
  const [overview, setOverview] = useState<any>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

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

  useEffect(() => {
    fetchOverview();
  }, [period, grade]);

  const handleQuickSync = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const res = await api.post<any>('/api/classroom/sync', {});
      setSyncNotice(res.message || `Đã đồng bộ thành công ${res.success || res.total || 0} khóa học Google Classroom!`);
      await fetchOverview();
    } catch (e: any) {
      setSyncNotice(`Không thể đồng bộ tự động: ${e.message}. Hãy kiểm tra kết nối tài khoản.`);
    } finally {
      setSyncing(false);
    }
  };

  const k = overview?.kpis;
  const isSynced = overview?.isSynced;

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeader
        title="Bảng Điều Hành Toàn Trường — Ban Giám Hiệu"
        subtitle="Hệ thống tổng hợp, so sánh, cảnh báo và hỗ trợ ra quyết định quản trị lớp học số từ Google Classroom"
        action={
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <CloudSyncIcon />}
              onClick={handleQuickSync}
              disabled={syncing}
              sx={{ fontWeight: 700, px: 2, bgcolor: '#2563eb' }}
            >
              {syncing ? 'Đang đồng bộ Classroom...' : 'Đồng Bộ Classroom'}
            </Button>

            <Button
              variant="outlined"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={fetchOverview}
              sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
            >
              Làm mới
            </Button>

            <FormControl size="small" sx={{ minWidth: 150, bgcolor: '#fff' }}>
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

            <FormControl size="small" sx={{ minWidth: 130, bgcolor: '#fff' }}>
              <InputLabel>Khối lớp</InputLabel>
              <Select value={grade} label="Khối lớp" onChange={(e) => setGrade(e.target.value)}>
                <MenuItem value="all">Toàn trường</MenuItem>
                <MenuItem value="6">Khối 6</MenuItem>
                <MenuItem value="7">Khối 7</MenuItem>
                <MenuItem value="8">Khối 8</MenuItem>
                <MenuItem value="9">Khối 9</MenuItem>
              </Select>
            </FormControl>
          </Box>
        }
      />

      {syncNotice && (
        <Alert severity={syncNotice.includes('thành công') ? 'success' : 'warning'} sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setSyncNotice(null)}>
          {syncNotice}
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
      <Box sx={{ display: 'flex', gap: 1.5, mb: 3, overflowX: 'auto', pb: 1 }}>
        <Button
          variant="contained"
          startIcon={<GridViewIcon />}
          onClick={() => navigate('/executive')}
          sx={{ bgcolor: '#0f172a', whiteSpace: 'nowrap' }}
        >
          Executive Heatmap Lớp × Môn
        </Button>

        <Button
          variant="outlined"
          startIcon={<PersonSearchIcon />}
          onClick={() => navigate('/students/360')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#cbd5e1' }}
        >
          Hồ sơ 360° Học sinh
        </Button>

        <Button
          variant="outlined"
          startIcon={<CompareArrowsIcon />}
          onClick={() => navigate('/classes/compare')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#cbd5e1' }}
        >
          So sánh Lớp học Đối đầu
        </Button>

        <Button
          variant="outlined"
          startIcon={<AutoStoriesIcon />}
          onClick={() => navigate('/subjects/analytics')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#cbd5e1' }}
        >
          Phân tích Môn học
        </Button>

        <Button
          variant="outlined"
          color="error"
          startIcon={<NotificationsActiveIcon />}
          onClick={() => navigate('/alerts')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff' }}
        >
          Trung tâm Cảnh báo ({k?.openAlerts?.value ?? 0})
        </Button>
      </Box>

      {/* Cảnh báo Lớp học Ngủ đông nếu có */}
      {Number(k?.dormantClassrooms?.value || 0) > 0 && (
        <Alert
          severity="warning"
          icon={<SleepIcon />}
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/classroom')}>
              Xem chi tiết
            </Button>
          }
        >
          <strong>CẢNH BÁO LỚP HỌC NGỦ ĐÔNG:</strong> Phát hiện {k?.dormantClassrooms?.value} Classroom đã quá 14 ngày không có bài tập, tài liệu hoặc thông báo mới từ giáo viên.
        </Alert>
      )}

      {/* Lưới Thẻ KPI Điều Hành 8 Chỉ Số Thực (100% SSOT Đồng Bộ 1:1) */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="KHÓA HỌC CLASSROOM"
            value={k?.totalCourses?.value ?? k?.activeClassrooms?.value ?? 0}
            delta={k?.activeClassrooms?.delta}
            subtitle={isSynced ? 'Lớp học số đang hoạt động' : 'Chờ đồng bộ Classroom'}
            icon={<AutoStoriesIcon />}
            color="#2563eb"
            bgLight="#eff6ff"
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="GIÁO VIÊN GIẢNG DẠY"
            value={k?.totalTeachers?.value ?? 0}
            delta={k?.totalTeachers?.delta || `${k?.totalTeachers?.value ?? 0} Giáo viên`}
            subtitle="Đồng bộ từ Google Classroom"
            icon={<BadgeIcon />}
            color="#059669"
            bgLight="#ecfdf5"
            onClick={() => navigate('/teachers')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="HỌC SINH TOÀN TRƯỜNG"
            value={k?.totalStudents?.value ?? 0}
            delta={k?.totalStudents?.delta || `${k?.totalStudents?.value ?? 0} Học sinh`}
            subtitle="Danh sách từ Classroom"
            icon={<PeopleAltIcon />}
            color="#0284c7"
            bgLight="#e0f2fe"
            onClick={() => navigate('/students')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="LỚP HÀNH CHÍNH"
            value={k?.totalClasses?.value ?? 0}
            delta={k?.totalClasses?.delta || `${k?.totalClasses?.value ?? 0} Lớp học`}
            subtitle="Phân bổ khối 6, 7, 8, 9"
            icon={<SchoolIcon />}
            color="#4f46e5"
            bgLight="#eef2ff"
            onClick={() => navigate('/classes')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="TỶ LỆ HOÀN THÀNH BÀI TẬP"
            value={k?.completionRate?.value != null ? `${k.completionRate.value}%` : '0%'}
            delta={k?.completionRate?.delta}
            deltaPositive={Number(k?.completionRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Tiến độ nộp bài thực tế' : 'Chưa có bài nộp'}
            icon={<CheckCircleIcon />}
            color="#16a34a"
            bgLight="#dcfce7"
            onClick={() => navigate('/executive')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="TỶ LỆ NỘP ĐÚNG HẠN"
            value={k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%'}
            delta={k?.onTimeRate?.delta}
            deltaPositive={Number(k?.onTimeRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Nộp trước hạn chót' : 'Chưa có số liệu'}
            icon={<AssignmentIcon />}
            color="#0891b2"
            bgLight="#cffafe"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="BÀI CHƯA CHẤM / TỒN ĐỌNG"
            value={k?.ungradedAssignments?.value ?? 0}
            delta={k?.ungradedAssignments?.delta}
            deltaPositive={Number(k?.ungradedAssignments?.value || 0) === 0}
            subtitle="Đang chờ giáo viên trả điểm"
            icon={<WarningAmberIcon />}
            color="#ea580c"
            bgLight="#ffedd5"
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="CẢNH BÁO CẦN XỬ LÝ"
            value={k?.openAlerts?.value ?? 0}
            delta={k?.openAlerts?.delta}
            deltaPositive={Number(k?.openAlerts?.value || 0) === 0}
            subtitle="Được quét tự động theo quy tắc"
            icon={<NotificationsActiveIcon />}
            color="#e11d48"
            bgLight="#ffe4e6"
            onClick={() => navigate('/alerts')}
          />
        </Grid>
      </Grid>

      {/* Biểu đồ Xu hướng Hoàn thành theo thời gian */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="h6" fontWeight={800} color="#0f172a">
            Xu Hướng Học Tập Toàn Trường
          </Typography>
          <Chip
            label={trendData.length > 0 ? 'Dữ liệu thời gian thực' : 'Đang chờ chu kỳ đồng bộ tiếp theo'}
            color={trendData.length > 0 ? 'success' : 'default'}
            size="small"
            sx={{ fontWeight: 700 }}
          />
        </Box>

        {trendData.length > 0 ? (
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="completion"
                  name="Tỷ lệ nộp bài (%)"
                  stroke="#16a34a"
                  strokeWidth={3}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="onTime"
                  name="Tỷ lệ đúng hạn (%)"
                  stroke="#0891b2"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={600} color="#64748b" sx={{ mb: 1 }}>
              Chưa có dữ liệu lịch sử theo dõi
            </Typography>
            <Typography variant="caption" color="#94a3b8">
              Biểu đồ sẽ tự động hiển thị tiến trình khi dữ liệu bài nộp được tích lũy theo từng chu kỳ đồng bộ.
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}