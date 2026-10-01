import { useEffect, useState, useMemo } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudCog,
  Copy,
  DoorOpen,
  Loader2,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  School,
  Search,
  Trash2,
  User,
  Users,
  BookOpen,
  Megaphone,
  RotateCw
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Toast, type ToastState } from '../../components/Toast';
import { api } from '../../services/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

function KpiCard({ label, value, valueClassName, caption }: { label: string; value: string; valueClassName?: string; caption: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={cn('my-1 text-[1.75rem] font-extrabold text-[#0f172a]', valueClassName)}>{value}</p>
      <p className="text-xs text-slate-500">{caption}</p>
    </div>
  );
}

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
  const [toast, setToast] = useState<ToastState | null>(null);

  // Nudge Center State
  const [openNudgeDialog, setOpenNudgeDialog] = useState(false);
  const [nudgeTargetClass, setNudgeTargetClass] = useState('all');
  const [nudgeSubmitting, setNudgeSubmitting] = useState(false);

  // Parent Message Template State
  const [openParentDialog, setOpenParentDialog] = useState(false);
  const [parentTemplate, setParentTemplate] = useState('');
  const [parentTargetClass, setParentTargetClass] = useState<ClassItem | null>(null);
  const [parentLoading, setParentLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sync Metrics State
  const [syncingMetrics, setSyncingMetrics] = useState(false);

  // Handle Nudge Submit
  const handleNudgeSubmit = async () => {
    setNudgeSubmitting(true);
    try {
      const res = await api.post<{ ok: boolean; message: string; nudgedCount: number }>('/api/classes/nudge', {
        classId: nudgeTargetClass
      });
      setToast({ message: res.message || 'Đã phát lệnh đôn đốc nộp bài thành công!', severity: 'success' });
      setOpenNudgeDialog(false);
    } catch (err: any) {
      setToast({ message: `Lỗi đôn đốc: ${err.message}`, severity: 'error' });
    } finally {
      setNudgeSubmitting(false);
    }
  };

  // Open Parent Nudge Dialog
  const handleOpenParentNudge = async (cls: ClassItem) => {
    setSelectedClass(cls);
    setParentTargetClass(cls);
    setParentLoading(true);
    setCopied(false);
    setOpenParentDialog(true);
    try {
      const res = await api<{ template: string }>(`/api/classes/parent-nudge?classId=${encodeURIComponent(cls.classId)}`);
      setParentTemplate(res.template || '');
    } catch (err: any) {
      setParentTemplate(
        `[THCS GIẢNG VÕ - THÔNG BÁO TỪ GVCN ${(cls.homeroomTeacher || 'NHÀ TRƯỜNG').toUpperCase()} - ${cls.className.toUpperCase()}]\n\nKính gửi Quý Phụ huynh lớp ${cls.className},\n\nBan Giám hiệu nhà trường và GVCN xin thông báo tới Quý Phụ huynh về tình hình nộp bài tập trực tuyến trên Google Classroom tuần này:\n- Tiến độ hoàn thành: ${cls.completionRate}%\n\nKính đề nghị Quý Phụ huynh phối hợp đôn đốc các con hoàn thành đầy đủ bài tập đúng hạn.\n\nTrân trọng cảm ơn!`
      );
    } finally {
      setParentLoading(false);
    }
  };

  // Handle Copy Template
  const handleCopyTemplate = () => {
    if (!parentTemplate) return;
    navigator.clipboard.writeText(parentTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle Sync Metrics
  const handleSyncMetrics = async () => {
    setSyncingMetrics(true);
    try {
      const res = await api.post<{ ok: boolean; message: string }>('/api/classes/sync-metrics');
      setToast({ message: res.message || 'Đã đối soát và cập nhật số liệu thành công!', severity: 'success' });
      loadClasses();
    } catch (err: any) {
      setToast({ message: `Lỗi đối soát: ${err.message}`, severity: 'error' });
    } finally {
      setSyncingMetrics(false);
    }
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const [unlinkLinkedCourses, setUnlinkLinkedCourses] = useState(true);

  // Open Delete Dialog
  const handleOpenDelete = (cls: ClassItem) => {
    setSelectedClass(cls);
    setFormError('');
    setUnlinkLinkedCourses(true);
    setOpenDeleteDialog(true);
  };

  // Submit Delete Class
  const handleDeleteSubmit = async () => {
    if (!selectedClass) return;
    setFormSubmitting(true);
    setFormError('');

    try {
      await api.delete(`/api/classes/${encodeURIComponent(selectedClass.classId)}?unlinkCourses=${unlinkLinkedCourses}`);
      setToast({ message: `Đã xoá lớp "${selectedClass.className}" thành công!`, severity: 'success' });
      setOpenDeleteDialog(false);
      loadClasses();
    } catch (err: any) {
      setFormError(err.message || 'Không thể xoá lớp học này.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const totalActualStudents = useMemo(() => {
    return items.reduce((acc, c) => acc + (c.studentCount || 0), 0);
  }, [items]);

  const totalLinkedCourses = useMemo(() => {
    return items.reduce((acc, c) => acc + (c.courseCount || 0), 0);
  }, [items]);

  const overallAvgCompletion = useMemo(() => {
    const withRates = items.filter((c) => c.completionRate > 0);
    if (withRates.length === 0) return 0;
    return Math.round(withRates.reduce((acc, c) => acc + c.completionRate, 0) / withRates.length);
  }, [items]);

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-6">
      <PageHeader
        title="Quản lý Lớp học & Sĩ số"
        subtitle="Danh sách các lớp học toàn trường từ Google Classroom và lớp tạo thủ công, quản lý phân công GVCN và sĩ số."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              onClick={() => {
                setNudgeTargetClass('all');
                setOpenNudgeDialog(true);
              }}
              className="border-amber-300 font-semibold text-amber-700 hover:bg-amber-50"
            >
              <Megaphone className="size-4" />
              Đôn đốc nộp bài
            </Button>
            <Button variant="outline" onClick={handleSyncMetrics} disabled={syncingMetrics}>
              {syncingMetrics ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              {syncingMetrics ? 'Đang đối soát...' : 'Đối soát số liệu'}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={loadClasses}>
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Làm mới dữ liệu</TooltipContent>
            </Tooltip>
            <Button onClick={handleOpenCreate} className="rounded-lg px-5">
              <Plus className="size-4" />
              Thêm lớp học
            </Button>
          </div>
        }
      />

      {/* Thẻ KPI tổng hợp đối soát với Google Classroom */}
      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-4">
        <KpiCard
          label="Tổng số Lớp học"
          value={`${items.length} lớp`}
          caption={`${items.filter((c) => c.source === 'CLASSROOM_SYNC').length} từ Classroom • ${items.filter((c) => c.source === 'MANUAL').length} thủ công`}
        />
        <KpiCard
          label="Sĩ số HS Thực tế (Classroom)"
          value={`${totalActualStudents.toLocaleString('vi-VN')} HS`}
          valueClassName="text-primary"
          caption="Đồng bộ trực tiếp từ danh sách học sinh"
        />
        <KpiCard
          label="Khóa học liên kết"
          value={`${totalLinkedCourses} khóa`}
          valueClassName="text-violet-600"
          caption={`${items.filter((c) => c.courseCount > 0).length}/${items.length} lớp đã liên kết khóa học`}
        />
        <KpiCard
          label="Tỷ lệ nộp bài trung bình"
          value={`${overallAvgCompletion}%`}
          valueClassName="text-emerald-600"
          caption="Dựa trên tất cả bài nộp học sinh toàn trường"
        />
      </div>

      {/* Bộ lọc & Tìm kiếm */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex min-w-[320px] flex-1 flex-col gap-3 sm:flex-row">
          <div className="relative min-w-60 flex-1">
            <Search className="absolute top-1/2 left-3 size-5 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Tìm theo tên lớp, GVCN, phòng học..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={selectedGrade} onValueChange={setSelectedGrade}>
            <SelectTrigger className="min-w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GRADES.map((g) => (
                <SelectItem key={g.value} value={g.value}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Tìm thấy <strong className="text-[#0f172a]">{filteredItems.length}</strong> lớp học
        </p>
      </div>

      {/* Bảng danh sách lớp */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <Table className="min-w-[850px]">
          <TableHeader className="bg-slate-50">
            <TableRow className="hover:bg-slate-50">
              <TableHead className="text-xs font-medium text-slate-500">Tên Lớp</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Khối</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Nguồn dữ liệu</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Sĩ số</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Giáo viên Chủ nhiệm</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Phòng học</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Khóa học Classroom</TableHead>
              <TableHead className="text-xs font-medium text-slate-500">Tỷ lệ nộp bài</TableHead>
              <TableHead className="text-right text-xs font-medium text-slate-500">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx} className="hover:bg-transparent">
                  <TableCell colSpan={9} className="py-3">
                    <Skeleton className="h-7 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : pagedItems.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={9} className="py-10 text-center">
                  <div className="mb-3 inline-flex rounded-full bg-slate-100 p-3.5">
                    <School className="size-9 text-slate-400" />
                  </div>
                  <p className="font-semibold text-slate-700">Không có lớp học nào phù hợp</p>
                  <p className="mt-1 text-sm text-slate-500">Thử thay đổi bộ lọc khối hoặc từ khoá tìm kiếm, hoặc bấm "+ Thêm lớp học" để tạo mới.</p>
                </TableCell>
              </TableRow>
            ) : (
              pagedItems.map((cls) => {
                const isManual = cls.source === 'MANUAL';
                return (
                  <TableRow key={cls.classId}>
                    {/* Tên Lớp */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className={cn('flex size-9 items-center justify-center rounded-lg', isManual ? 'bg-violet-50 text-violet-600' : 'bg-secondary text-primary')}>
                          <School className="size-4" />
                        </div>
                        <div>
                          <p className="font-bold text-[#0f172a]">{cls.className}</p>
                          <p className="text-xs text-slate-500">Mã: {cls.classId}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Khối */}
                    <TableCell>
                      <Badge variant="outline" className="rounded-md border-transparent bg-slate-100 text-slate-700">
                        {cls.grade ? `Khối ${cls.grade}` : 'Chưa phân khối'}
                      </Badge>
                    </TableCell>

                    {/* Nguồn */}
                    <TableCell>
                      {isManual ? (
                        <Badge variant="outline" className="gap-1 rounded-md bg-violet-50 text-violet-700">
                          <User className="size-3.5" />
                          Thủ công
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 rounded-md bg-emerald-50 text-emerald-700">
                          <CloudCog className="size-3.5" />
                          Tự động
                        </Badge>
                      )}
                    </TableCell>

                    {/* Sĩ số */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Users className="size-4 text-slate-500" />
                        <span className="font-semibold text-slate-800">
                          {cls.studentCount > 0 ? `${cls.studentCount} HS` : cls.expectedStudents ? `${cls.expectedStudents} HS (Định mức)` : '0 HS'}
                        </span>
                      </div>
                      {cls.studentCount > 0 && cls.expectedStudents && cls.expectedStudents !== cls.studentCount ? (
                        <p className="text-xs text-slate-500">Định mức: {cls.expectedStudents} HS</p>
                      ) : null}
                    </TableCell>

                    {/* GVCN */}
                    <TableCell>
                      <p className="font-semibold text-slate-800">{cls.homeroomTeacher || 'Chưa phân công'}</p>
                      {cls.teacherEmail && <p className="text-xs text-slate-500">{cls.teacherEmail}</p>}
                    </TableCell>

                    {/* Phòng */}
                    <TableCell>
                      <span className={cls.room ? 'text-slate-800' : 'text-slate-400'}>{cls.room || '—'}</span>
                    </TableCell>

                    {/* Khóa học */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="size-4 text-slate-500" />
                        <span className="text-slate-800">{cls.courseCount || 0} khóa</span>
                      </div>
                    </TableCell>

                    {/* Tỷ lệ nộp bài */}
                    <TableCell>
                      {cls.completionRate ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-md border-transparent font-bold',
                            cls.completionRate >= 70 ? 'bg-green-50 text-green-700' : cls.completionRate >= 50 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'
                          )}
                        >
                          {cls.completionRate}%
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa có dữ liệu</span>
                      )}
                    </TableCell>

                    {/* Thao tác */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenParentNudge(cls)} className="text-sky-600 hover:bg-sky-50 hover:text-sky-700">
                              <MessageCircle className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Mẫu tin nhắn gửi Phụ huynh (Zalo/SMS)</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEdit(cls)} className="text-slate-600 hover:bg-secondary hover:text-primary">
                              <Pencil className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Chỉnh sửa thông tin</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon-sm" onClick={() => handleOpenDelete(cls)} className="text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="size-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Xoá lớp học</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Phân trang */}
        {filteredItems.length > rowsPerPage && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-200 p-4">
            <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm text-slate-500">
              Trang {page}/{totalPages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </div>

      {/* DIALOG: Thêm mới lớp học */}
      <Dialog open={openCreateDialog} onOpenChange={(open) => !formSubmitting && setOpenCreateDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle>Thêm lớp học thủ công</DialogTitle>
            </DialogHeader>
            {formError && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="c-name">Tên Lớp học *</Label>
                <Input id="c-name" placeholder="VD: 12A1, 6A, 10 Chuyên Tin" value={formClassName} onChange={(e) => setFormClassName(e.target.value)} required autoFocus />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="c-classid">Mã Lớp (tùy chọn)</Label>
                  <Input id="c-classid" placeholder="Tự động nếu để trống" value={formClassId} onChange={(e) => setFormClassId(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Mã duy nhất phân biệt lớp</p>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Khối học</Label>
                  <Select value={formGrade === '' ? '__none__' : String(formGrade)} onValueChange={(v) => setFormGrade(v === '__none__' ? '' : Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Không phân khối</SelectItem>
                      {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          Khối {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="c-teacher">Giáo viên Chủ nhiệm</Label>
                  <Input id="c-teacher" placeholder="Họ và tên GVCN" value={formTeacher} onChange={(e) => setFormTeacher(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="c-email">Email GVCN</Label>
                  <Input id="c-email" type="email" placeholder="gv@thcs-giangvo.edu.vn" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="c-students">Sĩ số học sinh dự kiến</Label>
                  <Input
                    id="c-students"
                    type="number"
                    min={1}
                    max={100}
                    value={formStudents}
                    onChange={(e) => setFormStudents(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="c-room">Phòng học</Label>
                  <div className="relative">
                    <DoorOpen className="absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-slate-400" />
                    <Input id="c-room" placeholder="VD: Phòng 201, Nhà A" value={formRoom} onChange={(e) => setFormRoom(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenCreateDialog(false)} disabled={formSubmitting}>
                Hủy
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Tạo lớp học'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Chỉnh sửa lớp học */}
      <Dialog open={openEditDialog} onOpenChange={(open) => !formSubmitting && setOpenEditDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Chỉnh sửa lớp {selectedClass?.className}</DialogTitle>
            </DialogHeader>
            {formError && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="e-name">Tên Lớp học *</Label>
                <Input id="e-name" value={formClassName} onChange={(e) => setFormClassName(e.target.value)} required />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="e-classid">Mã Lớp</Label>
                  <Input id="e-classid" value={formClassId} disabled />
                  <p className="text-xs text-muted-foreground">Mã lớp không thể thay đổi sau khi tạo</p>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label>Khối học</Label>
                  <Select value={formGrade === '' ? '__none__' : String(formGrade)} onValueChange={(v) => setFormGrade(v === '__none__' ? '' : Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Không phân khối</SelectItem>
                      {[6, 7, 8, 9, 10, 11, 12].map((g) => (
                        <SelectItem key={g} value={String(g)}>
                          Khối {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="e-teacher">Giáo viên Chủ nhiệm</Label>
                  <Input id="e-teacher" placeholder="Họ và tên GVCN" value={formTeacher} onChange={(e) => setFormTeacher(e.target.value)} />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="e-email">Email GVCN</Label>
                  <Input id="e-email" type="email" placeholder="gv@thcs-giangvo.edu.vn" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="e-students">Sĩ số học sinh dự kiến</Label>
                  <Input
                    id="e-students"
                    type="number"
                    min={1}
                    max={100}
                    value={formStudents}
                    onChange={(e) => setFormStudents(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="e-room">Phòng học</Label>
                  <div className="relative">
                    <DoorOpen className="absolute top-1/2 left-3 size-[18px] -translate-y-1/2 text-slate-400" />
                    <Input id="e-room" placeholder="VD: Phòng 201, Nhà A" value={formRoom} onChange={(e) => setFormRoom(e.target.value)} className="pl-9" />
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenEditDialog(false)} disabled={formSubmitting}>
                Hủy
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Xác nhận xoá lớp */}
      <Dialog open={openDeleteDialog} onOpenChange={(open) => !formSubmitting && setOpenDeleteDialog(open)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-red-600">Xác nhận xoá lớp học</DialogTitle>
          </DialogHeader>
          {formError && <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{formError}</p>}
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Bạn có chắc chắn muốn xoá lớp <strong>{selectedClass?.className}</strong> ({selectedClass?.classId}) không?
            </p>
            {selectedClass && (selectedClass.courseCount || 0) > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-2 text-xs font-semibold text-red-800">Lớp này hiện đang có {selectedClass.courseCount} khóa học Google Classroom liên kết.</p>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={unlinkLinkedCourses} onCheckedChange={(v) => setUnlinkLinkedCourses(v === true)} className="mt-0.5" />
                  <span className="text-sm font-semibold text-slate-800">
                    Tự động gỡ liên kết {selectedClass.courseCount} khóa học Classroom thuộc lớp này và xóa lớp
                  </span>
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDeleteDialog(false)} disabled={formSubmitting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteSubmit} disabled={formSubmitting}>
              {formSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Xác nhận xoá'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Đôn đốc nộp bài 1-Click */}
      <Dialog open={openNudgeDialog} onOpenChange={(open) => !nudgeSubmitting && setOpenNudgeDialog(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="size-5 text-amber-600" />
              Đôn đốc nộp bài tập số 1-Click (Student Nudge Center)
            </DialogTitle>
          </DialogHeader>
          <p className="mb-3 text-sm text-slate-600">
            Hệ thống sẽ phát chỉ đạo từ Ban Giám hiệu tới Giáo viên Chủ nhiệm và bộ môn, đồng thời kích hoạt cảnh báo học vụ để đôn đốc học sinh hoàn thành
            các bài tập Google Classroom quá hạn.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label>Phạm vi đôn đốc</Label>
            <Select value={nudgeTargetClass} onValueChange={setNudgeTargetClass}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toàn bộ tất cả các lớp trong trường</SelectItem>
                {items.map((c) => (
                  <SelectItem key={c.classId} value={c.classId}>
                    {c.className} (Tỷ lệ nộp: {c.completionRate}%)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNudgeDialog(false)} disabled={nudgeSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleNudgeSubmit} disabled={nudgeSubmitting} className="bg-amber-600 hover:bg-amber-700">
              {nudgeSubmitting ? <Loader2 className="size-4 animate-spin" /> : 'Phát lệnh đôn đốc ngay'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Mẫu tin nhắn gửi Phụ huynh (Zalo / SMS) */}
      <Dialog open={openParentDialog} onOpenChange={setOpenParentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="size-5 text-sky-600" />
              Mẫu tin nhắn gửi Phụ huynh — {parentTargetClass?.className}
            </DialogTitle>
          </DialogHeader>
          {parentLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto size-7 animate-spin text-primary" />
              <p className="mt-2 text-xs text-slate-500">Đang tạo nội dung thông báo...</p>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">
                Nội dung đã được chuẩn hóa theo số liệu nộp bài thực tế của lớp và danh tính GVCN. Bạn có thể sao chép để gửi vào nhóm Zalo hoặc tin nhắn SMS
                phụ huynh:
              </p>
              <div className="max-h-[280px] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                {parentTemplate}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenParentDialog(false)}>
              Đóng
            </Button>
            <Button
              onClick={handleCopyTemplate}
              disabled={parentLoading || !parentTemplate}
              className={cn('font-bold', copied && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Đã sao chép!' : 'Sao chép tin nhắn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
