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
  MenuItem,
  Pagination,
  Select,
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
  CircularProgress
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/SchoolRounded';
import AddIcon from '@mui/icons-material/AddRounded';
import EditIcon from '@mui/icons-material/EditRounded';
import DeleteIcon from '@mui/icons-material/DeleteOutlineRounded';
import SearchIcon from '@mui/icons-material/SearchRounded';
import RefreshIcon from '@mui/icons-material/RefreshRounded';
import CloudSyncIcon from '@mui/icons-material/CloudSyncRounded';
import PersonOutlineIcon from '@mui/icons-material/PersonOutlineRounded';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoomRounded';
import GroupIcon from '@mui/icons-material/GroupRounded';
import MenuBookIcon from '@mui/icons-material/MenuBookRounded';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';

export interface ClassItem {
  id: string;
  classId: string;
  className: string;
  grade: number | null;
  source: 'MANUAL' | 'CLASSROOM_SYNC' | string;
  active: boolean;
  homeroomTeacher: string;
  teacherEmail: string;
  room: string;
  expectedStudents: number;
  studentCount: number;
  courseCount: number;
  courses: string[];
  subjects: Array<{ name: string }>;
  totalCoursework: number;
  submissionsTotal: number;
  submissionsTurnedIn: number;
  submissionsLate: number;
  completionRate: number;
  onTimeRate: number;
  averageScore: number | null;
  updatedAt?: string;
}

const GRADES = [
  { value: 'all', label: 'Tất cả các khối' },
  { value: '6', label: 'Khối 6' },
  { value: '7', label: 'Khối 7' },
  { value: '8', label: 'Khối 8' },
  { value: '9', label: 'Khối 9' },
  { value: '10', label: 'Khối 10' },
  { value: '11', label: 'Khối 11' },
  { value: '12', label: 'Khối 12' }
];

