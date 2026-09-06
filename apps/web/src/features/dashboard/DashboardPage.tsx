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
  onClick?: () => void;
}

const CardK = ({ title, value, delta, deltaPositive = true, subtitle, icon, onClick }: KpiItemProps) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      borderRadius: 2,
      border: '1px solid #e4e4e7',
      bgcolor: '#ffffff',
      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'all 0.15s ease-in-out',
      '&:hover': onClick
        ? {
            borderColor: '#a1a1aa',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }
        : {}
    }}
  >
    <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, color: '#71717a', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        <Box sx={{ color: '#71717a', display: 'flex', alignItems: 'center' }}>
          {icon}
        </Box>
      </Box>

      <Box sx={{ my: 0.5 }}>
        <Typography variant="h4" fontWeight={700} sx={{ color: '#09090b', letterSpacing: '-0.03em', fontSize: '1.75rem', lineHeight: 1.2 }}>
          {value ?? '0'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
        {delta && (
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ color: deltaPositive ? '#16a34a' : '#e11d48', fontSize: '0.72rem' }}
          >
            {delta}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: '#a1a1aa', fontSize: '0.72rem' }}>
          • {subtitle || 'Classroom'}
        </Typography>
      </Box>
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

      {/* Lối tắt Điều Hành Nhanh (shadcn Action Bar) */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, overflowX: 'auto', pb: 0.5 }}>
        <Button
          variant="contained"
          size="small"
          startIcon={<GridViewIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/executive')}
          sx={{ bgcolor: '#18181b', color: '#fafafa', whiteSpace: 'nowrap', fontWeight: 500, '&:hover': { bgcolor: '#27272a' } }}
        >
          Executive Heatmap Lớp × Môn
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<PersonSearchIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/students/360')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#e4e4e7', color: '#18181b', fontWeight: 500, '&:hover': { bgcolor: '#f4f4f5' } }}
        >
          Hồ sơ 360° Học sinh
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<CompareArrowsIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/classes/compare')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#e4e4e7', color: '#18181b', fontWeight: 500, '&:hover': { bgcolor: '#f4f4f5' } }}
        >
          So sánh Lớp học Đối đầu
        </Button>

        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoStoriesIcon sx={{ fontSize: 16 }} />}
          onClick={() => navigate('/subjects/analytics')}
          sx={{ whiteSpace: 'nowrap', bgcolor: '#fff', borderColor: '#e4e4e7', color: '#18181b', fontWeight: 500, '&:hover': { bgcolor: '#f4f4f5' } }}
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
            bgcolor: '#ffffff',
            borderColor: Number(k?.openAlerts?.value || 0) > 0 ? '#fecaca' : '#e4e4e7',
            color: Number(k?.openAlerts?.value || 0) > 0 ? '#dc2626' : '#18181b',
            fontWeight: 500,
            '&:hover': { bgcolor: Number(k?.openAlerts?.value || 0) > 0 ? '#fef2f2' : '#f4f4f5' }
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
          sx={{ mb: 3, borderRadius: 1.5, border: '1px solid #fed7aa', bgcolor: '#fffbeb' }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate('/classroom')} sx={{ fontWeight: 600 }}>
              Xem chi tiết
            </Button>
          }
        >
          <strong>CẢNH BÁO LỚP HỌC NGỦ ĐÔNG:</strong> Phát hiện {k?.dormantClassrooms?.value} Classroom đã quá 14 ngày không có bài tập, tài liệu hoặc thông báo mới từ giáo viên.
        </Alert>
      )}

      {/* Lưới Thẻ KPI Điều Hành 8 Chỉ Số Thực (100% SSOT Đồng Bộ 1:1 theo shadcn Dashboard 01) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Khóa học Classroom"
            value={k?.totalCourses?.value ?? k?.activeClassrooms?.value ?? 0}
            delta={k?.activeClassrooms?.delta}
            subtitle={isSynced ? 'Lớp số hoạt động' : 'Chờ đồng bộ'}
            icon={<AutoStoriesIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Giáo viên giảng dạy"
            value={k?.totalTeachers?.value ?? 0}
            delta={k?.totalTeachers?.delta || `${k?.totalTeachers?.value ?? 0} Giáo viên`}
            subtitle="Từ Classroom & Danh bạ"
            icon={<BadgeIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/teachers')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Học sinh toàn trường"
            value={k?.totalStudents?.value ?? 0}
            delta={k?.totalStudents?.delta || `${k?.totalStudents?.value ?? 0} Học sinh`}
            subtitle="Từ Google Classroom"
            icon={<PeopleAltIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/students')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Lớp hành chính"
            value={k?.totalClasses?.value ?? 0}
            delta={k?.totalClasses?.delta || `${k?.totalClasses?.value ?? 0} Lớp`}
            subtitle="Khối 6, 7, 8, 9"
            icon={<SchoolIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/classes')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Tỷ lệ hoàn thành bài"
            value={k?.completionRate?.value != null ? `${k.completionRate.value}%` : '0%'}
            delta={k?.completionRate?.delta}
            deltaPositive={Number(k?.completionRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Tiến độ nộp bài' : 'Chưa có bài'}
            icon={<CheckCircleIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/executive')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Tỷ lệ nộp đúng hạn"
            value={k?.onTimeRate?.value != null ? `${k.onTimeRate.value}%` : '0%'}
            delta={k?.onTimeRate?.delta}
            deltaPositive={Number(k?.onTimeRate?.value || 0) >= 80}
            subtitle={isSynced ? 'Đúng hạn chót' : 'Chưa có số liệu'}
            icon={<AssignmentIcon sx={{ fontSize: 18 }} />}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Bài chưa chấm / Tồn đọng"
            value={k?.ungradedAssignments?.value ?? 0}
            delta={k?.ungradedAssignments?.delta}
            deltaPositive={Number(k?.ungradedAssignments?.value || 0) === 0}
            subtitle="Chờ giáo viên chấm"
            icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Cảnh báo cần xử lý"
            value={k?.openAlerts?.value ?? 0}
            delta={k?.openAlerts?.delta}
            deltaPositive={Number(k?.openAlerts?.value || 0) === 0}
            subtitle="Quét tự động"
            icon={<NotificationsActiveIcon sx={{ fontSize: 18 }} />}
            onClick={() => navigate('/alerts')}
          />
        </Grid>
      </Grid>

      {/* Biểu đồ Xu hướng Hoàn thành theo thời gian (shadcn Chart Block) */}
      <Card sx={{ borderRadius: 2, border: '1px solid #e4e4e7', bgcolor: '#ffffff', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)', p: 2.5, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600} sx={{ color: '#09090b', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
              Xu Hướng Học Tập Toàn Trường
            </Typography>
            <Typography variant="caption" sx={{ color: '#71717a' }}>
              Theo dõi tiến độ hoàn thành và nộp bài đúng hạn
            </Typography>
          </Box>
          <Chip
            label={trendData.length > 0 ? 'Dữ liệu thời gian thực' : 'Đang chờ chu kỳ đồng bộ'}
            size="small"
            sx={{
              fontWeight: 500,
              fontSize: '0.72rem',
              bgcolor: trendData.length > 0 ? '#f0fdf4' : '#f4f4f5',
              color: trendData.length > 0 ? '#166534' : '#71717a',
              border: trendData.length > 0 ? '1px solid #bbf7d0' : '1px solid #e4e4e7'
            }}
          />
        </Box>

        {trendData.length > 0 ? (
          <Box sx={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                <XAxis dataKey="date" stroke="#a1a1aa" fontSize={11} tickLine={false} />
                <YAxis yAxisId="left" domain={[0, 100]} stroke="#a1a1aa" fontSize={11} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="completion"
                  name="Tỷ lệ nộp bài (%)"
                  stroke="#18181b"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#18181b' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="onTime"
                  name="Tỷ lệ đúng hạn (%)"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#2563eb' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#fcfcfd', border: '1px dashed #e4e4e7', borderRadius: 2 }}>
            <Typography variant="body2" fontWeight={500} color="#09090b" sx={{ mb: 0.5, fontSize: '0.84rem' }}>
              Chưa có dữ liệu lịch sử theo dõi
            </Typography>
            <Typography variant="caption" color="#71717a">
              Biểu đồ sẽ tự động hiển thị tiến trình khi dữ liệu bài nộp được tích lũy theo từng chu kỳ đồng bộ Google Classroom.
            </Typography>
          </Box>
        )}
      </Card>
    </Box>
  );
}