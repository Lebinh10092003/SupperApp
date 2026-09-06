import { useEffect, useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  InputAdornment,
  Box,
  Typography,
  Chip,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  CircularProgress
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFileRounded';
import UndoIcon from '@mui/icons-material/UndoRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import FileDownloadIcon from '@mui/icons-material/FileDownloadRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function SchedulesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null);
  const [batch, setBatch] = useState(localStorage.getItem('scheduleBatch') || '');
  const [dayTab, setDayTab] = useState<number>(0);
  const [q, setQ] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api<{ items: any[] }>('/api/schedules')
      .then((x) => {
        setItems(x.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const parse = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setMsg({ text: 'File CSV không có dữ liệu!', severity: 'error' });
        return;
      }
      const h = lines[0]!.replace(/^\uFEFF/, '').split(',').map((x) => x.trim());
      const data = lines.slice(1).map((l) =>
        Object.fromEntries(l.split(',').map((v, i) => [h[i], v.trim()]))
      );
      setRows(data);
      const p = await api<any>('/api/schedules/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows: data })
      });
      setPreviewData(p);
      setPreviewOpen(true);
    } catch (e: any) {
      setMsg({ text: `Lỗi đọc CSV: ${e.message}`, severity: 'error' });
    }
  };

  const imp = async () => {
    try {
      const r = await api<any>('/api/schedules/import', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      setBatch(r.importBatchId);
      localStorage.setItem('scheduleBatch', r.importBatchId);
      setMsg({ text: `Đã import thành công ${r.imported} tiết học vào thời khóa biểu!`, severity: 'success' });
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      setMsg({ text: `Lỗi import: ${e.message}`, severity: 'error' });
    }
  };

  const rollback = async () => {
    if (!batch) return;
    try {
      await api(`/api/schedules/import/${batch}`, { method: 'DELETE' });
      setBatch('');
      localStorage.removeItem('scheduleBatch');
      setMsg({ text: 'Đã rollback đợt import gần nhất thành công!', severity: 'info' });
      load();
    } catch (e: any) {
      setMsg({ text: `Lỗi rollback: ${e.message}`, severity: 'error' });
    }
  };

  const downloadSampleTemplate = () => {
    const template = `dayOfWeek,period,startTime,endTime,className,subject,teacherEmail,meetingCode\n2,1,07:30,08:15,9A1,Toán học,giaovien@thcs-giangvo.edu.vn,gv-9a1-mat\n2,2,08:20,09:05,9A1,Ngữ văn,giaovien@thcs-giangvo.edu.vn,gv-9a1-lit\n`;
    const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-thoi-khoa-bieu.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const matchDay = dayTab === 0 || x.dayOfWeek === dayTab + 1;
      const query = q.toLowerCase();
      const matchQuery =
        !query ||
        String(x.className || '').toLowerCase().includes(query) ||
        String(x.subject || '').toLowerCase().includes(query) ||
        String(x.teacherEmail || '').toLowerCase().includes(query);
      return matchDay && matchQuery;
    });
  }, [items, dayTab, q]);

  const dayNames = ['Tất cả', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  return (
    <>
      <PageHeader
        title="Thời khóa biểu — THCS Giảng Võ"
        subtitle="Quản lý lịch học theo lớp, môn, giáo viên và tích hợp phòng học Google Meet"
        icon={<CalendarMonthIcon />}
        action={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FileDownloadIcon />}
              onClick={downloadSampleTemplate}
              sx={{ bgcolor: '#fff', borderColor: '#cbd5e1', color: '#475569', fontWeight: 600 }}
            >
              Tải CSV Mẫu
            </Button>
            <Button
              component="label"
              variant="contained"
              startIcon={<UploadFileIcon />}
              sx={{ bgcolor: '#2563eb', fontWeight: 700 }}
            >
              Import CSV
              <input
                type="file"
                hidden
                accept=".csv"
                onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
              />
            </Button>
            {batch && (
              <Button
                color="warning"
                variant="outlined"
                startIcon={<UndoIcon />}
                onClick={rollback}
              >
                Rollback Import
              </Button>
            )}
          </Stack>
        }
      />

      {msg && (
        <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ mb: 2 }}>
          {msg.text}
        </Alert>
      )}

      {/* Filter Tabs and Search Bar */}
      <Card sx={{ mb: 3 }}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 8 }}>
              <Tabs
                value={dayTab}
                onChange={(_, v) => setDayTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  '& .MuiTab-root': { fontWeight: 700, minWidth: 80, fontSize: '0.875rem' }
                }}
              >
                {dayNames.map((d) => (
                  <Tab key={d} label={d} />
                ))}
              </Tabs>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Tìm theo lớp, môn, giáo viên..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Timetable Table */}
      <Card sx={{ overflow: 'hidden' }}>
        <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 100 }}>Thứ</TableCell>
                <TableCell sx={{ width: 100 }}>Tiết</TableCell>
                <TableCell sx={{ width: 120 }}>Thời gian</TableCell>
                <TableCell>Lớp học</TableCell>
                <TableCell>Môn học</TableCell>
                <TableCell>Giáo viên phụ trách</TableCell>
                <TableCell>Google Meet Code</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 6, textAlign: 'center' }}>
                    <CircularProgress size={30} />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ py: 8, textAlign: 'center' }}>
                    <Box sx={{ color: '#94a3b8', fontSize: '2.5rem', mb: 1 }}>📅</Box>
                    <Typography variant="h6" fontWeight={700} color="#1e293b" sx={{ mb: 0.5 }}>
                      Chưa có tiết học nào trong thời khóa biểu
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 440, mx: 'auto', mb: 2.5 }}>
                      Vui lòng sử dụng chức năng <strong>Import CSV</strong> để tải lịch học của trường lên hệ thống.
                    </Typography>
                    <Button
                      component="label"
                      variant="contained"
                      startIcon={<UploadFileIcon />}
                      sx={{ bgcolor: '#2563eb', fontWeight: 700 }}
                    >
                      Tải File CSV Thời Khóa Biểu
                      <input
                        type="file"
                        hidden
                        accept=".csv"
                        onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
                      />
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((x) => (
                  <TableRow key={x.id} hover>
                    <TableCell>
                      <Chip
                        label={`Thứ ${x.dayOfWeek}`}
                        size="small"
                        sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={`Tiết ${x.period}`}
                        size="small"
                        sx={{ bgcolor: '#f1f5f9', color: '#334155', fontWeight: 700 }}
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#64748b', fontSize: '0.8125rem' }}>
                      {x.startTime && x.endTime ? `${x.startTime} – ${x.endTime}` : (x.startTime || x.endTime || '—')}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                        {x.className}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600} sx={{ color: '#2563eb' }}>
                        {x.subject}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: '#475569' }}>
                      {x.teacherEmail}
                    </TableCell>
                    <TableCell>
                      {x.meetingCode || x.spaceName ? (
                        <Chip
                          icon={<CheckCircleIcon sx={{ fontSize: '14px !important' }} />}
                          label={x.meetingCode || x.spaceName}
                          size="small"
                          sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 600 }}
                        />
                      ) : (
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                          Chưa cấu hình
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* CSV Preview & Confirm Dialog */}
      <Dialog
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Xem trước dữ liệu Thời khóa biểu CSV
        </DialogTitle>
        <DialogContent dividers>
          {previewData && (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Alert severity="success" sx={{ flex: 1 }}>
                  <strong>{previewData.valid}</strong> dòng hợp lệ
                </Alert>
                {previewData.invalid > 0 && (
                  <Alert severity="error" sx={{ flex: 1 }}>
                    <strong>{previewData.invalid}</strong> dòng lỗi
                  </Alert>
                )}
              </Box>

              <Typography variant="subtitle2">Dữ liệu mẫu 5 dòng đầu:</Typography>
              <TableContainer sx={{ maxHeight: 240 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Thứ</TableCell>
                      <TableCell>Tiết</TableCell>
                      <TableCell>Lớp</TableCell>
                      <TableCell>Môn</TableCell>
                      <TableCell>Giáo viên</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(previewData.sample || []).slice(0, 5).map((s: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{s.dayOfWeek}</TableCell>
                        <TableCell>{s.period}</TableCell>
                        <TableCell>{s.className}</TableCell>
                        <TableCell>{s.subject}</TableCell>
                        <TableCell>{s.teacherEmail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setPreviewOpen(false)}>Hủy</Button>
          <Button variant="contained" onClick={imp} sx={{ bgcolor: '#2563eb' }}>
            Xác nhận Import vào hệ thống
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}