export default function ClassesPage() {
  const [items, setItems] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;

  // Dialog States
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);

  // Form States
  const [formClassName, setFormClassName] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formGrade, setFormGrade] = useState<number | ''>('');
  const [formTeacher, setFormTeacher] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formStudents, setFormStudents] = useState<number | ''>(40);
  const [formRoom, setFormRoom] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Toast State
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' } | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    try {
      const qs = selectedGrade !== 'all' ? `?grade=${selectedGrade}` : '';
      const res = await api<{ total: number; items: ClassItem[] }>(`/api/classes${qs}`);
      setItems(res.items || []);
    } catch (err: any) {
      setToast({ message: `Không thể tải danh sách lớp học: ${err.message}`, severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadClasses();
  }, [selectedGrade]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (c) =>
        c.className.toLowerCase().includes(q) ||
        c.classId.toLowerCase().includes(q) ||
        (c.homeroomTeacher && c.homeroomTeacher.toLowerCase().includes(q)) ||
        (c.room && c.room.toLowerCase().includes(q)) ||
        (c.teacherEmail && c.teacherEmail.toLowerCase().includes(q))
    );
  }, [items, search]);

  const pagedItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, page]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage) || 1;

  // Reset page on search or grade change
  useEffect(() => {
    setPage(1);
  }, [search, selectedGrade]);

  // Open Create Dialog
  const handleOpenCreate = () => {
    setFormClassName('');
    setFormClassId('');
    setFormGrade(selectedGrade !== 'all' ? Number(selectedGrade) : 6);
    setFormTeacher('');
    setFormEmail('');
    setFormStudents(40);
    setFormRoom('');
    setFormError('');
    setOpenCreateDialog(true);
  };

  // Submit Create Class
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formClassName.trim()) {
      setFormError('Vui lòng nhập tên lớp học.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      await api.post('/api/classes', {
        className: formClassName.trim(),
        classId: formClassId.trim() || undefined,
        grade: formGrade !== '' ? Number(formGrade) : undefined,
        homeroomTeacher: formTeacher.trim() || undefined,
        teacherEmail: formEmail.trim() || undefined,
        expectedStudents: formStudents !== '' ? Number(formStudents) : undefined,
        room: formRoom.trim() || undefined
      });

      setToast({ message: `Đã thêm lớp "${formClassName.trim()}" thành công!`, severity: 'success' });
      setOpenCreateDialog(false);
      loadClasses();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi tạo lớp học.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Edit Dialog
  const handleOpenEdit = (cls: ClassItem) => {
    setSelectedClass(cls);
    setFormClassName(cls.className);
    setFormClassId(cls.classId);
    setFormGrade(cls.grade ?? '');
    setFormTeacher(cls.homeroomTeacher === 'Chưa phân công' ? '' : cls.homeroomTeacher);
    setFormEmail(cls.teacherEmail || '');
    setFormStudents(cls.expectedStudents || 40);
    setFormRoom(cls.room || '');
    setFormError('');
    setOpenEditDialog(true);
  };

  // Submit Edit Class
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!formClassName.trim()) {
      setFormError('Vui lòng nhập tên lớp học.');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      await api.patch(`/api/classes/${encodeURIComponent(selectedClass.classId)}`, {
        className: formClassName.trim(),
        grade: formGrade !== '' ? Number(formGrade) : undefined,
        homeroomTeacher: formTeacher.trim() || undefined,
        teacherEmail: formEmail.trim() || undefined,
        expectedStudents: formStudents !== '' ? Number(formStudents) : undefined,
        room: formRoom.trim() || undefined
      });

      setToast({ message: `Đã cập nhật lớp "${formClassName.trim()}" thành công!`, severity: 'success' });
      setOpenEditDialog(false);
      loadClasses();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi cập nhật lớp học.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Open Delete Dialog
  const handleOpenDelete = (cls: ClassItem) => {
    setSelectedClass(cls);
    setFormError('');
    setOpenDeleteDialog(true);
  };

  // Submit Delete Class
  const handleDeleteSubmit = async () => {
    if (!selectedClass) return;
    setFormSubmitting(true);
    setFormError('');

    try {
      await api.delete(`/api/classes/${encodeURIComponent(selectedClass.classId)}`);
      setToast({ message: `Đã xoá lớp "${selectedClass.className}" thành công!`, severity: 'success' });
      setOpenDeleteDialog(false);
      loadClasses();
    } catch (err: any) {
      setFormError(err.message || 'Không thể xoá lớp học này.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Quản lý Lớp học & Sĩ số"
        subtitle="Danh sách các lớp học toàn trường từ Google Classroom và lớp tạo thủ công, quản lý phân công GVCN và sĩ số."
        action={
          <Stack direction="row" spacing={1.5}>
            <Tooltip title="Làm mới dữ liệu">
              <IconButton onClick={loadClasses} sx={{ bgcolor: '#fff', border: '1px solid #e2e8f0' }} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenCreate}
              sx={{
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' },
                fontWeight: 600,
                textTransform: 'none',
                borderRadius: 2,
                px: 2.5
              }}
            >
              Thêm lớp học
            </Button>
          </Stack>
        }
      />

      {/* Bộ lọc & Tìm kiếm */}
      <Card
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 2,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ flex: 1, minWidth: { xs: '100%', sm: 320 } }}>
          <TextField
            size="small"
            placeholder="Tìm theo tên lớp, GVCN, phòng học..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                </InputAdornment>
              )
            }}
            sx={{ flex: 1, minWidth: 240 }}
          />

          <Select
            size="small"
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            sx={{ minWidth: 160 }}
          >
            {GRADES.map((g) => (
              <MenuItem key={g.value} value={g.value}>
                {g.label}
              </MenuItem>
            ))}
          </Select>
        </Stack>

        <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 500 }}>
          Tìm thấy <strong style={{ color: '#0f172a' }}>{filteredItems.length}</strong> lớp học
        </Typography>
      </Card>

      {/* Bảng danh sách lớp */}
      <Card sx={{ borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        <TableContainer>
          <Table sx={{ minWidth: 850 }}>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Tên Lớp</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Khối</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Nguồn dữ liệu</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Sĩ số</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Giáo viên Chủ nhiệm</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Phòng học</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Khóa học Classroom</TableCell>
                <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Tỷ lệ nộp bài</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: '#475569', fontSize: '0.85rem' }}>Thao tác</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={9} sx={{ py: 2 }}>
                      <Skeleton variant="text" width="100%" height={28} />
                    </TableCell>
                  </TableRow>
                ))
              ) : pagedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ py: 6, textAlign: 'center' }}>
                    <Box sx={{ display: 'inline-flex', p: 2, borderRadius: '50%', bgcolor: '#f1f5f9', mb: 1.5 }}>
                      <SchoolIcon sx={{ fontSize: 36, color: '#94a3b8' }} />
                    </Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#334155' }}>
                      Không có lớp học nào phù hợp
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      Thử thay đổi bộ lọc khối hoặc từ khoá tìm kiếm, hoặc bấm "+ Thêm lớp học" để tạo mới.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                pagedItems.map((cls) => {
                  const isManual = cls.source === 'MANUAL';
                  return (
                    <TableRow
                      key={cls.classId}
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      {/* Tên Lớp */}
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: 2,
                              bgcolor: isManual ? '#f5f3ff' : '#eff6ff',
                              color: isManual ? '#7c3aed' : '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            <SchoolIcon fontSize="small" />
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                              {cls.className}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>
                              Mã: {cls.classId}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>

                      {/* Khối */}
                      <TableCell>
                        <Chip
                          label={cls.grade ? `Khối ${cls.grade}` : 'Chưa phân khối'}
                          size="small"
                          sx={{
                            bgcolor: '#f1f5f9',
                            color: '#334155',
                            fontWeight: 600,
                            borderRadius: 1.5
                          }}
                        />
                      </TableCell>

                      {/* Nguồn */}
                      <TableCell>
                        {isManual ? (
                          <Chip
                            icon={<PersonOutlineIcon sx={{ fontSize: '14px !important' }} />}
                            label="Thủ công"
                            size="small"
                            sx={{
                              bgcolor: '#faf5ff',
                              color: '#7e22ce',
                              border: '1px solid #e9d5ff',
                              fontWeight: 600,
                              borderRadius: 1.5
                            }}
                          />
                        ) : (
                          <Chip
                            icon={<CloudSyncIcon sx={{ fontSize: '14px !important' }} />}
                            label="Tự động"
                            size="small"
                            sx={{
                              bgcolor: '#ecfdf5',
                              color: '#047857',
                              border: '1px solid #a7f3d0',
                              fontWeight: 600,
                              borderRadius: 1.5
                            }}
                          />
                        )}
                      </TableCell>

                      {/* Sĩ số */}
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <GroupIcon sx={{ fontSize: 16, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            {cls.expectedStudents || cls.studentCount || 0} HS
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* GVCN */}
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e293b' }}>
                          {cls.homeroomTeacher || 'Chưa phân công'}
                        </Typography>
                        {cls.teacherEmail && (
                          <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                            {cls.teacherEmail}
                          </Typography>
                        )}
                      </TableCell>

                      {/* Phòng */}
                      <TableCell>
                        <Typography variant="body2" sx={{ color: cls.room ? '#1e293b' : '#94a3b8' }}>
                          {cls.room || '—'}
                        </Typography>
                      </TableCell>

                      {/* Khóa học */}
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <MenuBookIcon sx={{ fontSize: 16, color: '#64748b' }} />
                          <Typography variant="body2" sx={{ color: '#1e293b' }}>
                            {cls.courseCount || 0} khóa
                          </Typography>
                        </Stack>
                      </TableCell>

                      {/* Tỷ lệ nộp bài */}
                      <TableCell>
                        {cls.completionRate ? (
                          <Chip
                            label={`${cls.completionRate}%`}
                            size="small"
                            sx={{
                              bgcolor: cls.completionRate >= 70 ? '#f0fdf4' : cls.completionRate >= 50 ? '#fefce8' : '#fef2f2',
                              color: cls.completionRate >= 70 ? '#15803d' : cls.completionRate >= 50 ? '#a16207' : '#b91c1c',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              borderRadius: 1.5
                            }}
                          />
                        ) : (
                          <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                            Chưa có dữ liệu
                          </Typography>
                        )}
                      </TableCell>

                      {/* Thao tác */}
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Chỉnh sửa thông tin">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenEdit(cls)}
                              sx={{ color: '#475569', '&:hover': { color: '#2563eb', bgcolor: '#eff6ff' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Xoá lớp học">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenDelete(cls)}
                              sx={{ color: '#94a3b8', '&:hover': { color: '#dc2626', bgcolor: '#fef2f2' } }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Phân trang */}
        {filteredItems.length > rowsPerPage && (
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

      {/* DIALOG: Thêm mới lớp học */}
      <Dialog open={openCreateDialog} onClose={() => !formSubmitting && setOpenCreateDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleCreateSubmit}>
          <DialogTitle sx={{ fontWeight: 700, color: '#0f172a' }}>Thêm lớp học thủ công</DialogTitle>
          <DialogContent dividers>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <TextField
                label="Tên Lớp học *"
                placeholder="VD: 12A1, 6A, 10 Chuyên Tin"
                value={formClassName}
                onChange={(e) => setFormClassName(e.target.value)}
                required
                autoFocus
                fullWidth
                size="small"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Mã Lớp (tùy chọn)"
                  placeholder="Tự động nếu để trống"
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Mã duy nhất phân biệt lớp"
                />

                <TextField
                  select
                  label="Khối học"
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Không phân khối</MenuItem>
                  {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <MenuItem key={g} value={g}>
                      Khối {g}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Giáo viên Chủ nhiệm"
                  placeholder="Họ và tên GVCN"
                  value={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.value)}
                  fullWidth
                  size="small"
                />

                <TextField
                  label="Email GVCN"
                  type="email"
                  placeholder="gv@thcs-giangvo.edu.vn"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Sĩ số học sinh dự kiến"
                  type="number"
                  value={formStudents}
                  onChange={(e) => setFormStudents(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 100 }}
                />

                <TextField
                  label="Phòng học"
                  placeholder="VD: Phòng 201, Nhà A"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MeetingRoomIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenCreateDialog(false)} disabled={formSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formSubmitting}
              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', px: 3 }}
            >
              {formSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Tạo lớp học'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIALOG: Chỉnh sửa lớp học */}
      <Dialog open={openEditDialog} onClose={() => !formSubmitting && setOpenEditDialog(false)} maxWidth="sm" fullWidth>
        <form onSubmit={handleEditSubmit}>
          <DialogTitle sx={{ fontWeight: 700, color: '#0f172a' }}>
            Chỉnh sửa lớp {selectedClass?.className}
          </DialogTitle>
          <DialogContent dividers>
            {formError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formError}
              </Alert>
            )}
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <TextField
                label="Tên Lớp học *"
                value={formClassName}
                onChange={(e) => setFormClassName(e.target.value)}
                required
                fullWidth
                size="small"
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Mã Lớp"
                  value={formClassId}
                  disabled
                  fullWidth
                  size="small"
                  helperText="Mã lớp không thể thay đổi sau khi tạo"
                />

                <TextField
                  select
                  label="Khối học"
                  value={formGrade}
                  onChange={(e) => setFormGrade(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="">Không phân khối</MenuItem>
                  {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                    <MenuItem key={g} value={g}>
                      Khối {g}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Giáo viên Chủ nhiệm"
                  placeholder="Họ và tên GVCN"
                  value={formTeacher}
                  onChange={(e) => setFormTeacher(e.target.value)}
                  fullWidth
                  size="small"
                />

                <TextField
                  label="Email GVCN"
                  type="email"
                  placeholder="gv@thcs-giangvo.edu.vn"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Sĩ số học sinh dự kiến"
                  type="number"
                  value={formStudents}
                  onChange={(e) => setFormStudents(e.target.value === '' ? '' : Number(e.target.value))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 100 }}
                />

                <TextField
                  label="Phòng học"
                  placeholder="VD: Phòng 201, Nhà A"
                  value={formRoom}
                  onChange={(e) => setFormRoom(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MeetingRoomIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
                      </InputAdornment>
                    )
                  }}
                />
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenEditDialog(false)} disabled={formSubmitting} sx={{ textTransform: 'none' }}>
              Hủy
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={formSubmitting}
              sx={{ bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' }, textTransform: 'none', px: 3 }}
            >
              {formSubmitting ? <CircularProgress size={22} color="inherit" /> : 'Lưu thay đổi'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* DIALOG: Xác nhận xoá lớp */}
      <Dialog open={openDeleteDialog} onClose={() => !formSubmitting && setOpenDeleteDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: '#dc2626' }}>Xác nhận xoá lớp học</DialogTitle>
        <DialogContent dividers>
          {formError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {formError}
            </Alert>
          ) : (
            <Typography variant="body2" sx={{ color: '#334155' }}>
              Bạn có chắc chắn muốn xoá lớp <strong>{selectedClass?.className}</strong> ({selectedClass?.classId}) không?
              Hành động này sẽ không thể hoàn tác nếu không còn dữ liệu liên kết.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setOpenDeleteDialog(false)} disabled={formSubmitting} sx={{ textTransform: 'none' }}>
            Hủy
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteSubmit}
            disabled={formSubmitting}
            sx={{ textTransform: 'none' }}
          >
            {formSubmitting ? <CircularProgress size={20} color="inherit" /> : 'Xác nhận xoá'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Thông báo Toast */}
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
