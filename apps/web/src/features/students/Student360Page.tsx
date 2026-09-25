import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Card,
  Grid,
  Typography,
  Chip,
  Avatar,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Tabs,
  Tab,
  LinearProgress,
  Stack,
  Alert,
  Tooltip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  Select,
  MenuItem
} from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ReferenceLine
} from 'recharts';
import SearchIcon from '@mui/icons-material/SearchRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import TrendingUpIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownIcon from '@mui/icons-material/TrendingDownRounded';
import TrendingFlatIcon from '@mui/icons-material/TrendingFlatRounded';
import CheckCircleIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineRounded';
import StarIcon from '@mui/icons-material/StarRounded';
import ChatIcon from '@mui/icons-material/ChatRounded';
import ContentCopyIcon from '@mui/icons-material/ContentCopyRounded';
import CheckIcon from '@mui/icons-material/CheckRounded';
import PrintIcon from '@mui/icons-material/PrintRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import ShieldIcon from '@mui/icons-material/ShieldRounded';
import NoteAltIcon from '@mui/icons-material/NoteAltRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

interface StudentItem {
  id: string;
  personId: string;
  name: string;
  displayName: string;
  email: string | null;
  photoUrl: string | null;
  classId: string | null;
  className: string | null;
  courses: string[] | null;
  suspended: boolean;
}

