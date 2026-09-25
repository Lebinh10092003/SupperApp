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
  CircularProgress,
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Switch
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/SearchRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import LinkIcon from '@mui/icons-material/LinkRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import SyncIcon from '@mui/icons-material/SyncRounded';
import DeleteIcon from '@mui/icons-material/DeleteRounded';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import OpenInNewIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import TableChartIcon from '@mui/icons-material/TableChartRounded';
import DescriptionIcon from '@mui/icons-material/DescriptionRounded';
import ScheduleIcon from '@mui/icons-material/ScheduleRounded';
import CampaignIcon from '@mui/icons-material/CampaignRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { PageHeader } from '../../components/PageHeader';
import { api, download } from '../../services/api';

export default function ClassroomPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [mapTarget, setMapTarget] = useState<any>(null);
  const [classId, setClassId] = useState('');
  const [className, setClassName] = useState('');
  const [toast, setToast] = useState<{ text: string; severity: 'success' | 'info' | 'warning' | 'error' } | null>(null);
  const [syncingQuick, setSyncingQuick] = useState(false);

  // Chọn dòng trên bảng (Batch selection)
  const [selectedTableIds, setSelectedTableIds] = useState<Set<string>>(new Set());

  // Dialog Xóa 1 khóa học
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteAddToIgnore, setDeleteAddToIgnore] = useState(true);
  const [deleting, setDeleting] = useState(false);

  // Dialog Xóa hàng loạt
  const [openBatchDeleteDialog, setOpenBatchDeleteDialog] = useState(false);
  const [batchDeleteAddToIgnore, setBatchDeleteAddToIgnore] = useState(true);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Dialog Duyệt & Đồng bộ Google Classroom (Selective Sync Preview)
  const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [previewCounts, setPreviewCounts] = useState({ total: 0, syncedCount: 0, newCount: 0, ignoredCount: 0 });
  const [previewSelectedIds, setPreviewSelectedIds] = useState<Set<string>>(new Set());
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'NEW' | 'SYNCED' | 'IGNORED'>('NEW');
  const [previewSearch, setPreviewSearch] = useState('');
  const [previewAutoIgnoreUnselected, setPreviewAutoIgnoreUnselected] = useState(false);
  const [executingSync, setExecutingSync] = useState(false);

  // Báo cáo & Lọc Năm học / Học kỳ
  const [academicYear, setAcademicYear] = useState('ALL');
  const [semester, setSemester] = useState('ALL');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingWord, setExportingWord] = useState(false);

  // Lịch tự động đồng bộ (Auto-Sync Dialog)
  const [openScheduleDialog, setOpenScheduleDialog] = useState(false);
  const [scheduleConfig, setScheduleConfig] = useState<any>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [triggeringSchedule, setTriggeringSchedule] = useState(false);

  // Đôn đốc GVCN / Bộ môn
  const [nudgeTarget, setNudgeTarget] = useState<any>(null);
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [nudgeCopied, setNudgeCopied] = useState(false);
  const [nudgeSending, setNudgeSending] = useState(false);

  const handleDownloadExcel = async () => {
    setExportingExcel(true);
    try {
      await download('/api/reports/classroom.xlsx', 'Bao-Cao-Khoa-Hoc-Google-Classroom.xlsx');
      setToast({ text: 'Đã xuất sổ khóa học Excel (.xlsx) thành công!', severity: 'success' });
    } catch (err: any) {
      setToast({ text: `Lỗi xuất Excel: ${err.message}`, severity: 'error' });
    } finally {
      setExportingExcel(false);
    }
  };

  const handleDownloadWord = async () => {
    setExportingWord(true);
    try {
      await download('/api/reports/nd30-summary.docx', 'Bao-Cao-Lop-Hoc-So-Chuan-ND30.docx');
      setToast({ text: 'Đã xuất báo cáo Word chuẩn Nghị định 30/2020/NĐ-CP thành công!', severity: 'success' });
    } catch (err: any) {
      setToast({ text: `Lỗi xuất Word: ${err.message}`, severity: 'error' });
    } finally {
      setExportingWord(false);
    }
  };

  const handleOpenSchedule = async () => {
    setOpenScheduleDialog(true);
    setScheduleLoading(true);
    try {
      const res = await api<any>('/api/classroom/auto-sync');
      if (res?.ok && res.config) {
        setScheduleConfig(res.config);
      }
    } catch (err: any) {
      setToast({ text: `Không thể nạp lịch đồng bộ: ${err.message}`, severity: 'error' });
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!scheduleConfig) return;
    setScheduleSaving(true);
    try {
      const res = await api.post<any>('/api/classroom/auto-sync', scheduleConfig);
      if (res?.ok && res.config) {
        setScheduleConfig(res.config);
      }
      setToast({ text: 'Đã lưu lịch tự động đồng bộ Google Classroom!', severity: 'success' });
      setOpenScheduleDialog(false);
    } catch (err: any) {
      setToast({ text: `Lỗi lưu lịch: ${err.message}`, severity: 'error' });
    } finally {
      setScheduleSaving(false);
    }
  };

  const handleTriggerScheduleNow = async () => {
    setTriggeringSchedule(true);
    try {
      const res = await api.post<any>('/api/classroom/auto-sync/trigger');
      setToast({ text: res.message || 'Đã kích hoạt đồng bộ nền thành công!', severity: 'success' });
      load();
      const updated = await api<any>('/api/classroom/auto-sync');
      if (updated?.config) setScheduleConfig(updated.config);
    } catch (err: any) {
      setToast({ text: `Lỗi kích hoạt: ${err.message}`, severity: 'error' });
    } finally {
      setTriggeringSchedule(false);
    }
  };

  const handleOpenNudge = (course: any) => {
    setNudgeTarget(course);
    const rawSubRate = course.completionRate ?? course.content?.completionRate ?? course.content?.submissionRate;
    const subRate = rawSubRate != null && rawSubRate !== '' && !isNaN(Number(rawSubRate)) ? Number(rawSubRate) : 0;
    const className = course.className || course.classId || 'Chưa định danh';
    const msg = `[THCS GIẢNG VÕ - ĐÔN ĐỐC NỘP BÀI TẬP GOOGLE CLASSROOM]
Kính gửi Thầy/Cô phụ trách khóa học ${course.name} và GVCN ${className ? `Lớp ${className}` : ''},

Khóa học: ${course.name}
Tiến độ nộp bài hiện tại: ${subRate}% (Ngưỡng yêu cầu: ≥ 70%)
Sĩ số học sinh: ${course.rosterStudents ?? course.roster?.students ?? '—'} HS

Đề nghị Thầy/Cô bộ môn phối hợp cùng GVCN rà soát danh sách học sinh chưa nộp bài hoặc nộp bài muộn, thông báo tới phụ huynh và đôn đốc các em hoàn thiện bài tập trên Google Classroom trước thời hạn quy định.

Trân trọng cảm ơn Thầy/Cô!`;
    setNudgeMessage(msg);
    setNudgeCopied(false);
  };

  const handleCopyNudge = () => {
    if (!nudgeMessage) return;
    navigator.clipboard.writeText(nudgeMessage);
    setNudgeCopied(true);
    setTimeout(() => setNudgeCopied(false), 2000);
  };

  const handleSendNudge = async () => {
    if (!nudgeTarget) return;
    setNudgeSending(true);
    try {
      await api.post(`/api/alerts/alert_low_sub_${nudgeTarget.id}/notify-homeroom`, {
        customMessage: nudgeMessage
      }).catch(async () => {
        if (nudgeTarget.classId) {
          await api.post('/api/classes/nudge', { classId: nudgeTarget.classId });
        }
      });
      setToast({ text: `Đã phát thông báo đôn đốc thành công cho ${nudgeTarget.name}!`, severity: 'success' });
      setNudgeTarget(null);
    } catch (err: any) {
      setToast({ text: `Lỗi gửi đôn đốc: ${err.message}`, severity: 'error' });
    } finally {
      setNudgeSending(false);
    }
  };

  const load = () => {
    setLoading(true);
    api<{ items: any[] }>('/api/classroom')
      .then((x) => {
        setItems(x.items || []);
        setSelectedTableIds(new Set());
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  // Mở Dialog Duyệt & Đồng bộ
  const handleOpenPreview = async () => {
    setOpenPreviewDialog(true);
    setPreviewLoading(true);
    setPreviewError('');
    setPreviewSearch('');
    setPreviewFilter('NEW');
    try {
      const res = await api.post<any>('/api/classroom/preview');
      const list = res.items || [];
      setPreviewItems(list);
      setPreviewCounts({
        total: res.total || list.length,
        syncedCount: res.syncedCount || 0,
        newCount: res.newCount || 0,
        ignoredCount: res.ignoredCount || 0
      });

      // Mặc định chọn tất cả các khóa học mới chưa đồng bộ
      const newIds = list.filter((x: any) => !x.isAlreadySynced && !x.isIgnored).map((x: any) => x.id);
      setPreviewSelectedIds(new Set(newIds));
    } catch (err: any) {
      setPreviewError(err.message || 'Chưa thể kết nối Google Classroom để quét danh sách.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Xác nhận đồng bộ các lớp đã duyệt
  const handleExecuteSelectiveSync = async () => {
    if (previewSelectedIds.size === 0) return;
    setExecutingSync(true);
    try {
      const selectedCourseIds = Array.from(previewSelectedIds);
      let ignoredCourseIds: string[] | undefined;
      if (previewAutoIgnoreUnselected) {
        ignoredCourseIds = previewItems
          .filter((x) => !previewSelectedIds.has(x.id))
          .map((x) => x.id);
      }

      const res = await api.post<any>('/api/classroom/sync', {
        selectedCourseIds,
        ignoredCourseIds
      });

      setToast({
        text: res.message || `Đã đồng bộ thành công ${res.success || selectedCourseIds.length} khóa học Google Classroom đã duyệt!`,
        severity: 'success'
      });
      setOpenPreviewDialog(false);
      load();
    } catch (err: any) {
      setToast({
        text: `Lỗi đồng bộ: ${err.message || 'Không thể đồng bộ các khóa học đã chọn.'}`,
        severity: 'error'
      });
    } finally {
      setExecutingSync(false);
    }
  };

  // Đồng bộ nhanh tất cả
  const handleQuickSync = async () => {
    setSyncingQuick(true);
    try {
      const res = await api.post<any>('/api/classroom/sync');
      setToast({
        text: res.message || `Đã hoàn tất đồng bộ ${res.success || 0} khóa học!`,
        severity: 'success'
      });
      load();
    } catch (err: any) {
      setToast({
        text: `Lỗi đồng bộ: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setSyncingQuick(false);
    }
  };

  // Xóa 1 khóa học
  const handleDeleteCourse = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/classroom/courses/${encodeURIComponent(deleteTarget.id)}?addToIgnore=${deleteAddToIgnore}`);
      setToast({
        text: `Đã xóa khóa học "${deleteTarget.name}" khỏi hệ thống thành công.${deleteAddToIgnore ? ' (Đã đưa vào danh sách bỏ qua)' : ''}`,
        severity: 'success'
      });
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      setToast({
        text: `Lỗi xóa khóa học: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setDeleting(false);
    }
  };

  // Xóa hàng loạt khóa học
  const handleBatchDelete = async () => {
    if (selectedTableIds.size === 0) return;
    setBatchDeleting(true);
    try {
      const ids = Array.from(selectedTableIds);
      const res = await api.post<any>('/api/classroom/courses/batch-delete', {
        courseIds: ids,
        addToIgnore: batchDeleteAddToIgnore
      });
      setToast({
        text: res.message || `Đã xóa ${res.count || ids.length} khóa học thành công!`,
        severity: 'success'
      });
      setOpenBatchDeleteDialog(false);
      setSelectedTableIds(new Set());
      load();
    } catch (err: any) {
      setToast({
        text: `Lỗi xóa hàng loạt: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setBatchDeleting(false);
    }
  };

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
      setToast({
        text: `Đã mapping thành công khóa học vào ${className || classId}!`,
        severity: 'success'
      });
      setMapTarget(null);
      load();
    } catch (e: any) {
      setToast({
        text: `Lỗi mapping: ${e.message}`,
        severity: 'error'
      });
    }
  };

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return items.filter((x) => {
      const matchQ =
        !query ||
        String(x.name || '').toLowerCase().includes(query) ||
        String(x.className || '').toLowerCase().includes(query) ||
        String(x.section || '').toLowerCase().includes(query);
      if (!matchQ) return false;

      if (academicYear !== 'ALL') {
        const text = `${x.academicYear || ''} ${x.section || ''} ${x.name || ''}`;
        if (!text.includes(academicYear)) return false;
      }

      if (semester !== 'ALL') {
        const sem = `${x.term || ''} ${x.section || ''} ${x.name || ''}`.toLowerCase();
        if (semester === 'HK1' && !sem.includes('hk1') && !sem.includes('kỳ 1') && !sem.includes('ky 1') && !sem.includes('học kỳ 1')) return false;
        if (semester === 'HK2' && !sem.includes('hk2') && !sem.includes('kỳ 2') && !sem.includes('ky 2') && !sem.includes('học kỳ 2')) return false;
      }

      return true;
    });
  }, [items, q, academicYear, semester]);

  // Bộ lọc cho danh sách duyệt preview
  const filteredPreviewItems = useMemo(() => {
    const sq = previewSearch.toLowerCase().trim();
    return previewItems.filter((x) => {
      if (previewFilter === 'NEW' && (x.isAlreadySynced || x.isIgnored)) return false;
      if (previewFilter === 'SYNCED' && !x.isAlreadySynced) return false;
      if (previewFilter === 'IGNORED' && !x.isIgnored) return false;

      if (!sq) return true;
      return (
        String(x.name || '').toLowerCase().includes(sq) ||
        String(x.className || '').toLowerCase().includes(sq) ||
        String(x.subjectName || '').toLowerCase().includes(sq) ||
        String(x.section || '').toLowerCase().includes(sq)
      );
    });
  }, [previewItems, previewFilter, previewSearch]);

  const mappedCount = items.filter((x) => x.className || x.classId).length;

  const avgSubmissionRate = useMemo(() => {
    const withRates = items
      .map((x) => {
        const raw = x.completionRate ?? x.content?.completionRate ?? x.content?.submissionRate;
        return raw != null && raw !== '' && !isNaN(Number(raw)) ? Number(raw) : null;
      })
      .filter((r): r is number => r !== null);
    if (withRates.length === 0) return 0;
    const sum = withRates.reduce((acc, curr) => acc + curr, 0);
    return Math.round(sum / withRates.length);
  }, [items]);

  const isAllTableSelected = filtered.length > 0 && filtered.every((x) => selectedTableIds.has(x.id));

  const toggleSelectAllTable = () => {
    if (isAllTableSelected) {
      setSelectedTableIds(new Set());
    } else {
      setSelectedTableIds(new Set(filtered.map((x) => x.id)));
    }
  };

  const toggleSelectTableRow = (id: string) => {
    const next = new Set(selectedTableIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTableIds(next);
  };

  return (
    <>
      <PageHeader
        title="Khóa học Bộ môn (Google Classroom)"
        icon={<SchoolIcon />}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              color="inherit"
              startIcon={exportingExcel ? <CircularProgress size={16} /> : <TableChartIcon sx={{ color: '#059669' }} />}
              onClick={handleDownloadExcel}
              disabled={exportingExcel}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              {exportingExcel ? 'Đang xuất...' : 'Xuất Excel'}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={exportingWord ? <CircularProgress size={16} /> : <DescriptionIcon sx={{ color: '#dc2626' }} />}
              onClick={handleDownloadWord}
              disabled={exportingWord}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              {exportingWord ? 'Đang xuất...' : 'Báo cáo Word NĐ30'}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ScheduleIcon sx={{ color: '#4f46e5' }} />}
              onClick={handleOpenSchedule}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Lịch Tự Động
            </Button>
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlaylistAddCheckIcon />}
              onClick={handleOpenPreview}
              sx={{ fontWeight: 700, borderRadius: 2, px: 2.5 }}
            >
              Duyệt & Đồng bộ Lớp học
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={syncingQuick ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
              onClick={handleQuickSync}
              disabled={syncingQuick}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              {syncingQuick ? 'Đang đồng bộ...' : 'Đồng bộ nhanh'}
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LinkIcon />}
              onClick={() => navigate('/connections')}
              sx={{ fontWeight: 600, borderRadius: 2 }}
            >
              Cấu hình Google Workspace
            </Button>
          </Stack>
        }
      />

      {toast && (
        <Alert
          severity={toast.severity}
          onClose={() => setToast(null)}
          sx={{ mb: 2.5, borderRadius: 2, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}
        >
          {toast.text}
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tổng khóa học đã đồng bộ
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#0f172a', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length}
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                Khóa học Google Classroom thực tế đang hoạt động
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ Mapping vào Lớp hành chính
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#2563eb', my: 0.5, letterSpacing: '-0.025em' }}>
                {items.length ? Math.round((mappedCount / items.length) * 100) : 0}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {mappedCount}/{items.length} khóa học đã liên kết lớp hành chính
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 4 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', bgcolor: '#ffffff' }}>
            <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Tỷ lệ nộp bài trung bình
              </Typography>
              <Typography sx={{ fontSize: '1.875rem', fontWeight: 700, color: '#10b981', my: 0.5, letterSpacing: '-0.025em' }}>
                {avgSubmissionRate}%
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                {items.length ? 'Tổng hợp từ các bài tập đã giao trong học kỳ' : 'Chưa có dữ liệu bài tập'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Thanh thao tác hàng loạt khi có dòng được chọn */}
      {selectedTableIds.size > 0 && (
        <Box
          sx={{
            mb: 2,
            p: 1.5,
            px: 2.5,
            borderRadius: 2,
            bgcolor: '#fef2f2',
            border: '1px solid #fecaca',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="body2" fontWeight={700} sx={{ color: '#991b1b' }}>
              Đã chọn {selectedTableIds.size} khóa học
            </Typography>
            <Button size="small" onClick={() => setSelectedTableIds(new Set())} sx={{ color: '#64748b', textTransform: 'none' }}>
              Bỏ chọn
            </Button>
          </Stack>
          <Button
            variant="contained"
            color="error"
            size="small"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={() => setOpenBatchDeleteDialog(true)}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
          >
            Xóa {selectedTableIds.size} khóa học đã chọn
          </Button>
        </Box>
      )}

      {/* Unified DataTable Block */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden', bgcolor: '#ffffff' }}>
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, borderBottom: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" sx={{ flex: 1, minWidth: { xs: '100%', md: 600 } }}>
            <TextField
              size="small"
              placeholder="Tìm theo tên khóa học, mã lớp, học kỳ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              sx={{ flex: 1, minWidth: 260 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                  </InputAdornment>
                )
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="year-filter-label">Năm học</InputLabel>
              <Select
                labelId="year-filter-label"
                value={academicYear}
                label="Năm học"
                onChange={(e) => setAcademicYear(e.target.value)}
              >
                <MenuItem value="ALL">Tất cả năm học</MenuItem>
                <MenuItem value="2025–2026">Năm học 2025–2026</MenuItem>
                <MenuItem value="2026–2027">Năm học 2026–2027</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel id="sem-filter-label">Học kỳ</InputLabel>
              <Select
                labelId="sem-filter-label"
                value={semester}
                label="Học kỳ"
                onChange={(e) => setSemester(e.target.value)}
              >
                <MenuItem value="ALL">Tất cả học kỳ</MenuItem>
                <MenuItem value="HK1">Học kỳ 1</MenuItem>
                <MenuItem value="HK2">Học kỳ 2</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack direction="row" spacing={1.5} alignItems="center">
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
            <Tooltip title="Tải lại danh sách">
              <IconButton size="small" onClick={load} sx={{ border: '1px solid #e2e8f0' }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {items.length === 0 && !loading ? (
          <Box sx={{ p: 6, textAlign: 'center', bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
            <Box
              sx={{
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
              }}
            >
              <SchoolIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: '#0f172a', mb: 0.5 }}>
              Chưa có khóa học nào được đồng bộ từ Google Classroom
            </Typography>
            <Typography variant="body2" color="#64748b" sx={{ maxWidth: 580, mx: 'auto', mb: 3 }}>
              Bạn có thể bấm &quot;Duyệt &amp; Đồng bộ Lớp học&quot; để quét danh sách từ Google Classroom và chọn các lớp mong muốn, hoặc kết nối tài khoản Google trong phần cấu hình.
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center">
              <Button
                variant="contained"
                startIcon={<PlaylistAddCheckIcon />}
                onClick={handleOpenPreview}
                sx={{
                  bgcolor: '#2563eb',
                  color: '#ffffff',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  textTransform: 'none',
                  borderRadius: 2
                }}
              >
                Duyệt & Đồng bộ ngay
              </Button>
              <Button
                variant="outlined"
                startIcon={<LinkIcon sx={{ fontSize: 16 }} />}
                onClick={() => navigate('/connections')}
                sx={{ fontWeight: 600, fontSize: '0.8125rem', textTransform: 'none', borderRadius: 2 }}
              >
                Cấu hình kết nối Google
              </Button>
            </Stack>
          </Box>
        ) : (
          <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
            <Table size="medium">
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={isAllTableSelected}
                      indeterminate={selectedTableIds.size > 0 && !isAllTableSelected}
                      onChange={toggleSelectAllTable}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tên khóa học
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Học kỳ / Section
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Trạng thái
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Lớp hành chính
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Sĩ số Roster
                  </TableCell>
                  <TableCell sx={{ minWidth: 160, fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tỷ lệ nộp bài
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Hành động
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.map((x) => {
                  const rawSubRate = x.completionRate ?? x.content?.completionRate ?? x.content?.submissionRate;
                  const subRate = rawSubRate != null && rawSubRate !== '' && !isNaN(Number(rawSubRate)) ? Number(rawSubRate) : null;
                  const studentCount = x.rosterStudents ?? x.roster?.students ?? null;
                  const isMapped = Boolean(x.className || x.classId);
                  const isSelected = selectedTableIds.has(x.id);

                  return (
                    <TableRow
                      key={x.id}
                      hover
                      selected={isSelected}
                      sx={{ '&:hover': { bgcolor: 'rgba(239, 246, 255, 0.6)' } }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={isSelected}
                          onChange={() => toggleSelectTableRow(x.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a' }}>
                          {x.name}
                        </Typography>
                        {x.alternateLink && (
                          <Typography
                            component="a"
                            href={x.alternateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            variant="caption"
                            sx={{
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 0.5,
                              textDecoration: 'none',
                              '&:hover': { textDecoration: 'underline' }
                            }}
                          >
                            Mở Google Classroom <OpenInNewIcon sx={{ fontSize: 12 }} />
                          </Typography>
                        )}
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
                          {studentCount != null ? `${studentCount} HS` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {subRate !== null ? (
                          <Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ flex: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={Math.min(subRate, 100)}
                                  sx={{
                                    height: 6,
                                    borderRadius: 3,
                                    bgcolor: '#f1f5f9',
                                    '& .MuiLinearProgress-bar': { bgcolor: subRate >= 90 ? '#10b981' : subRate < 70 ? '#ef4444' : '#2563eb' }
                                  }}
                                />
                              </Box>
                              <Typography variant="caption" fontWeight={700} sx={{ minWidth: 35, color: subRate < 70 ? '#dc2626' : '#0f172a' }}>
                                {subRate}%
                              </Typography>
                            </Box>
                            {subRate < 70 && (
                              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                                <Chip
                                  label="Cần đôn đốc (<70%)"
                                  size="small"
                                  sx={{
                                    height: 20,
                                    fontSize: '0.6875rem',
                                    fontWeight: 700,
                                    bgcolor: '#fef2f2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca'
                                  }}
                                />
                                <Tooltip title="Soạn và gửi thông báo đôn đốc nộp bài">
                                  <IconButton
                                    size="small"
                                    onClick={() => handleOpenNudge(x)}
                                    sx={{ color: '#ea580c', p: 0.2, '&:hover': { bgcolor: '#fff7ed' } }}
                                  >
                                    <CampaignIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            )}
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Chưa có bài tập
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          {subRate !== null && subRate < 70 && (
                            <Button
                              size="small"
                              variant="outlined"
                              color="warning"
                              startIcon={<CampaignIcon sx={{ fontSize: 14 }} />}
                              onClick={() => handleOpenNudge(x)}
                              sx={{ fontSize: '0.75rem', py: 0.4, px: 1, borderRadius: 1.5, fontWeight: 700, textTransform: 'none' }}
                            >
                              Đôn đốc
                            </Button>
                          )}
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<LinkIcon sx={{ fontSize: 14 }} />}
                            onClick={() => openMapDialog(x)}
                            sx={{ fontSize: '0.75rem', py: 0.4, px: 1.2, borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                          >
                            {isMapped ? 'Sửa map' : 'Mapping'}
                          </Button>
                          <Tooltip title="Xóa khóa học này khỏi hệ thống">
                            <IconButton
                              size="small"
                              onClick={() => {
                                setDeleteTarget(x);
                                setDeleteAddToIgnore(true);
                              }}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Card>

      {/* DIALOG: DUYỆT & ĐỒNG BỘ GOOGLE CLASSROOM (SELECTIVE SYNC PREVIEW) */}
      <Dialog
        open={openPreviewDialog}
        onClose={() => !executingSync && setOpenPreviewDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: '#0f172a', pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PlaylistAddCheckIcon sx={{ color: '#2563eb' }} />
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                Duyệt & Chọn Lớp Đồng Bộ Từ Google Classroom
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Chọn chính xác các khóa học thuộc năm học hiện tại cần nạp vào hệ thống
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5 }}>
          {previewLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress size={36} sx={{ color: '#2563eb', mb: 2 }} />
              <Typography variant="body2" fontWeight={600} sx={{ color: '#334155' }}>
                Đang kết nối Google Classroom và quét danh sách khóa học...
              </Typography>
              <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                Quá trình này có thể mất từ 3–5 giây tùy thuộc số lượng lớp của trường.
              </Typography>
            </Box>
          ) : previewError ? (
            <Alert severity="error" sx={{ my: 2, borderRadius: 2 }}>
              {previewError}
            </Alert>
          ) : (
            <Stack spacing={2}>
              {/* Thẻ đếm số lượng */}
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => setPreviewFilter('ALL')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: previewFilter === 'ALL' ? '#eff6ff' : '#f8fafc',
                      border: previewFilter === 'ALL' ? '2px solid #3b82f6' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>TẤT CẢ TÌM THẤY</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>{previewCounts.total}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => setPreviewFilter('NEW')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: previewFilter === 'NEW' ? '#ecfdf5' : '#f8fafc',
                      border: previewFilter === 'NEW' ? '2px solid #10b981' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>LỚP MỚI CHƯA ĐỒNG BỘ</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#059669' }}>{previewCounts.newCount}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => setPreviewFilter('SYNCED')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: previewFilter === 'SYNCED' ? '#eff6ff' : '#f8fafc',
                      border: previewFilter === 'SYNCED' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 600 }}>ĐÃ ĐỒNG BỘ</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#2563eb' }}>{previewCounts.syncedCount}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box
                    onClick={() => setPreviewFilter('IGNORED')}
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: previewFilter === 'IGNORED' ? '#fef2f2' : '#f8fafc',
                      border: previewFilter === 'IGNORED' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#dc2626', fontWeight: 600 }}>ĐÃ LOẠI TRỪ</Typography>
                    <Typography variant="h6" fontWeight={700} sx={{ color: '#dc2626' }}>{previewCounts.ignoredCount}</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Thanh lọc & Nút chọn nhanh */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Lọc danh sách theo tên khóa học, mã lớp..."
                  value={previewSearch}
                  onChange={(e) => setPreviewSearch(e.target.value)}
                  sx={{ width: { xs: '100%', sm: 280 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} />
                      </InputAdornment>
                    )
                  }}
                />
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setPreviewSelectedIds(new Set(previewItems.map((x) => x.id)))}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Chọn tất cả ({previewItems.length})
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      const newIds = previewItems.filter((x) => !x.isAlreadySynced && !x.isIgnored).map((x) => x.id);
                      setPreviewSelectedIds(new Set(newIds));
                    }}
                    sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                  >
                    Chỉ chọn lớp mới ({previewCounts.newCount})
                  </Button>
                  <Button
                    size="small"
                    onClick={() => setPreviewSelectedIds(new Set())}
                    sx={{ textTransform: 'none', fontSize: '0.75rem', color: '#64748b' }}
                  >
                    Bỏ chọn
                  </Button>
                </Stack>
              </Box>

              {/* Bảng danh sách chọn lớp */}
              <TableContainer sx={{ maxHeight: 380, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={filteredPreviewItems.length > 0 && filteredPreviewItems.every((x) => previewSelectedIds.has(x.id))}
                          indeterminate={
                            filteredPreviewItems.some((x) => previewSelectedIds.has(x.id)) &&
                            !filteredPreviewItems.every((x) => previewSelectedIds.has(x.id))
                          }
                          onChange={() => {
                            const allChecked = filteredPreviewItems.every((x) => previewSelectedIds.has(x.id));
                            const next = new Set(previewSelectedIds);
                            if (allChecked) {
                              for (const x of filteredPreviewItems) next.delete(x.id);
                            } else {
                              for (const x of filteredPreviewItems) next.add(x.id);
                            }
                            setPreviewSelectedIds(next);
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Khóa học Google</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Lớp đề xuất</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Môn học</TableCell>
                      <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Trạng thái</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredPreviewItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center" sx={{ py: 3, color: '#94a3b8' }}>
                          Không có khóa học nào khớp với bộ lọc này.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPreviewItems.map((c) => {
                        const isChecked = previewSelectedIds.has(c.id);
                        return (
                          <TableRow
                            key={c.id}
                            hover
                            selected={isChecked}
                            onClick={() => {
                              const next = new Set(previewSelectedIds);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              setPreviewSelectedIds(next);
                            }}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell padding="checkbox">
                              <Checkbox size="small" checked={isChecked} />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a' }}>
                                {c.name}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                ID: {c.id} {c.section ? `• ${c.section}` : ''}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {c.className ? (
                                <Chip label={c.className} size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, height: 22 }} />
                              ) : (
                                <Typography variant="caption" color="text.secondary">Chưa xác định</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" sx={{ color: '#334155', fontWeight: 500 }}>
                                {c.subjectName || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {c.isIgnored ? (
                                <Chip label="Đang loại trừ" size="small" sx={{ bgcolor: '#fef2f2', color: '#b91c1c', fontWeight: 600, height: 22 }} />
                              ) : c.isAlreadySynced ? (
                                <Chip label="Đã có trong hệ thống" size="small" sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, height: 22 }} />
                              ) : (
                                <Chip label="Lớp mới" size="small" sx={{ bgcolor: '#ecfdf5', color: '#059669', fontWeight: 700, height: 22 }} />
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Tùy chọn loại trừ các lớp không chọn */}
              <Box sx={{ pt: 1 }}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={previewAutoIgnoreUnselected}
                      onChange={(e) => setPreviewAutoIgnoreUnselected(e.target.checked)}
                      size="small"
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: '#475569', fontSize: '0.85rem' }}>
                      Đưa các khóa học <strong>không được chọn</strong> vào danh sách loại trừ (để tự động bỏ qua trong các đợt đồng bộ sau)
                    </Typography>
                  }
                />
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', justifyContent: 'space-between' }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#334155' }}>
              Đã chọn: <strong style={{ color: '#2563eb' }}>{previewSelectedIds.size}</strong> khóa học
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button onClick={() => setOpenPreviewDialog(false)} disabled={executingSync} sx={{ textTransform: 'none' }}>
                Hủy
              </Button>
              <Button
                variant="contained"
                startIcon={executingSync ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
                onClick={handleExecuteSelectiveSync}
                disabled={executingSync || previewSelectedIds.size === 0}
                sx={{
                  bgcolor: '#2563eb',
                  '&:hover': { bgcolor: '#1d4ed8' },
                  fontWeight: 700,
                  textTransform: 'none',
                  px: 2.5,
                  borderRadius: 2
                }}
              >
                {executingSync ? 'Đang nạp dữ liệu...' : `Bắt đầu đồng bộ ${previewSelectedIds.size} khóa học`}
              </Button>
            </Stack>
          </Stack>
        </DialogActions>
      </Dialog>

      {/* DIALOG: XÁC NHẬN XÓA 1 KHÓA HỌC */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon sx={{ color: '#dc2626' }} />
          Xóa khóa học khỏi hệ thống
        </DialogTitle>
        <DialogContent dividers>
          {deleteTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" sx={{ color: '#334155' }}>
                Bạn có chắc chắn muốn xóa khóa học <strong>{deleteTarget.name}</strong> không?
              </Typography>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                Toàn bộ dữ liệu điểm số, bài nộp và liên kết của khóa học này trong hệ thống sẽ được dọn sạch.
              </Typography>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={deleteAddToIgnore}
                    onChange={(e) => setDeleteAddToIgnore(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: '#1e293b', fontSize: '0.8125rem' }}>
                    Đưa vào danh sách loại trừ (để không tự động nạp lại khi đồng bộ Google Classroom)
                  </Typography>
                }
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteCourse}
            disabled={deleting}
            sx={{ fontWeight: 700, textTransform: 'none', px: 2.5 }}
          >
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận xóa'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: XÓA HÀNG LOẠT KHÓA HỌC */}
      <Dialog open={openBatchDeleteDialog} onClose={() => !batchDeleting && setOpenBatchDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 1 }}>
          <DeleteIcon sx={{ color: '#dc2626' }} />
          Xóa {selectedTableIds.size} khóa học đã chọn
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" sx={{ color: '#334155' }}>
              Bạn đang yêu cầu xóa <strong>{selectedTableIds.size}</strong> khóa học cùng lúc khỏi hệ thống.
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
              Hành động này sẽ xóa vĩnh viễn dữ liệu bài tập và bài nộp liên quan của các khóa học được chọn.
            </Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={batchDeleteAddToIgnore}
                  onChange={(e) => setBatchDeleteAddToIgnore(e.target.checked)}
                  size="small"
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" sx={{ color: '#1e293b', fontSize: '0.8125rem' }}>
                  Đưa các khóa học này vào danh sách loại trừ (không tự động kéo lại)
                </Typography>
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenBatchDeleteDialog(false)} disabled={batchDeleting} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleBatchDelete}
            disabled={batchDeleting}
            sx={{ fontWeight: 700, textTransform: 'none', px: 2.5 }}
          >
            {batchDeleting ? <CircularProgress size={18} color="inherit" /> : 'Xác nhận xóa tất cả'}
          </Button>
        </DialogActions>
      </Dialog>

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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setMapTarget(null)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveMapping}
            sx={{
              bgcolor: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': { bgcolor: '#1d4ed8' }
            }}
          >
            Lưu Ánh Xạ
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: LỊCH TỰ ĐỘNG ĐỒNG BỘ (AUTO-SYNC SCHEDULER) */}
      <Dialog
        open={openScheduleDialog}
        onClose={() => setOpenScheduleDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <ScheduleIcon sx={{ color: '#4f46e5' }} />
          Lịch Tự Động Đồng Bộ Google Classroom (Auto-Sync)
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          {scheduleLoading ? (
            <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={32} />
            </Box>
          ) : scheduleConfig ? (
            <Stack spacing={2.5} sx={{ pt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a' }}>
                    Kích hoạt Đồng bộ Tự động Ngầm
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Tự động quét danh sách lớp, bài tập và điểm số mà không cần thao tác thủ công.
                  </Typography>
                </Box>
                <Switch
                  checked={Boolean(scheduleConfig.enabled)}
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, enabled: e.target.checked })}
                  color="primary"
                />
              </Box>

              <FormControl fullWidth size="small">
                <InputLabel id="sched-freq-label">Tần suất đồng bộ tự động</InputLabel>
                <Select
                  labelId="sched-freq-label"
                  value={scheduleConfig.frequency || 'DAILY'}
                  label="Tần suất đồng bộ tự động"
                  onChange={(e) => setScheduleConfig({ ...scheduleConfig, frequency: e.target.value })}
                >
                  <MenuItem value="DAILY">Hàng ngày lúc 23:00 đêm (Khuyên dùng - ít tải server)</MenuItem>
                  <MenuItem value="EVERY_12_HOURS">Mỗi 12 tiếng một lần</MenuItem>
                  <MenuItem value="EVERY_6_HOURS">Mỗi 6 tiếng một lần</MenuItem>
                  <MenuItem value="HOURLY">Mỗi 1 tiếng một lần</MenuItem>
                </Select>
              </FormControl>

              <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#fbfcfd' }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#475569', textTransform: 'uppercase', display: 'block', mb: 1 }}>
                  Thông tin phiên đồng bộ ngầm
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Lần chạy gần nhất:</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a' }}>
                      {scheduleConfig.lastRunAt ? new Date(scheduleConfig.lastRunAt).toLocaleString('vi-VN') : 'Chưa có'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">Lần chạy kế tiếp:</Typography>
                    <Typography variant="body2" fontWeight={600} sx={{ color: '#2563eb' }}>
                      {scheduleConfig.nextRunAt ? new Date(scheduleConfig.nextRunAt).toLocaleString('vi-VN') : '—'}
                    </Typography>
                  </Grid>
                  {scheduleConfig.lastRunStatus && (
                    <Grid size={{ xs: 12 }}>
                      <Chip
                        label={`Trạng thái: ${scheduleConfig.lastRunStatus === 'SUCCESS' ? 'Thành công' : scheduleConfig.lastRunStatus}`}
                        size="small"
                        sx={{
                          bgcolor: scheduleConfig.lastRunStatus === 'SUCCESS' ? '#ecfdf5' : '#fef2f2',
                          color: scheduleConfig.lastRunStatus === 'SUCCESS' ? '#059669' : '#dc2626',
                          fontWeight: 700
                        }}
                      />
                    </Grid>
                  )}
                  {scheduleConfig.lastRunSummary && (
                    <Grid size={{ xs: 12 }}>
                      <Alert severity="info" sx={{ py: 0.5, fontSize: '0.8125rem' }}>
                        {scheduleConfig.lastRunSummary}
                      </Alert>
                    </Grid>
                  )}
                </Grid>
              </Card>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={triggeringSchedule ? <CircularProgress size={16} /> : <SyncIcon />}
                  onClick={handleTriggerScheduleNow}
                  disabled={triggeringSchedule}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
                >
                  {triggeringSchedule ? 'Đang chạy đồng bộ...' : 'Chạy thử ngay bây giờ'}
                </Button>
                <Button
                  size="small"
                  onClick={() => {
                    setOpenScheduleDialog(false);
                    navigate('/connections');
                  }}
                  sx={{ textTransform: 'none', color: '#64748b' }}
                >
                  Cấu hình nâng cao (DWD/OAuth) →
                </Button>
              </Box>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenScheduleDialog(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Đóng
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveSchedule}
            disabled={scheduleSaving}
            sx={{
              bgcolor: '#4f46e5',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': { bgcolor: '#4338ca' }
            }}
          >
            {scheduleSaving ? <CircularProgress size={16} color="inherit" /> : 'Lưu Cài Đặt Lịch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: ĐÔN ĐỐC HOÀN THÀNH BÀI TẬP (HOMEROOM / SUBJECT NUDGE) */}
      <Dialog
        open={Boolean(nudgeTarget)}
        onClose={() => setNudgeTarget(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.125rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CampaignIcon sx={{ color: '#ea580c' }} />
          Đôn Đốc Nộp Bài Tập Google Classroom
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: '#e2e8f0' }}>
          {nudgeTarget && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box sx={{ p: 2, bgcolor: '#fff7ed', borderRadius: 2, border: '1px solid #fed7aa' }}>
                <Typography variant="body2" sx={{ color: '#9a3412', fontWeight: 700 }}>
                  Khóa học: {nudgeTarget.name}
                </Typography>
                <Typography variant="caption" sx={{ color: '#c2410c', display: 'block', mt: 0.5 }}>
                  Lớp hành chính: <strong>{nudgeTarget.className || nudgeTarget.classId || 'Chưa mapping'}</strong> • Sĩ số: {nudgeTarget.rosterStudents ?? nudgeTarget.roster?.students ?? '—'} HS
                </Typography>
                <Typography variant="caption" sx={{ color: '#c2410c', display: 'block', mt: 0.5, fontWeight: 700 }}>
                  Tỷ lệ nộp bài hiện tại: {nudgeTarget.completionRate ?? nudgeTarget.content?.completionRate ?? 0}% (thấp hơn ngưỡng thi đua 70%)
                </Typography>
              </Box>

              <Typography variant="caption" fontWeight={700} sx={{ color: '#475569' }}>
                Nội dung thông báo đôn đốc (Gửi tới GVCN / Nhóm phụ huynh):
              </Typography>
              <TextField
                multiline
                rows={7}
                fullWidth
                size="small"
                value={nudgeMessage}
                onChange={(e) => setNudgeMessage(e.target.value)}
                sx={{ bgcolor: '#ffffff' }}
              />
              <Typography variant="caption" color="text.secondary">
                Thầy/Cô có thể chỉnh sửa nội dung trên trước khi sao chép gửi nhóm Zalo hoặc phát lệnh qua hệ thống.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={nudgeCopied ? <CheckRoundedIcon sx={{ color: '#059669' }} /> : <ContentCopyIcon />}
            onClick={handleCopyNudge}
            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5 }}
          >
            {nudgeCopied ? 'Đã sao chép vào bộ nhớ tạm!' : 'Sao chép tin nhắn'}
          </Button>
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setNudgeTarget(null)} sx={{ textTransform: 'none', color: '#64748b' }}>
              Đóng
            </Button>
            <Button
              variant="contained"
              color="warning"
              startIcon={nudgeSending ? <CircularProgress size={16} color="inherit" /> : <CampaignIcon />}
              onClick={handleSendNudge}
              disabled={nudgeSending}
              sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 1.5 }}
            >
              {nudgeSending ? 'Đang gửi...' : 'Phát lệnh đôn đốc'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
}