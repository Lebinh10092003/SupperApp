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
        <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ mb: 2.5, borderRadius: '6px' }}>
          {toast.text}
        </Alert>
      )}

      {/* Filter Card */}
      <Card sx={{ mb: 3, borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
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

            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
              Định dạng xuất chuẩn: <strong style={{ color: '#09090b' }}>CSV (UTF-8 có BOM tiếng Việt)</strong> tương thích hoàn toàn với Microsoft Excel và Google Sheets.
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
                borderRadius: '8px',
                border: '1px solid #e4e4e7',
                boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)',
                bgcolor: '#ffffff'
              }}
            >
              <CardContent sx={{ p: 3, flex: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box sx={{ p: 1.25, bgcolor: '#f4f4f5', borderRadius: '8px', display: 'grid', placeItems: 'center', color: '#18181b' }}>
                    {rep.icon}
                  </Box>
                  <Chip
                    label={rep.tag}
                    size="small"
                    sx={{
                      bgcolor: '#f4f4f5',
                      color: '#18181b',
                      border: '1px solid #e4e4e7',
                      fontWeight: 600,
                      fontSize: '0.75rem'
                    }}
                  />
                </Box>
                <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#09090b', mb: 1, letterSpacing: '-0.01em' }}>
                  {rep.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#71717a', mb: 3, fontSize: '0.8125rem', lineHeight: 1.5 }}>
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
                    bgcolor: '#18181b',
                    color: '#ffffff',
                    '&:hover': { bgcolor: '#27272a' },
                    py: 1,
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    textTransform: 'none',
                    borderRadius: '6px'
                  }}
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