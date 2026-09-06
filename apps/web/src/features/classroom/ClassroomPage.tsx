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
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tổng khóa học Classroom
              </Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090b', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.75rem' }}>
                Đồng bộ tự động từ Google Workspace
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ Mapping lớp hành chính
              </Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090b', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length ? Math.round((mappedCount / items.length) * 100) : 0}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.75rem' }}>
                {mappedCount}/{items.length} khóa học đã xác định lớp
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ nộp bài trung bình
              </Typography>
              <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, color: '#09090b', my: 0.5, letterSpacing: '-0.025em' }}>
                {avgSubmissionRate}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#71717a', fontSize: '0.75rem' }}>
                {items.length ? 'Dựa trên bài tập đã giao trong học kỳ' : 'Chưa có dữ liệu bài tập'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Unified DataTable Block */}
      <Card sx={{ borderRadius: '8px', border: '1px solid #e4e4e7', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)', overflow: 'hidden', bgcolor: '#ffffff' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderBottom: '1px solid #e4e4e7', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Tìm theo tên khóa học, mã lớp, học kỳ..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            sx={{ width: { xs: '100%', sm: 340 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: '#a1a1aa' }} />
                </InputAdornment>
              )
            }}
          />
          <Chip
            label={`Hiển thị ${filtered.length} / ${items.length} khóa học`}
            size="small"
            sx={{
              height: 24,
              fontSize: '0.75rem',
              fontWeight: 500,
              bgcolor: '#f4f4f5',
              color: '#71717a',
              border: '1px solid #e4e4e7'
            }}
          />
        </Box>

        {items.length === 0 && !loading ? (
          <Box sx={{ p: 6, textAlign: 'center', bgcolor: '#fafafa', borderTop: '1px solid #e4e4e7' }}>
            <Box sx={{ fontSize: 36, mb: 1.5 }}>🏫</Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#09090b', mb: 0.5 }}>
              Chưa có khóa học nào được đồng bộ từ Google Classroom
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 580, mx: 'auto', mb: 3 }}>
              Hệ thống THCS Giảng Võ tuân thủ nguyên tắc 100% dữ liệu thực tế từ Google Classroom API chính thức, tuyệt đối không dùng dữ liệu giả lập. Vui lòng kết nối tài khoản Google để nạp toàn bộ danh sách lớp học và bài nộp thực tế.
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/connections')}
                sx={{ bgcolor: '#18181b', color: '#ffffff', '&:hover': { bgcolor: '#27272a' }, fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none' }}
              >
                Kết nối Google Classroom (Chế độ A / B)
              </Button>
              <Button
                variant="outlined"
                startIcon={syncing ? <CircularProgress size={16} /> : <SyncIcon sx={{ fontSize: 16 }} />}
                onClick={handleSync}
                disabled={syncing}
                sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none' }}
              >
                Thử đồng bộ ngay
              </Button>
            </Stack>
          </Box>
        ) : (
          <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="medium">
              <TableHead sx={{ bgcolor: '#fcfcfd' }}>
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
                    <TableRow key={x.id} hover sx={{ '&:hover': { bgcolor: '#f4f4f5' } }}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#09090b' }}>
                          {x.name}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: '#71717a' }}>{x.section || '—'}</TableCell>
                      <TableCell>
                        <Chip
                          label={x.courseState === 'ACTIVE' ? 'Đang mở' : x.courseState}
                          size="small"
                          sx={{
                            bgcolor: x.courseState === 'ACTIVE' ? '#ecfdf5' : '#f4f4f5',
                            color: x.courseState === 'ACTIVE' ? '#059669' : '#71717a',
                            border: x.courseState === 'ACTIVE' ? '1px solid #a7f3d0' : '1px solid #e4e4e7',
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
                        <Typography variant="body2" fontWeight={500} sx={{ color: '#09090b' }}>
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
                                  bgcolor: '#e4e4e7',
                                  '& .MuiLinearProgress-bar': { bgcolor: subRate >= 90 ? '#10b981' : '#f59e0b' }
                                }}
                              />
                            </Box>
                            <Typography variant="caption" fontWeight={600} sx={{ minWidth: 35, color: '#09090b' }}>
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
                          sx={{ fontSize: '0.75rem', py: 0.4, px: 1.2, borderRadius: '6px', fontWeight: 500, textTransform: 'none' }}
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
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
          Mapping Khóa Học Với Lớp Hành Chính
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e4e4e7' }}>
          {mapTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Khóa học: <strong style={{ color: '#09090b' }}>{mapTarget.name}</strong>
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
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e4e7' }}>
          <Button onClick={() => setMapTarget(null)} sx={{ textTransform: 'none', color: '#71717a' }}>Hủy</Button>
          <Button variant="contained" onClick={handleSaveMapping} sx={{ bgcolor: '#18181b', color: '#ffffff', '&:hover': { bgcolor: '#27272a' }, textTransform: 'none', fontWeight: 600 }}>
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
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem' }}>
          {syncDialog.title}
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e4e4e7' }}>
          <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-line', color: '#3f3f46' }}>
            {syncDialog.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e4e4e7' }}>
          {syncDialog.isError && (
            <Button
              variant="contained"
              onClick={() => {
                setSyncDialog((prev) => ({ ...prev, open: false }));
                navigate('/connections');
              }}
              sx={{ bgcolor: '#18181b', color: '#ffffff', '&:hover': { bgcolor: '#27272a' }, textTransform: 'none', fontWeight: 600 }}
            >
              Mở trang Quản Lý Kết Nối
            </Button>
          )}
          <Button
            variant="outlined"
            onClick={() => setSyncDialog((prev) => ({ ...prev, open: false }))}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}