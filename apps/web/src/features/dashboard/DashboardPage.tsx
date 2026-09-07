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
  accentColor?: string;
  iconBg?: string;
  onClick?: () => void;
}

const CardK = ({ title, value, delta, deltaPositive = true, subtitle, icon, accentColor = '#2563eb', iconBg = '#eff6ff', onClick }: KpiItemProps) => (
  <Card
    onClick={onClick}
    sx={{
      height: '100%',
      borderRadius: 3,
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
    <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.72rem', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: iconBg,
            color: accentColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
          }}
        >
          {icon}
        </Box>
      </Box>

      <Box sx={{ my: 0.5 }}>
        <Typography variant="h4" fontWeight={800} sx={{ color: '#0f172a', letterSpacing: '-0.03em', fontSize: '1.85rem', lineHeight: 1.2 }}>
          {value ?? '0'}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
        {delta && (
          <Typography
            variant="caption"
            fontWeight={700}
            sx={{ color: deltaPositive ? '#10b981' : '#ef4444', fontSize: '0.75rem' }}
          >
            {delta}
          </Typography>
        )}
        <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: '0.75rem' }}>
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

      {/* Lối tắt Điều Hành Nhanh */}
      <Box sx={{ display: 'flex', gap: 1.25, mb: 3, overflowX: 'auto', pb: 0.5 }}>
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

      {/* Lưới Thẻ KPI Điều Hành 8 Chỉ Số Thực */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Khóa học Classroom"
            value={k?.totalCourses?.value ?? k?.activeClassrooms?.value ?? 0}
            delta={k?.activeClassrooms?.delta}
            subtitle={isSynced ? 'Lớp số hoạt động' : 'Chờ đồng bộ'}
            icon={<AutoStoriesIcon sx={{ fontSize: 20 }} />}
            accentColor="#2563eb"
            iconBg="#eff6ff"
            onClick={() => navigate('/classroom')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Giáo viên giảng dạy"
            value={k?.totalTeachers?.value ?? 0}
            delta={k?.totalTeachers?.delta || `${k?.totalTeachers?.value ?? 0} Giáo viên`}
            subtitle="Từ Classroom & Danh bạ"
            icon={<BadgeIcon sx={{ fontSize: 20 }} />}
            accentColor="#4f46e5"
            iconBg="#eef2ff"
            onClick={() => navigate('/teachers')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Học sinh toàn trường"
            value={k?.totalStudents?.value ?? 0}
            delta={k?.totalStudents?.delta || `${k?.totalStudents?.value ?? 0} Học sinh`}
            subtitle="Từ Google Classroom"
            icon={<PeopleAltIcon sx={{ fontSize: 20 }} />}
            accentColor="#0284c7"
            iconBg="#f0f9ff"
            onClick={() => navigate('/students')}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Lớp hành chính"
            value={k?.totalClasses?.value ?? 0}
            delta={k?.totalClasses?.delta || `${k?.totalClasses?.value ?? 0} Lớp`}
            subtitle="Khối 6, 7, 8, 9"
            icon={<SchoolIcon sx={{ fontSize: 20 }} />}
            accentColor="#0891b2"
            iconBg="#ecfeff"
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
            icon={<CheckCircleIcon sx={{ fontSize: 20 }} />}
            accentColor="#10b981"
            iconBg="#ecfdf5"
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
            icon={<AssignmentIcon sx={{ fontSize: 20 }} />}
            accentColor="#059669"
            iconBg="#f0fdf4"
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <CardK
            title="Bài chưa chấm / Tồn đọng"
            value={k?.ungradedAssignments?.value ?? 0}
            delta={k?.ungradedAssignments?.delta}
            deltaPositive={Number(k?.ungradedAssignments?.value || 0) === 0}
            subtitle="Chờ giáo viên chấm"
            icon={<WarningAmberIcon sx={{ fontSize: 20 }} />}
            accentColor="#f59e0b"
            iconBg="#fffbeb"
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
            icon={<NotificationsActiveIcon sx={{ fontSize: 20 }} />}
            accentColor="#ef4444"
            iconBg="#fef2f2"
            onClick={() => navigate('/alerts')}
          />
        </Grid>
      </Grid>

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
          <Box sx={{ width: '100%', height: 290 }}>
            <ResponsiveContainer>
              <LineChart data={trendData}>
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
    </Box>
  );
}