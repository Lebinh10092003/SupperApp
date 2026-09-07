import { useEffect, useState, useMemo } from 'react';
import {
  Button,
  Card,
  CardContent,
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  LinearProgress,
  Stack,
  Alert,
  CircularProgress
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/SearchRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function ClassroomPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [mapTarget, setMapTarget] = useState<any>(null);
  const [classId, setClassId] = useState('');
  const [className, setClassName] = useState('');
  const [toast, setToast] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncDialog, setSyncDialog] = useState<{ open: boolean; title: string; message: string; isError: boolean }>({
    open: false,
    title: '',
    message: '',
    isError: false
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.post<any>('/api/classroom/sync');
      setSyncDialog({
        open: true,
        title: 'Đồng Bộ Thành Công',
        message: res.message || `Đã đồng bộ thành công ${res.success || 0} khóa học từ Google Classroom!`,
        isError: false
      });
      load();
    } catch (err: any) {
      setSyncDialog({
        open: true,
        title: 'Chưa Thể Đồng Bộ Google Classroom',
        message: err.message || 'Chưa thiết lập kết nối Google Classroom.',
        isError: true
      });
    } finally {
      setSyncing(false);
    }
  };

  const load = () => {
    setLoading(true);
    api<{ items: any[] }>('/api/classroom')
      .then((x) => {
        setItems(x.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('oauth_success')) {
      const count = params.get('count') || '0';
      setSyncDialog({
        open: true,
        title: 'Đăng Nhập Google & Đồng Bộ Thành Công!',
        message: `Đã kết nối tài khoản Google và nạp thành công ${count} khóa học từ Google Classroom!`,
        isError: false
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    load();
  }, []);

  const openMapDialog = (course: any) => {
    setMapTarget(course);
    setClassId(course.classId || '');
    setClassName(course.className || (course.classId ? `Lớp ${course.classId}` : ''));
  };

  const handleSaveMapping = async () => {
    if (!mapTarget || !classId.trim()) return;
    try {
      await api(`/api/classroom/${mapTarget.id}/map`, {
        method: 'PATCH',
        body: JSON.stringify({ classId: classId.trim(), className: className.trim() || `Lớp ${classId.trim()}` })
      });
      setToast(`Đã map thành công khóa học vào ${className || classId}!`);
      setMapTarget(null);
      load();
    } catch (e: any) {
      setToast(`Lỗi mapping: ${e.message}`);
    }
  };

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return items.filter((x) =>
      !query ||
      String(x.name || '').toLowerCase().includes(query) ||
      String(x.className || '').toLowerCase().includes(query) ||
      String(x.section || '').toLowerCase().includes(query)
    );
  }, [items, q]);

  const mappedCount = items.filter((x) => x.className || x.classId).length;

  const avgSubmissionRate = useMemo(() => {
    const withRates = items.filter((x) => typeof x.content?.completionRate === 'number' || typeof x.content?.submissionRate === 'number');
    if (withRates.length === 0) return 0;
    const sum = withRates.reduce((acc, curr) => acc + (curr.content?.completionRate ?? curr.content?.submissionRate ?? 0), 0);
    return Math.round(sum / withRates.length);
  }, [items]);

  return (
    <>
      <PageHeader
        title="Google Classroom — THCS Giảng Võ"
        subtitle="Quản lý đồng bộ khóa học, danh sách học sinh (Roster) và mapping với lớp hành chính"
        icon={<SchoolIcon />}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleSync}
              disabled={syncing}
              sx={{ fontWeight: 700 }}
            >
              {syncing ? 'Đang đồng bộ Google...' : 'Đồng bộ từ Google Classroom'}
            </Button>
            <Button
              variant="outlined"
              startIcon={<LinkIcon />}
              onClick={() => navigate('/connections')}
              sx={{ fontWeight: 700 }}
            >
              Cấu hình kết nối Google
            </Button>
          </Stack>
        }
      />

      {toast && (
        <Alert severity="success" onClose={() => setToast('')} sx={{ mb: 2.5, borderRadius: '6px' }}>
          {toast}
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tổng khóa học Classroom
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                Đồng bộ tự động từ Google Workspace
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ Mapping lớp hành chính
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#2563eb', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length ? Math.round((mappedCount / items.length) * 100) : 0}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {mappedCount}/{items.length} khóa học đã xác định lớp
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ nộp bài trung bình
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#10b981', my: 0.5, letterSpacing: '-0.025em' }}>
                {avgSubmissionRate}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {items.length ? 'Dựa trên bài tập đã giao trong học kỳ' : 'Chưa có dữ liệu bài tập'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Unified DataTable Block */}
      <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden', bgcolor: '#ffffff' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Tìm theo tên khóa học, mã lớp, học kỳ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ width: { xs: '100%', sm: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                </InputAdornment>
              )
            }}
          />
          <Chip
            label={`Hiển thị ${filtered.length} / ${items.length} khóa học`}
            size="small"
            sx={{
              height: 26,
              fontSize: '0.75rem',
              fontWeight: 600,
              bgcolor: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe'
            }}
          />
        </Box>

        {items.length === 0 && !loading ? (
          <Box sx={{ p: 6, textAlign: 'center', bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Box sx={{
              width: 56,
              height: 56,
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
              color: '#ffffff',
              display: 'grid',
              placeItems: 'center',
              mx: 'auto',
              mb: 2,
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)'
            }}>
              <SchoolIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 0.5 }}>
              Chưa có khóa học nào được đồng bộ từ Google Classroom
            </Typography>
            <Typography variant="body2" color="#64748b" sx={{ maxWidth: 580, mx: 'auto', mb: 3 }}>
              Hệ thống THCS Giảng Võ tuân thủ nguyên tắc 100% dữ liệu thực tế từ Google Classroom API chính thức, tuyệt đối không dùng dữ liệu giả lập. Vui lòng kết nối tài khoản Google để nạp toàn bộ danh sách lớp học và bài nộp thực tế.
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/connections')}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
                }}
              >
                Kết nối Google Classroom (Chế độ A / B)
              </Button>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon sx={{ fontSize: 16 }} />}
                onClick={handleSync}
                disabled={syncing}
                sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: '8px' }}
              >
                Thử đồng bộ ngay
              </Button>
            </Stack>
          </Box>
        ) : (
          <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="medium">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tên khóa học</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Học kỳ / Section</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trạng thái</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lớp hành chính</TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sĩ số Roster</TableCell>
                  <TableCell sx={{ minWidth: 160, fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tỷ lệ nộp bài</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hành động</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((x) => {
                  const subRate = typeof x.content?.completionRate === 'number'
                    ? x.content.completionRate
                    : (typeof x.content?.submissionRate === 'number' ? x.content.submissionRate : null);
                  const isMapped = Boolean(x.className || x.classId);
                  return (
                    <TableRow key={x.id} hover sx={{ '&:hover': { bgcolor: 'rgba(239, 246, 255, 0.6)' } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a' }}>
                          {x.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#64748b' }}>{x.section || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={x.courseState === 'ACTIVE' ? 'Đang mở' : x.courseState}
                          size="small"
                          sx={{
                            bgcolor: x.courseState === 'ACTIVE' ? '#ecfdf5' : '#f1f5f9',
                            color: x.courseState === 'ACTIVE' ? '#059669' : '#64748b',
                            border: x.courseState === 'ACTIVE' ? '1px solid #a7f3d0' : '1px solid #e2e8f0',
                            fontWeight: 600,
                            fontSize: '0.75rem',
                            height: 22
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {isMapped ? (
                          <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: '13px !important' }} />}
                            label={x.className || x.classId}
                            size="small"
                            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                          />
                        ) : (
                          <Chip
                            label="Chưa mapping"
                            size="small"
                            sx={{ bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 600, fontSize: '0.75rem', height: 22 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} sx={{ color: '#0f172a' }}>
                          {x.roster?.students ?? '—'} HS
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {subRate !== null ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ flex: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.min(subRate, 100)}
                                sx={{
                                  height: 6,
                                  borderRadius: 3,
                                  bgcolor: '#f1f5f9',
                                  '& .MuiLinearProgress-bar': { bgcolor: subRate >= 90 ? '#10b981' : '#2563eb' }
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={600} sx={{ minWidth: 35, color: '#0f172a' }}>
                              {subRate}%
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Chưa có bài tập
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                          onClick={() => openMapDialog(x)}
                          sx={{ fontSize: '0.75rem', py: 0.4, px: 1.2, borderRadius: '6px', fontWeight: 600, textTransform: 'none' }}
                        >
                          {isMapped ? 'Sửa map' : 'Mapping'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* Mapping Dialog */}
      <Dialog
        open={Boolean(mapTarget)}
        onClose={() => setMapTarget(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
          Mapping Khóa Học Với Lớp Hành Chính
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          {mapTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Khóa học: <strong style={{ color: '#0f172a' }}>{mapTarget.name}</strong>
              </Typography>
              <TextField
                label="Mã Lớp (Class ID)"
                placeholder="Ví dụ: 9A1, 8A2, 7A3..."
                fullWidth
                size="small"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              />
              <TextField
                label="Tên Lớp hiển thị"
                placeholder="Ví dụ: Lớp 9A1, Lớp 8A2..."
                fullWidth
                size="small"
                value={className}
                onChange={(e) => setClassName(e.target.value)}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          <Button onClick={() => setMapTarget(null)} sx={{ textTransform: 'none', color: '#64748b' }}>Hủy</Button>
          <Button
            variant="contained"
            onClick={handleSaveMapping}
            sx={{
              bgcolor: '#2563eb',
              color: '#ffffff',
              '&:hover': { bgcolor: '#1d4ed8' },
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
            }}
          >
            Lưu Mapping
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog Thông báo kết quả đồng bộ Google Classroom */}
      <Dialog
        open={syncDialog.open}
        onClose={() => setSyncDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a' }}>
          {syncDialog.title}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line', color: '#334155' }}>
            {syncDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e2e8f0' }}>
          {syncDialog.isError && (
            <Button
              variant="contained"
              onClick={() => {
                setSyncDialog((prev) => ({ ...prev, open: false }));
                navigate('/connections');
              }}
              sx={{
                bgcolor: '#2563eb',
                color: '#ffffff',
                '&:hover': { bgcolor: '#1d4ed8' },
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: '8px',
                boxShadow: '0 2px 6px rgba(37, 99, 235, 0.2)'
              }}
            >
              Mở trang Quản Lý Kết Nối
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => setSyncDialog((prev) => ({ ...prev, open: false }))}
            sx={{ textTransform: 'none', fontWeight: 500, borderRadius: '8px' }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}