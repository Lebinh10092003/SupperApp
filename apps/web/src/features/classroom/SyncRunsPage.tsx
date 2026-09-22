import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Pagination,
  Skeleton,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  Grid
} from '@mui/material';
import HistoryIcon from '@mui/icons-material/HistoryRounded';
import VisibilityIcon from '@mui/icons-material/VisibilityRounded';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweepRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import CloudDoneIcon from '@mui/icons-material/CloudDoneRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import GroupIcon from '@mui/icons-material/GroupRounded';
import MenuBookIcon from '@mui/icons-material/MenuBookRounded';
import AssignmentIcon from '@mui/icons-material/AssignmentRounded';
import ArrowForwardIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export interface SyncRunItem {
  id: string;
  type: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | string;
  performedBy: string | null;
  startedAt: string;
  finishedAt: string | null;
  coursesTotal: number;
  coursesSuccess: number;
  coursesError: number;
  errors: Array<{ courseId?: string; error: string }>;
  coursesCount: number;
  note?: string | null;
}

export interface CourseDetailItem {
  id: string;
  name: string;
  section?: string | null;
  room?: string | null;
  className?: string | null;
  grade?: number | null;
  subjectName?: string | null;
  rosterTeachers?: number;
  rosterStudents?: number;
  contentCoursework?: number;
  submissionsTotal?: number;
  lastSyncAt?: string | null;
}

