import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Avatar,
  Typography,
  Chip,
  Card,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  Stack,
  CircularProgress,
  Tabs,
  Tab,
  LinearProgress,
  Alert
} from '@mui/material';
import SearchIcon from '@mui/icons-material/SearchRounded';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export default function StudentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [studentDetail, setStudentDetail] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const loadStudents = async () => {
    setLoading(true);
    try {
      const res = await api<{ total: number; items: any[] }>('/api/people/students');
      setItems(res.items || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (s) =>
        (s.displayName && s.displayName.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q)) ||
        (s.className && s.className.toLowerCase().includes(q)) ||
        (s.classId && s.classId.toLowerCase().includes(q))
    );
  }, [items, search]);

  const handleOpenDetail = async (student: any) => {
    setSelectedStudent(student);
    setDetailLoading(true);
    setActiveTab(0);
    try {
      const res = await api<any>(`/api/people/students/${student.personId || student.id}`);
      setStudentDetail(res);
    } catch {
      setStudentDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedStudent(null);
    setStudentDetail(null);
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Danh bạ & Hồ sơ Học sinh"
        subtitle="Quản lý danh sách học sinh toàn trường, theo dõi tiến độ nộp bài và kết quả học tập trực tiếp từ Google Classroom."
        icon={<SchoolIcon />}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Tải lại danh sách">
              <IconButton onClick={loadStudents} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        }
      />

      {/* Toolbar & Tìm kiếm */}
      <Card sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
          <TextField
            size="small"
            placeholder="Tìm theo tên học sinh, email, lớp học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              )
            }}
            sx={{ flex: 1, minWidth: { xs: '100%', sm: 320 } }}
          />
          <Chip
            label={`Tìm thấy ${filteredItems.length} học sinh`}
            size="small"
            sx={{ fontWeight: 600, bgcolor: '#eff6ff', color: '#1d4ed8' }}
          />
        </Stack>
      </Card>

      {/* Bảng Danh sách Học sinh */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <TableContainer>
          <Table sx={{ minWidth: 800 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Học sinh</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Email Google</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Lớp học</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Đơn vị tổ chức</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Khóa học</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.8125rem' }}>Hành động</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" sx={{ mt: 1.5, color: '#64748b' }}>Đang tải danh bạ học sinh...</Typography>
                  </TableCell>
                </TableRow>
              ) : filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: 6, textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">Không tìm thấy học sinh nào phù hợp.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((s) => {
                  const name = s.displayName || s.name || s.email?.split('@')[0] || 'Học sinh';
                  const courseCount = Array.isArray(s.courses) ? s.courses.length : 0;
                  return (
                    <TableRow
                      key={s.personId || s.id}
                      hover
                      onClick={() => handleOpenDetail(s)}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
                    >
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar
                            src={s.photoUrl}
                            sx={{ width: 36, height: 36, bgcolor: '#2563eb', fontWeight: 700, fontSize: '0.875rem' }}
                          >
                            {name[0]?.toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#0f172a' }}>
                              {name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              ID: {s.personId || s.id}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: '#2563eb', fontWeight: 500 }}>
                          {s.email || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {s.className || s.classId ? (
                          <Chip
                            label={s.className || `Lớp ${s.classId}`}
                            size="small"
                            sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 600, fontSize: '0.75rem' }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>Chưa phân lớp</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" sx={{ color: '#475569' }}>
                          {s.orgUnitPath || 'Toàn trường'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`${courseCount} khóa`}
                          size="small"
                          variant="outlined"
                          sx={{ borderColor: '#cbd5e1', fontWeight: 600, fontSize: '0.75rem' }}
                        />
                      </TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <Tooltip title="Xem chi tiết học sinh & bài tập">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityRoundedIcon sx={{ fontSize: 16 }} />}
                            onClick={() => handleOpenDetail(s)}
                            sx={{ fontSize: '0.75rem', py: 0.4, px: 1.2, borderRadius: 1.5, fontWeight: 600, textTransform: 'none' }}
                          >
                            Chi tiết
                          </Button>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* DIALOG CHI TIẾT HỌC SINH & BÀI TẬP */}
      <Dialog
        open={Boolean(selectedStudent)}
        onClose={handleCloseDetail}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '16px' } }}
      >
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar
              src={studentDetail?.photoUrl || selectedStudent?.photoUrl}
              sx={{ width: 48, height: 48, bgcolor: '#2563eb', fontWeight: 700, fontSize: '1.25rem' }}
            >
              {(studentDetail?.displayName || selectedStudent?.displayName || 'H')[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6" fontWeight={700} sx={{ color: '#0f172a' }}>
                  {studentDetail?.displayName || selectedStudent?.displayName || selectedStudent?.name || 'Hồ sơ học sinh'}
                </Typography>
                <Chip
                  label={studentDetail?.className || selectedStudent?.className || 'Chưa phân lớp'}
                  size="small"
                  sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: '#64748b' }}>
                {studentDetail?.email || selectedStudent?.email}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 3, borderColor: '#e2e8f0' }}>
          {detailLoading ? (
            <Box sx={{ py: 8, textAlign: 'center' }}>
              <CircularProgress size={36} />
              <Typography variant="body2" sx={{ mt: 2, color: '#64748b' }}>Đang nạp dữ liệu bài tập và điểm số từ Google Classroom...</Typography>
            </Box>
          ) : studentDetail ? (
            <Stack spacing={3}>
              {/* Thẻ KPI tổng hợp của học sinh */}
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Điểm Trung Bình (GPA)
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: '#2563eb', my: 0.5 }}>
                      {studentDetail.summary?.gpa != null ? studentDetail.summary.gpa : '—'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#059669', fontWeight: 600 }}>
                      {studentDetail.summary?.rank || 'Chưa xếp hạng'}
                    </Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Tỷ lệ nộp bài
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: '#059669', my: 0.5 }}>
                      {studentDetail.summary?.completionRate ?? 0}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Chỉ tiêu: ≥ 70%
                    </Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Bài đã nộp
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: '#0f172a', my: 0.5 }}>
                      {studentDetail.summary?.submittedAssignments ?? 0}/{studentDetail.summary?.totalAssignments ?? 0}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Bài tập Google Classroom
                    </Typography>
                  </Card>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Card variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: '#f8fafc' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                      Số môn tham gia
                    </Typography>
                    <Typography variant="h5" fontWeight={800} sx={{ color: '#7c3aed', my: 0.5 }}>
                      {studentDetail.summary?.totalSubjects ?? 0} môn
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Khóa học đang hoạt động
                    </Typography>
                  </Card>
                </Grid>
              </Grid>

              {/* Tabs chuyển đổi giữa Môn học và Bài tập chi tiết */}
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs value={activeTab} onChange={(_, val) => setActiveTab(val)}>
                  <Tab label={`Môn học & Tiến độ (${studentDetail.subjects?.length || 0})`} sx={{ textTransform: 'none', fontWeight: 700 }} />
                  <Tab label="Danh sách Bài tập & Điểm số" sx={{ textTransform: 'none', fontWeight: 700 }} />
                </Tabs>
              </Box>

              {/* Tab 0: Bảng môn học */}
              {activeTab === 0 && (
                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Khóa học / Bộ môn</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Giáo viên</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Bài tập đã giao</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Tiến độ nộp bài</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Điểm TB</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Đánh giá</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(studentDetail.subjects || []).length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} sx={{ py: 3, textAlign: 'center', color: '#64748b' }}>
                            Chưa có khóa học nào được đồng bộ cho học sinh này.
                          </TableCell>
                        </TableRow>
                      ) : (
                        studentDetail.subjects.map((sub: any) => (
                          <TableRow key={sub.topicId} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                                {sub.topicName}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: '#475569' }}>{sub.teacherName || '—'}</TableCell>
                            <TableCell>
                              <Typography variant="body2">
                                {sub.submittedCount}/{sub.totalAssignments} bài
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ minWidth: 120 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LinearProgress
                                  variant="determinate"
                                  value={sub.completionRate || 0}
                                  sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: '#f1f5f9' }}
                                />
                                <Typography variant="caption" fontWeight={600}>
                                  {sub.completionRate}%
                                </Typography>
                              </Box>
                            </TableCell>
                            <TableCell>
                              {sub.averageScore != null ? (
                                <Chip
                                  label={sub.averageScore}
                                  size="small"
                                  sx={{
                                    bgcolor: sub.averageScore >= 8 ? '#ecfdf5' : '#eff6ff',
                                    color: sub.averageScore >= 8 ? '#059669' : '#1d4ed8',
                                    fontWeight: 700
                                  }}
                                />
                              ) : (
                                <Typography variant="caption" color="text.secondary">—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {sub.evaluation}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Tab 1: Danh sách tất cả bài tập */}
              {activeTab === 1 && (
                <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                  <Table size="small">
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Tên bài tập</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Môn học</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Hạn nộp</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Trạng thái</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Điểm số</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(() => {
                        const allAssignments = (studentDetail.subjects || []).flatMap((s: any) =>
                          (s.assignments || []).map((a: any) => ({ ...a, subjectName: s.topicName }))
                        );
                        if (allAssignments.length === 0) {
                          return (
                            <TableRow>
                              <TableCell colSpan={5} sx={{ py: 3, textAlign: 'center', color: '#64748b' }}>
                                Chưa có bài tập nào được giao trên Google Classroom.
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return allAssignments.map((a: any) => (
                          <TableRow key={a.id} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={600} sx={{ color: '#0f172a' }}>
                                {a.title}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: '#475569' }}>{a.subjectName}</TableCell>
                            <TableCell sx={{ color: '#64748b', fontSize: '0.8125rem' }}>{a.dueDate || 'Không có hạn'}</TableCell>
                            <TableCell>
                              {a.state === 'TURNED_IN' || a.state === 'RETURNED' ? (
                                <Chip
                                  icon={<CheckCircleRoundedIcon sx={{ fontSize: '13px !important' }} />}
                                  label={a.isLate ? 'Nộp muộn' : 'Đã nộp bài'}
                                  size="small"
                                  sx={{
                                    bgcolor: a.isLate ? '#fff7ed' : '#ecfdf5',
                                    color: a.isLate ? '#c2410c' : '#059669',
                                    fontWeight: 700,
                                    fontSize: '0.7rem'
                                  }}
                                />
                              ) : (
                                <Chip
                                  icon={<ErrorOutlineRoundedIcon sx={{ fontSize: '13px !important' }} />}
                                  label="Chưa nộp"
                                  size="small"
                                  sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 700, fontSize: '0.7rem' }}
                                />
                              )}
                            </TableCell>
                            <TableCell align="right">
                              {a.assignedGrade != null ? (
                                <Typography variant="body2" fontWeight={700} sx={{ color: '#2563eb' }}>
                                  {a.assignedGrade}/{a.maxPoints}
                                </Typography>
                              ) : (
                                <Typography variant="caption" sx={{ color: '#94a3b8' }}>Chưa chấm</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          ) : (
            <Alert severity="warning">Không thể nạp hồ sơ học sinh từ cơ sở dữ liệu.</Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={handleCloseDetail} sx={{ textTransform: 'none', color: '#64748b' }}>
            Đóng
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