export default function Student360Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStudentId = searchParams.get('studentId');

  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('ALL');

  // Detail 360 data
  const [detailData, setDetailData] = useState<any | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Intervention Notes State
  const [notes, setNotes] = useState<Array<{ id: string; date: string; tag: string; content: string }>>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newNoteTag, setNewNoteTag] = useState('Đôn đốc');

  // Parent alert dialog
  const [openParentDialog, setOpenParentDialog] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Load student list
  const loadStudents = async () => {
    setLoadingList(true);
    try {
      const res = await api<{ total: number; items: StudentItem[] }>('/api/people/students');
      const list = res.items || [];
      setStudents(list);

      // Ưu tiên chọn học sinh từ URL param nếu có
      if (urlStudentId) {
        const found = list.find((s) => (s.personId || s.id) === urlStudentId || s.id === urlStudentId);
        if (found) {
          setSelectedStudentId(found.personId || found.id);
        } else {
          setSelectedStudentId(urlStudentId);
        }
      } else if (list.length > 0 && !selectedStudentId) {
        setSelectedStudentId(list[0].personId || list[0].id);
      }
    } catch (err) {
      console.error('Failed to load students', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  // Đồng bộ khi URL param thay đổi
  useEffect(() => {
    if (urlStudentId && urlStudentId !== selectedStudentId) {
      setSelectedStudentId(urlStudentId);
    }
  }, [urlStudentId]);

  // Load notes from localStorage whenever selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) return;
    try {
      const saved = localStorage.getItem(`student_notes_${selectedStudentId}`);
      if (saved) {
        setNotes(JSON.parse(saved));
      } else {
        setNotes([]);
      }
    } catch {
      setNotes([]);
    }
  }, [selectedStudentId]);

  const handleSaveNote = () => {
    if (!newNoteContent.trim() || !selectedStudentId) return;
    const newEntry = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      tag: newNoteTag,
      content: newNoteContent.trim()
    };
    const updated = [newEntry, ...notes];
    setNotes(updated);
    setNewNoteContent('');
    try {
      localStorage.setItem(`student_notes_${selectedStudentId}`, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving note', e);
    }
  };

  const handleDeleteNote = (id: string) => {
    if (!selectedStudentId) return;
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    try {
      localStorage.setItem(`student_notes_${selectedStudentId}`, JSON.stringify(updated));
    } catch {}
  };

  // Danh sách các lớp khả dụng
  const availableClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (s.className) set.add(s.className);
      else if (s.classId) set.add(s.classId);
    }
    return Array.from(set).sort();
  }, [students]);

  // Load student 360 detail whenever selectedStudentId changes
  useEffect(() => {
    if (!selectedStudentId) return;
    let isCancelled = false;
    setLoadingDetail(true);

    api<any>(`/api/people/students/${encodeURIComponent(selectedStudentId)}/grades`)
      .then((data) => {
        if (!isCancelled) {
          setDetailData(data);
        }
      })
      .catch((err) => {
        console.error('Failed to load student 360', err);
        if (!isCancelled) setDetailData(null);
      })
      .finally(() => {
        if (!isCancelled) setLoadingDetail(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedStudentId]);

  // Filtered student list
  const filteredStudents = useMemo(() => {
    return students.filter((st) => {
      const query = search.trim().toLowerCase();
      const matchQuery =
        !query ||
        (st.displayName && st.displayName.toLowerCase().includes(query)) ||
        (st.email && st.email.toLowerCase().includes(query)) ||
        (st.className && st.className.toLowerCase().includes(query));

      const matchClass =
        selectedClassFilter === 'ALL' ||
        st.className === selectedClassFilter ||
        st.classId === selectedClassFilter;

      return matchQuery && matchClass;
    });
  }, [students, search, selectedClassFilter]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => (s.personId || s.id) === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const handleSelectStudent = (id: string) => {
    setSelectedStudentId(id);
    setSearchParams({ studentId: id });
  };

  // Parent Message template
  const parentMessageText = useMemo(() => {
    if (!detailData) return '';
    const stName = detailData.displayName || 'Em học sinh';
    const clsName = detailData.className || 'Lớp';
    const gpa = detailData.summary?.gpa ? `${detailData.summary.gpa}/10` : 'Đang cập nhật';
    const compRate = `${detailData.summary?.completionRate || 0}%`;
    const missing = detailData.digitalDiscipline?.missingCount || 0;
    const momentum =
      detailData.atRisk?.velocityStatus === 'ACCELERATING'
        ? 'Tiến bộ vượt bậc'
        : detailData.atRisk?.velocityStatus === 'DECLINING'
        ? 'Có dấu hiệu giảm sút điểm số'
        : 'Ổn định';

    return `Kính gửi Phụ huynh học sinh ${stName} (${clsName} - THCS Giảng Võ),\n\nNhà trường xin gửi báo cáo định kỳ về tình hình học tập số trên Google Classroom:\n• Điểm trung bình (GPA): ${gpa} (${detailData.summary?.rank || 'Đạt'})\n• Tỷ lệ nộp bài tập: ${compRate} (Đã nộp ${detailData.summary?.submittedAssignments}/${detailData.summary?.totalAssignments} bài)\n• Bài tập chưa hoàn thành: ${missing} bài\n• Đà học tập: ${momentum}\n• Nhận xét kỷ luật số: ${detailData.digitalDiscipline?.habitAssessment || 'Ngoan, chấp hành tốt'}\n\nĐề nghị Quý Phụ huynh phối hợp cùng GVCN động viên, nhắc nhở em hoàn thành các bài tập còn thiếu. Trân trọng!`;
  }, [detailData]);

  const handleCopyMessage = () => {
    if (!parentMessageText) return;
    navigator.clipboard.writeText(parentMessageText);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2500);
  };

  return (
    <Box sx={{ pb: 6 }}>
      <PageHeader
        title="Hồ sơ Học sinh 360° & Quỹ đạo Phát triển"
        subtitle="Hệ thống trí tuệ học đường đánh giá toàn diện năng lực, đường cong học tập và kỷ luật số theo chuẩn Google Classroom SSOT"
        icon={<SchoolIcon sx={{ color: '#2563eb' }} />}
        action={
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="In Phiếu Báo Cáo Học Sinh 360°">
              <Button
                variant="outlined"
                size="small"
                startIcon={<PrintIcon />}
                onClick={() => window.print()}
                sx={{ bgcolor: '#fff', border: '1px solid #cbd5e1', fontWeight: 600, color: '#334155', textTransform: 'none' }}
              >
                In Phiếu 360°
              </Button>
            </Tooltip>
            <Tooltip title="Làm mới dữ liệu">
              <IconButton onClick={loadStudents} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      <Grid container spacing={2.5}>
        {/* CỘT TRÁI: DANH SÁCH HỌC SINH */}
        <Grid size={{ xs: 12, md: 4, lg: 3.5 }}>
          <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 2, bgcolor: '#ffffff', height: 'calc(100vh - 190px)', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <SchoolIcon fontSize="small" sx={{ color: '#2563eb' }} />
              Danh sách Học sinh ({filteredStudents.length})
            </Typography>

            {/* BỘ LỌC THEO LỚP */}
            <FormControl size="small" fullWidth sx={{ mb: 1.25 }}>
              <Select
                value={selectedClassFilter}
                onChange={(e) => setSelectedClassFilter(e.target.value)}
                displayEmpty
                sx={{ borderRadius: 2, bgcolor: '#f8fafc', fontSize: '0.85rem', fontWeight: 600 }}
              >
                <MenuItem value="ALL">Tất cả các lớp ({availableClasses.length} lớp)</MenuItem>
                {availableClasses.map((cls) => (
                  <MenuItem key={cls} value={cls}>
                    Lớp {cls}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              size="small"
              placeholder="Tìm theo tên, email, lớp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 2 }}
            />

            {/* Danh sách cuộn */}
            <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
              {loadingList ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={28} />
                  <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                    Đang nạp danh sách học sinh...
                  </Typography>
                </Box>
              ) : filteredStudents.length === 0 ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Không tìm thấy học sinh nào phù hợp.
                  </Typography>
                </Box>
              ) : (
                <Stack spacing={1}>
                  {filteredStudents.map((st) => {
                    const id = st.personId || st.id;
                    const isSelected = id === selectedStudentId;
                    return (
                      <Card
                        key={id}
                        onClick={() => handleSelectStudent(id)}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                          bgcolor: isSelected ? '#eff6ff' : '#ffffff',
                          transition: 'all 0.15s ease-in-out',
                          '&:hover': {
                            bgcolor: isSelected ? '#eff6ff' : '#f8fafc',
                            borderColor: isSelected ? '#2563eb' : '#cbd5e1'
                          }
                        }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            src={st.photoUrl || undefined}
                            sx={{ width: 36, height: 36, fontSize: '0.85rem', bgcolor: isSelected ? '#2563eb' : '#e0e7ff', color: isSelected ? '#ffffff' : '#3730a3' }}
                          >
                            {(st.displayName || 'H')[0].toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="subtitle2" noWrap sx={{ fontWeight: isSelected ? 800 : 700, color: '#0f172a', fontSize: '0.875rem' }}>
                              {st.displayName}
                            </Typography>
                            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25 }}>
                              <Chip
                                label={st.className || 'Chưa phân lớp'}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600, bgcolor: isSelected ? '#dbeafe' : '#f1f5f9' }}
                              />
                              <Typography variant="caption" noWrap sx={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {st.email}
                              </Typography>
                            </Stack>
                          </Box>
                        </Stack>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </Box>
          </Card>
        </Grid>

        {/* CỘT PHẢI: BẢNG ĐIỀU KHIỂN HỒ SƠ 360° */}
        <Grid size={{ xs: 12, md: 8, lg: 8.5 }}>
          {loadingDetail ? (
            <Card sx={{ p: 6, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#ffffff' }}>
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ color: '#64748b', mt: 2, fontWeight: 600 }}>
                Đang phân tích dữ liệu 360°, đường cong học tập và chỉ số đà tiến bộ...
              </Typography>
            </Card>
          ) : !detailData ? (
            <Card sx={{ p: 6, borderRadius: 3, border: '1px solid #e2e8f0', textAlign: 'center', bgcolor: '#ffffff' }}>
              <Typography variant="body1" sx={{ color: '#64748b', fontWeight: 600 }}>
                Vui lòng chọn một học sinh ở danh sách bên trái để xem hồ sơ năng lực 360°.
              </Typography>
            </Card>
          ) : (
            <Stack spacing={2.5}>
              {/* BANNER THÔNG TIN HỌC SINH */}
              <Card sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ sm: 'center' }} justifyContent="space-between">
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={detailData.photoUrl || selectedStudent?.photoUrl || undefined}
                      sx={{ width: 64, height: 64, fontSize: '1.5rem', bgcolor: '#2563eb', color: '#ffffff', boxShadow: '0 4px 12px rgba(37,99,235,0.2)' }}
                    >
                      {(detailData.displayName || 'H')[0].toUpperCase()}
                    </Avatar>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          {detailData.displayName}
                        </Typography>
                        <Chip
                          label={detailData.summary?.rank || 'Đạt'}
                          size="small"
                          color={detailData.summary?.gpa >= 8.0 ? 'success' : detailData.summary?.gpa >= 6.5 ? 'primary' : 'warning'}
                          sx={{ fontWeight: 700, fontSize: '0.75rem' }}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                        Lớp: <strong>{detailData.className}</strong> (Khối {detailData.grade || '—'}) • Email: <strong>{detailData.email}</strong> • Năm học: 2025–2026
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<ChatIcon />}
                      onClick={() => setOpenParentDialog(true)}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2 }}
                    >
                      Báo cáo Phụ huynh
                    </Button>
                    <Button
                      variant="contained"
                      startIcon={<PrintIcon />}
                      onClick={() => window.print()}
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                    >
                      In Hồ sơ 360°
                    </Button>
                  </Stack>
                </Stack>

                {/* CẢNH BÁO CAN THIỆP SỚM NẾU CÓ */}
                {detailData.atRisk?.level === 'CRITICAL' || detailData.atRisk?.level === 'ATTENTION' ? (
                  <Alert
                    severity={detailData.atRisk.level === 'CRITICAL' ? 'error' : 'warning'}
                    icon={detailData.atRisk.level === 'CRITICAL' ? <ErrorOutlineIcon /> : <WarningAmberIcon />}
                    sx={{ mt: 2.5, borderRadius: 2 }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {detailData.atRisk.label}: {detailData.atRisk.reasons?.join(' • ')}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                      Khuyến nghị GVCN: {detailData.atRisk.recommendedAction}
                    </Typography>
                  </Alert>
                ) : null}
              </Card>

              {/* 4 THẺ KPI CHỦ ĐẠO */}
              <Grid container spacing={2}>
                {/* 1. Điểm TB */}
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Điểm Trung Bình (GPA)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#2563eb', my: 0.5 }}>
                      {detailData.summary?.gpa != null ? detailData.summary.gpa.toFixed(1) : '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <StarIcon sx={{ fontSize: 14, color: '#eab308' }} />
                      Xếp loại: <strong>{detailData.summary?.rank}</strong>
                    </Typography>
                  </Card>
                </Grid>

                {/* 2. Đà tiến bộ */}
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Đà Tiến Bộ (Velocity ΔV)
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 800,
                        my: 0.5,
                        color:
                          detailData.atRisk?.velocityDelta > 0
                            ? '#16a34a'
                            : detailData.atRisk?.velocityDelta < 0
                            ? '#dc2626'
                            : '#0f172a'
                      }}
                    >
                      {detailData.atRisk?.velocityDelta > 0 ? `+${detailData.atRisk.velocityDelta}` : detailData.atRisk?.velocityDelta || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {detailData.atRisk?.velocityStatus === 'ACCELERATING' ? (
                        <>
                          <TrendingUpIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>Tiến bộ vượt bậc</span>
                        </>
                      ) : detailData.atRisk?.velocityStatus === 'DECLINING' ? (
                        <>
                          <TrendingDownIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>Có dấu hiệu giảm sút</span>
                        </>
                      ) : (
                        <>
                          <TrendingFlatIcon sx={{ fontSize: 16, color: '#64748b' }} />
                          <span>Phong độ ổn định</span>
                        </>
                      )}
                    </Typography>
                  </Card>
                </Grid>

                {/* 3. Điểm Kỷ luật số */}
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Kỷ Luật Học Tập Số
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#7c3aed', my: 0.5 }}>
                      {detailData.digitalDiscipline?.disciplineScore || 0}/100
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Nộp đúng hạn: <strong>{detailData.digitalDiscipline?.onTimeRate || 0}%</strong>
                    </Typography>
                  </Card>
                </Grid>

                {/* 4. Tỷ lệ hoàn thành */}
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Tỷ Lệ Hoàn Thành Bài
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#059669', my: 0.5 }}>
                      {detailData.summary?.completionRate || 0}%
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Đã nộp: <strong>{detailData.summary?.submittedAssignments}/{detailData.summary?.totalAssignments} bài</strong>
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* TABS NỘI DUNG 360° */}
              <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
                <Box sx={{ borderBottom: '1px solid #e2e8f0', px: 2.5, bgcolor: '#f8fafc' }}>
                  <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
                    <Tab label="Quỹ đạo Phát triển (Learning Curve)" sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab label="Radar Năng lực Đa môn" sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab label="Kỷ luật số & Nhận xét" sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab label={`Bảng điểm & Bài tập (${detailData.summary?.totalAssignments || 0})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                    <Tab label={`Sổ Can thiệp & Ghi chú (${notes.length})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                  </Tabs>
                </Box>

                <Box sx={{ p: 3 }}>
                  {/* TAB 0: LEARNING CURVE */}
                  {activeTab === 0 && (
                    <Box>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          Đường Cong Học Tập & Biến Thiên Điểm Số
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Theo dõi sự tiến bộ qua từng bài tập/bài kiểm tra đã được chấm trên Google Classroom (thang điểm chuẩn hóa 10)
                        </Typography>
                      </Box>

                      {(!detailData.learningCurve || detailData.learningCurve.length === 0) ? (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Chưa có đủ dữ liệu bài tập đã chấm điểm để vẽ đồ thị đường cong học tập.
                          </Typography>
                        </Box>
                      ) : (
                        <Box sx={{ height: 320, width: '100%', mt: 2 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={detailData.learningCurve} margin={{ top: 10, right: 30, left: -10, bottom: 20 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="title" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                              <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                              <ChartTooltip
                                content={({ active, payload }) => {
                                  if (active && payload && payload.length) {
                                    const d = payload[0].payload;
                                    return (
                                      <Box sx={{ bgcolor: '#ffffff', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                                        <Typography variant="subtitle2" fontWeight={700}>
                                          {d.title}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                                          Môn: {d.subjectName} • Ngày: {d.date}
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 800, mt: 0.5 }}>
                                          Điểm đạt: {d.score}/{d.maxPoints}đ (Chuẩn: {d.standardizedScore}đ)
                                        </Typography>
                                      </Box>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <ReferenceLine y={8} stroke="#16a34a" strokeDasharray="3 3" label={{ value: 'Mục tiêu Giỏi (8.0)', fill: '#16a34a', fontSize: 11 }} />
                              <ReferenceLine y={5} stroke="#dc2626" strokeDasharray="3 3" label={{ value: 'Chuẩn Đạt (5.0)', fill: '#dc2626', fontSize: 11 }} />
                              <Line
                                type="monotone"
                                dataKey="standardizedScore"
                                stroke="#2563eb"
                                strokeWidth={3}
                                dot={{ r: 5, fill: '#2563eb', strokeWidth: 2, stroke: '#ffffff' }}
                                activeDot={{ r: 7 }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </Box>
                      )}
                    </Box>
                  )}

                  {/* TAB 1: RADAR NĂNG LỰC ĐA MÔN */}
                  {activeTab === 1 && (
                    <Grid container spacing={3} alignItems="center">
                      <Grid size={{ xs: 12, md: 7 }}>
                        <Box sx={{ height: 320, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart data={detailData.radarSkills || []}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} />
                              <PolarRadiusAxis domain={[0, 10]} angle={30} stroke="#94a3b8" />
                              <Radar name="Điểm Năng Lực" dataKey="score" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.4} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </Box>
                      </Grid>

                      <Grid size={{ xs: 12, md: 5 }}>
                        <Stack spacing={2}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#0f172a' }}>
                              Đánh Giá Toàn Diện Các Lĩnh Vực
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Phổ năng lực đa chiều dựa trên kết quả bài tập các bộ môn
                            </Typography>
                          </Box>

                          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, bgcolor: '#f8fafc' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                              <CheckCircleIcon sx={{ fontSize: 18 }} />
                              Môn học Vượt trội / Thế mạnh:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {(detailData.subjects || [])
                                .filter((s: any) => s.averageScore >= 8.0)
                                .map((s: any) => (
                                  <Chip
                                    key={s.topicId}
                                    label={`${s.topicName}: ${s.averageScore}đ`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ fontWeight: 700 }}
                                  />
                                ))}
                            </Stack>
                          </Box>

                          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, p: 2, bgcolor: '#f8fafc' }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#ea580c', display: 'center', gap: 0.5, mb: 1 }}>
                              <WarningAmberIcon sx={{ fontSize: 18 }} />
                              Môn học Cần bồi dưỡng thêm:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                              {(detailData.subjects || [])
                                .filter((s: any) => s.averageScore < 7.0 && s.averageScore != null)
                                .map((s: any) => (
                                  <Chip
                                    key={s.topicId}
                                    label={`${s.topicName}: ${s.averageScore}đ`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ fontWeight: 700 }}
                                  />
                                ))}
                            </Stack>
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>
                  )}

                  {/* TAB 2: KỶ LUẬT SỐ & NHẬN XÉT */}
                  {activeTab === 2 && (
                    <Grid container spacing={2.5}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5, textAlign: 'center' }}>
                          <ShieldIcon sx={{ fontSize: 44, color: '#2563eb', mb: 1 }} />
                          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0f172a' }}>
                            {detailData.digitalDiscipline?.disciplineScore || 0}/100
                          </Typography>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#64748b', mt: 0.5 }}>
                            Chỉ Số Kỷ Luật Số
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1 }}>
                            {detailData.digitalDiscipline?.habitAssessment}
                          </Typography>
                        </Card>
                      </Grid>

                      <Grid size={{ xs: 12, md: 8 }}>
                        <Stack spacing={2}>
                          <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                Bài tập nộp đúng hạn ({detailData.digitalDiscipline?.onTimeCount} bài)
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="#16a34a">
                                {detailData.digitalDiscipline?.onTimeRate}%
                              </Typography>
                            </Stack>
                            <LinearProgress variant="determinate" value={detailData.digitalDiscipline?.onTimeRate || 0} color="success" sx={{ height: 8, borderRadius: 4 }} />
                          </Box>

                          <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                Bài tập nộp muộn sau deadline ({detailData.digitalDiscipline?.lateCount} bài)
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="#ea580c">
                                {detailData.summary?.submittedAssignments > 0
                                  ? Math.round((detailData.digitalDiscipline?.lateCount / detailData.summary?.submittedAssignments) * 100)
                                  : 0}
                                %
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={
                                detailData.summary?.submittedAssignments > 0
                                  ? Math.round((detailData.digitalDiscipline?.lateCount / detailData.summary?.submittedAssignments) * 100)
                                  : 0
                              }
                              color="warning"
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>

                          <Box sx={{ p: 2, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                              <Typography variant="body2" fontWeight={600}>
                                Bài tập còn thiếu / Chưa nộp ({detailData.digitalDiscipline?.missingCount} bài)
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="#dc2626">
                                {detailData.summary?.totalAssignments > 0
                                  ? Math.round((detailData.digitalDiscipline?.missingCount / detailData.summary?.totalAssignments) * 100)
                                  : 0}
                                %
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={
                                detailData.summary?.totalAssignments > 0
                                  ? Math.round((detailData.digitalDiscipline?.missingCount / detailData.summary?.totalAssignments) * 100)
                                  : 0
                              }
                              color="error"
                              sx={{ height: 8, borderRadius: 4 }}
                            />
                          </Box>
                        </Stack>
                      </Grid>
                    </Grid>
                  )}

                  {/* TAB 3: BẢNG ĐIỂM & BÀI TẬP */}
                  {activeTab === 3 && (
                    <Box>
                      <TableContainer sx={{ maxHeight: 420 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Tên bài tập</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Môn học</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Hạn nộp</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}>Trạng thái</TableCell>
                              <TableCell sx={{ fontWeight: 700, bgcolor: '#f8fafc' }} align="right">
                                Điểm số
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {(detailData.subjects || []).flatMap((s: any) =>
                              (s.assignments || []).map((a: any) => (
                                <TableRow key={a.id} hover>
                                  <TableCell sx={{ fontWeight: 600, color: '#0f172a' }}>{a.title}</TableCell>
                                  <TableCell>
                                    <Chip label={s.subjectCode || s.topicName} size="small" sx={{ fontSize: '0.75rem', fontWeight: 600 }} />
                                  </TableCell>
                                  <TableCell sx={{ color: '#64748b', fontSize: '0.8rem' }}>{a.dueDate || 'Không thời hạn'}</TableCell>
                                  <TableCell>
                                    {a.state === 'TURNED_IN' ? (
                                      <Chip
                                        label={a.isLate ? 'Nộp muộn' : 'Đã nộp'}
                                        size="small"
                                        color={a.isLate ? 'warning' : 'success'}
                                        sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                                      />
                                    ) : (
                                      <Chip label="Chưa nộp" size="small" color="error" variant="outlined" sx={{ fontWeight: 700, fontSize: '0.72rem' }} />
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    {a.assignedGrade != null ? (
                                      <Chip
                                        label={`${a.assignedGrade}/${a.maxPoints}đ`}
                                        size="small"
                                        sx={{
                                          fontWeight: 800,
                                          bgcolor: a.assignedGrade >= 8 ? '#f0fdf4' : a.assignedGrade >= 6.5 ? '#eff6ff' : '#fef2f2',
                                          color: a.assignedGrade >= 8 ? '#15803d' : a.assignedGrade >= 6.5 ? '#1d4ed8' : '#b91c1c'
                                        }}
                                      />
                                    ) : (
                                      <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                        Chờ chấm
                                      </Typography>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* TAB 4: SỔ CAN THIỆP & GHI CHÚ SƯ PHẠM */}
                  {activeTab === 4 && (
                    <Box>
                      <Box sx={{ mb: 2.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0f172a' }}>
                          Sổ Can Thiệp Sư Phạm & Kế Hoạch Đồng Hành Cá Nhân
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Ghi lại các hành động đôn đốc, trao đổi với gia đình và kế hoạch bồi dưỡng học sinh
                        </Typography>
                      </Box>

                      {/* KHỐI NHẬP GHI CHÚ MỚI */}
                      <Card variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5, bgcolor: '#f8fafc' }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: '#1e293b' }}>
                          Thêm hành động can thiệp / ghi chú mới
                        </Typography>
                        <Grid container spacing={1.5} alignItems="center">
                          <Grid size={{ xs: 12, sm: 3 }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={newNoteTag}
                                onChange={(e) => setNewNoteTag(e.target.value)}
                                sx={{ bgcolor: '#fff', borderRadius: 1.5 }}
                              >
                                <MenuItem value="Đôn đốc">📢 Đôn đốc nộp bài</MenuItem>
                                <MenuItem value="Trao đổi PH">📞 Gọi điện cho Phụ huynh</MenuItem>
                                <MenuItem value="Kèm cặp">🤝 Đôi bạn cùng tiến</MenuItem>
                                <MenuItem value="Gia hạn">⏳ Gia hạn nộp bài</MenuItem>
                                <MenuItem value="Khen thưởng">⭐ Đề xuất khen thưởng</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid size={{ xs: 12, sm: 7 }}>
                            <TextField
                              size="small"
                              fullWidth
                              placeholder="Nội dung can thiệp (VD: Đã trao đổi với mẹ em tối qua, hẹn thứ 5 nộp bù 2 bài Toán...)"
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              sx={{ bgcolor: '#fff', borderRadius: 1.5 }}
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 2 }}>
                            <Button
                              variant="contained"
                              color="primary"
                              fullWidth
                              startIcon={<NoteAltIcon />}
                              onClick={handleSaveNote}
                              disabled={!newNoteContent.trim()}
                              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, bgcolor: '#2563eb' }}
                            >
                              Lưu
                            </Button>
                          </Grid>
                        </Grid>
                      </Card>

                      {/* DANH SÁCH GHI CHÚ ĐÃ LƯU */}
                      {notes.length === 0 ? (
                        <Box sx={{ py: 6, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                          <NoteAltIcon sx={{ fontSize: 40, color: '#94a3b8', mb: 1 }} />
                          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
                            Chưa có ghi chú can thiệp nào cho học sinh này.
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Thêm ghi chú ở trên để lưu vết lịch sử sư phạm của học sinh.
                          </Typography>
                        </Box>
                      ) : (
                        <Stack spacing={1.5}>
                          {notes.map((n) => (
                            <Card key={n.id} variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                                  <Chip
                                    label={n.tag}
                                    size="small"
                                    color={n.tag === 'Khen thưởng' ? 'success' : n.tag === 'Trao đổi PH' ? 'primary' : 'warning'}
                                    sx={{ fontWeight: 700, fontSize: '0.72rem' }}
                                  />
                                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                                    {n.date}
                                  </Typography>
                                </Stack>
                                <Typography variant="body2" sx={{ color: '#1e293b', fontWeight: 500 }}>
                                  {n.content}
                                </Typography>
                              </Box>
                              <Button
                                size="small"
                                color="error"
                                onClick={() => handleDeleteNote(n.id)}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', minWidth: 0, p: 0.5 }}
                              >
                                Xóa
                              </Button>
                            </Card>
                          ))}
                        </Stack>
                      )}
                    </Box>
                  )}
                </Box>
              </Card>
            </Stack>
          )}
        </Grid>
      </Grid>

      {/* DIALOG: MẪU TIN NHẮN BÁO CÁO PHỤ HUYNH */}
      <Dialog open={openParentDialog} onClose={() => setOpenParentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800, color: '#0f172a' }}>
          Mẫu Tin Nhắn Gửi Phụ Huynh Học Sinh (Zalo / SMS)
        </DialogTitle>
        <DialogContent dividers>
          <TextField
            multiline
            rows={10}
            fullWidth
            value={parentMessageText}
            InputProps={{ readOnly: true }}
            sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenParentDialog(false)} sx={{ textTransform: 'none', color: '#64748b' }}>
            Đóng
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={copiedMessage ? <CheckIcon /> : <ContentCopyIcon />}
            onClick={handleCopyMessage}
            sx={{ fontWeight: 700, textTransform: 'none', borderRadius: 2, bgcolor: '#2563eb' }}
          >
            {copiedMessage ? 'Đã sao chép vào bộ nhớ!' : 'Sao chép tin nhắn'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
