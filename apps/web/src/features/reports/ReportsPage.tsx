import { useState } from 'react';
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
  CircularProgress
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/AssessmentRounded';
import DownloadIcon from '@mui/icons-material/DownloadRounded';
import FactCheckIcon from '@mui/icons-material/FactCheckRounded';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesRounded';
import VideocamIcon from '@mui/icons-material/VideocamRounded';
import { PageHeader } from '../../components/PageHeader';
import { download } from '../../services/api';

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
  const [downloading, setDownloading] = useState<string | null>(null);
  const [period, setPeriod] = useState('30');
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'error' } | null>(null);

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

  return (
    <>
      <PageHeader
        title="Trung tâm Báo cáo & Xuất số liệu — THCS Giảng Võ"
        subtitle="Xuất các báo cáo thống kê chuyên cần, tình hình học tập và dữ liệu tổng hợp phục vụ điều hành"
        icon={<AssessmentIcon />}
      />

      {toast && (
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2.5, borderRadius: 2 }}>
          {toast.text}
        </Alert>
      )}

      {/* Filter Card */}
      <Card sx={{ mb: 3, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
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
              <MenuItem value="90">Học kỳ II (90 ngày)</MenuItem>
              <MenuItem value="180">Cả năm học 2025–2026</MenuItem>
            </TextField>

            <Typography variant="body2" color="text.secondary">
              Định dạng xuất chuẩn: <strong>CSV (UTF-8 có BOM tiếng Việt)</strong> tương thích hoàn toàn với Microsoft Excel và Google Sheets.
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
                borderRadius: 3,
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}
            >
              <CardContent sx={{ p: 3, flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ p: 1.2, bgcolor: '#f1f5f9', borderRadius: 2.5, display: 'grid', placeItems: 'center' }}>
                    {rep.icon}
                  </Box>
                  <Chip
                    label={rep.tag}
                    size="small"
                    sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                  />
                </Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: '#0f172a', mb: 1 }}>
                  {rep.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                  {rep.desc}
                </Typography>
              </CardContent>
              <Box sx={{ p: 2.5, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={downloading === rep.id ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  disabled={downloading === rep.id}
                  onClick={() => handleDownload(rep)}
                  sx={{ bgcolor: '#2563eb', py: 1, fontWeight: 700 }}
                >
                  {downloading === rep.id ? 'Đang kết xuất CSV...' : 'Tải báo cáo CSV'}
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}