export default function SyncRunsPage() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<SyncRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Dialog Courses in Run
  const [selectedRun, setSelectedRun] = useState<SyncRunItem | null>(null);
  const [coursesInRun, setCoursesInRun] = useState<CourseDetailItem[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [openCoursesDialog, setOpenCoursesDialog] = useState(false);

  // Dialog Rollback
  const [rollbackRun, setRollbackRun] = useState<SyncRunItem | null>(null);
  const [openRollbackDialog, setOpenRollbackDialog] = useState(false);
  const [rollbackSubmitting, setRollbackSubmitting] = useState(false);
  const [rollbackError, setRollbackError] = useState('');

  // Toast
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const loadSyncRuns = async () => {
    setLoading(true);
    try {
      const res = await api<{ total: number; items: SyncRunItem[] }>('/api/classroom/sync-runs');
      setRuns(res.items || []);
    } catch (err: any) {
      setToast({ message: `Không thể tải danh sách phiên đồng bộ: ${err.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSyncRuns();
  }, []);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        (r.performedBy && r.performedBy.toLowerCase().includes(q)) ||
        r.status.toLowerCase().includes(q)
    );
  }, [runs, search]);

  const pagedRuns = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRuns.slice(start, start + rowsPerPage);
  }, [filteredRuns, page]);

  const totalPages = Math.ceil(filteredRuns.length / rowsPerPage) || 1;

  // View Courses in Run
  const handleViewCourses = async (run: SyncRunItem) => {
    setSelectedRun(run);
    setOpenCoursesDialog(true);
    setLoadingCourses(true);
    try {
      const res = await api<{ total: number; items: CourseDetailItem[] }>(`/api/classroom/sync-runs/${encodeURIComponent(run.id)}/courses`);
      setCoursesInRun(res.items || []);
    } catch (err: any) {
      setToast({ message: `Lỗi khi tải khoá học: ${err.message}`, severity: 'error' });
      setCoursesInRun([]);
    } finally {
      setLoadingCourses(false);
    }
  };

  // Open Rollback Confirm
  const handleOpenRollback = (run: SyncRunItem) => {
    setRollbackRun(run);
    setRollbackError('');
    setOpenRollbackDialog(true);
  };

  // Submit Rollback
  const handleRollbackSubmit = async () => {
    if (!rollbackRun) return;
    setRollbackSubmitting(true);
    setRollbackError('');

    try {
      const res = await api.delete<{ ok: boolean; message: string; coursesDeleted: number; classesRebuilt: number }>(
        `/api/classroom/sync-runs/${encodeURIComponent(rollbackRun.id)}`
      );

      setToast({
        message: res.message || `Đã rollback phiên đồng bộ "${rollbackRun.id}" thành công!`,
        severity: 'success'
      });
      setOpenRollbackDialog(false);
      loadSyncRuns();
    } catch (err: any) {
      setRollbackError(err.message || 'Lỗi khi rollback phiên đồng bộ.');
    } finally {
      setRollbackSubmitting(false);
    }
  };

  // Format date helper
  const formatDate = (isoStr?: string | null) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return isoStr;
    }
  };

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return (
          <Chip
            icon={<CloudDoneIcon sx={{ fontSize: '14px !important' }} />}
            label="Hoàn thành"
            size="small"
            sx={{ bgcolor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, borderRadius: 1.5 }}
          />
        );
      case 'IN_PROGRESS':
        return (
          <Chip
            icon={<CloudSyncIcon sx={{ fontSize: '14px !important' }} />}
            label="Đang đồng bộ"
            size="small"
            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontWeight: 700, borderRadius: 1.5 }}
          />
        );
      case 'PARTIAL':
        return (
          <Chip
            icon={<WarningAmberIcon sx={{ fontSize: '14px !important' }} />}
            label="Một phần lỗi"
            size="small"
            sx={{ bgcolor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700, borderRadius: 1.5 }}
          />
        );
      case 'FAILED':
        return (
          <Chip
            label="Thất bại"
            size="small"
            sx={{ bgcolor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700, borderRadius: 1.5 }}
          />
        );
      default:
        return (
          <Chip
            label={status}
            size="small"
            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, borderRadius: 1.5 }}
          />
        );
    }
  };

  // KPIs
  const totalSyncs = runs.length;
  const activeCoursesFromSync = runs.reduce((acc, r) => acc + (r.coursesCount || 0), 0);
  const latestRun = runs[0];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Quản lý Phiên Đồng bộ Google Classroom"
        subtitle="Lịch sử các phiên đồng bộ dữ liệu từ Google Classroom, xem chi tiết khoá học theo phiên và hỗ trợ rollback dữ liệu an toàn."
        action={
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Làm mới danh sách">
              <IconButton onClick={loadSyncRuns} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              onClick={() => navigate('/classroom')}
              sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 600, color: '#334155', borderColor: '#cbd5e1' }}
            >
              Xem Khoá học
            </Button>
            <Button
              variant="contained"
              onClick={() => navigate('/connections')}
              startIcon={<CloudSyncIcon />}
              sx={{
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
                textTransform: 'none',
                borderRadius: 2,
                fontWeight: 600,
                px: 2.5
              }}
            >
              Đồng bộ dữ liệu
            </Button>
          </Stack>
        }
      />

      {/* Thống kê nhanh KPI */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Tổng phiên đồng bộ
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#0f172a', mt: 0.5 }}>
              {totalSyncs}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
              Lần quét & import từ trước tới nay
            </Typography>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Khoá học đang lưu vết
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#2563eb', mt: 0.5 }}>
              {activeCoursesFromSync}
            </Typography>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 0.5 }}>
              Thuộc các phiên đồng bộ hiện hành
            </Typography>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Phiên gần nhất
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#0f172a', mt: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {latestRun ? formatDate(latestRun.startedAt) : 'Chưa có'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
              {latestRun?.performedBy || 'Chưa thực hiện'}
            </Typography>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
              Trạng thái gần nhất
            </Typography>
            <Box sx={{ mt: 1 }}>{latestRun ? getStatusChip(latestRun.status) : '—'}</Box>
            <Typography variant="body2" sx={{ color: '#94a3b8', mt: 1 }}>
              {latestRun ? `${latestRun.coursesSuccess}/${latestRun.coursesTotal} khoá thành công` : 'Sẵn sàng'}
            </Typography>
          </Card>
        </Grid>
      </Grid>

      {/* Tìm kiếm */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <TextField
          size="small"
          placeholder="Tìm theo mã phiên, người thực hiện hoặc trạng thái..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
              </InputAdornment>
            )
          }}
          sx={{ maxWidth: 450, width: '100%' }}
        />
      </Card>

      {/* Bảng danh sách phiên đồng bộ */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Mã Phiên Đồng bộ</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Thời gian thực hiện</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Người thực hiện</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Khoá học của phiên</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Trạng thái</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={6} sx={{ py: 2 }}>
                      <Skeleton variant="text" width="100%" height={28} />
                    </TableCell>
                  </TableRow>
                ))
              ) : pagedRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                    <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: '#f1f5f9', mb: 1.5 }}>
                      <HistoryIcon sx={{ fontSize: 36, color: '#94a3b8' }} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#334155' }}>
                      Chưa có phiên đồng bộ nào
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5, mb: 2 }}>
                      Thực hiện đồng bộ dữ liệu từ Google Classroom để xem lịch sử tại đây.
                    </Typography>
                    <Button
                      variant="outlined"
                      startIcon={<CloudSyncIcon />}
                      onClick={() => navigate('/connections')}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Đi tới Kết nối & Đồng bộ
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRuns.map((run) => {
                  const hasActiveCourses = run.coursesCount > 0;
                  return (
                    <TableRow key={run.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                      {/* Mã phiên */}
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 2,
                              bgcolor: '#eff6ff',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <HistoryIcon fontSize="small" />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {run.id}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Loại: {run.type}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      {/* Thời gian */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          Bắt đầu: {formatDate(run.startedAt)}
                        </Typography>
                        {run.finishedAt && (
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            Xong: {formatDate(run.finishedAt)}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Người thực hiện */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {run.performedBy || 'Hệ thống'}
                        </Typography>
                      </TableCell>

                      {/* Số khoá học */}
                      <TableCell>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <MenuBookIcon sx={{ fontSize: 16, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ fontWeight: 700, color: hasActiveCourses ? '#2563eb' : '#64748b' }}>
                            {run.coursesCount} khoá học
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            (Quét: {run.coursesTotal})
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Trạng thái */}
                      <TableCell>{getStatusChip(run.status)}</TableCell>

                      {/* Thao tác */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleViewCourses(run)}
                            disabled={!hasActiveCourses}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 1.5,
                              borderColor: '#e2e8f0',
                              color: '#334155',
                              '&:hover': { bgcolor: '#f8fafc', borderColor: '#cbd5e1' }
                            }}
                          >
                            Xem khoá học
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            color="error"
                            startIcon={<DeleteSweepIcon />}
                            onClick={() => handleOpenRollback(run)}
                            sx={{
                              textTransform: 'none',
                              borderRadius: 1.5,
                              boxShadow: 'none',
                              '&:hover': { bgcolor: '#dc2626' }
                            }}
                          >
                            Rollback
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredRuns.length > rowsPerPage && (
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: '1px solid #e2e8f0' }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, val) => setPage(val)}
              color="primary"
              shape="rounded"
            />
          </Box>
        )}
      </Card>

      {/* DIALOG: Danh sách khoá học thuộc phiên */}
      <Dialog open={openCoursesDialog} onClose={() => setOpenCoursesDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#0f172a' }}>
          Khoá học thuộc phiên {selectedRun?.id}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {loadingCourses ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <CircularProgress size={32} />
              <Typography variant="body2" sx={{ color: '#64748b', mt: 1 }}>
                Đang tải danh sách khoá học...
              </Typography>
            </Box>
          ) : coursesInRun.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                Không có khoá học nào thuộc phiên này (hoặc đã bị rollback).
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 440 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Tên Khoá học</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Lớp & Khối</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Môn học</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Sĩ số / GV</TableCell>
                    <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Bài tập</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {coursesInRun.map((course) => (
                    <TableRow key={course.id} hover>
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {course.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          ID: {course.id} {course.room ? `• Phòng: ${course.room}` : ''}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {course.className ? (
                          <Chip
                            icon={<SchoolIcon sx={{ fontSize: '14px !important' }} />}
                            label={course.className}
                            size="small"
                            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, borderRadius: 1.5 }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Chưa phân lớp
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#334155' }}>
                          {course.subjectName || 'Chưa phân môn'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <GroupIcon sx={{ fontSize: 15, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {course.rosterStudents || 0} HS
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {course.rosterTeachers || 0} giáo viên
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <AssignmentIcon sx={{ fontSize: 15, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ color: '#1e293b' }}>
                            {course.contentCoursework || 0} bài tập
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenCoursesDialog(false)} sx={{ textTransform: 'none' }}>
            Đóng
          </Button>
          <Button
            variant="contained"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              setOpenCoursesDialog(false);
              navigate('/classroom');
            }}
            sx={{ textTransform: 'none', bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            Quản lý Khoá học
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Xác nhận Rollback phiên */}
      <Dialog open={openRollbackDialog} onClose={() => !rollbackSubmitting && setOpenRollbackDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="error" />
          Xác nhận Rollback phiên {rollbackRun?.id}
        </DialogTitle>
        <DialogContent dividers>
          {rollbackError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {rollbackError}
            </Alert>
          )}
          <Typography variant="body1" sx={{ color: '#0f172a', fontWeight: 600, mb: 1 }}>
            Bạn có chắc chắn muốn rollback toàn bộ dữ liệu của phiên đồng bộ này?
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2 }}>
            Hành động này sẽ thực hiện các thao tác sau:
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0, color: '#475569', fontSize: '0.875rem', '& li': { mb: 0.5 } }}>
            <li>
              Xoá toàn bộ <strong>{rollbackRun?.coursesCount || 0} khoá học</strong> được import trong phiên này.
            </li>
            <li>Xoá dữ liệu con cascade: bài tập, tài liệu, thông báo, bài nộp, thành viên của các khoá học.</li>
            <li>Tự động tổng hợp và tính toán lại danh sách lớp học và các chỉ số thống kê trường học.</li>
            <li>Lớp học tạo thủ công và thời khoá biểu đã xếp sẽ được bảo toàn nguyên vẹn.</li>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenRollbackDialog(false)} disabled={rollbackSubmitting} sx={{ textTransform: 'none' }}>
            Huỷ bỏ
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleRollbackSubmit}
            disabled={rollbackSubmitting}
            sx={{ textTransform: 'none', px: 2.5 }}
          >
            {rollbackSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Xác nhận Rollback'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert onClose={() => setToast(null)} severity={toast.severity} sx={{ width: '100%', boxShadow: 3 }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
}
