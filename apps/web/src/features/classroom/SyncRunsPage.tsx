import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Eye,
  ListX,
  RefreshCw,
  Search,
  CloudCheck,
  RotateCw,
  TriangleAlert,
  GraduationCap,
  Users,
  BookOpen,
  ClipboardList,
  ArrowRight,
  Loader2
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Toast, type ToastState } from '../../components/Toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

const STATUS_STYLE: Record<string, string> = {
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  IN_PROGRESS: 'bg-secondary text-blue-700 border-blue-200',
  PARTIAL: 'bg-amber-50 text-amber-700 border-amber-200',
  FAILED: 'bg-red-50 text-red-700 border-red-200'
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: 'Hoàn thành',
  IN_PROGRESS: 'Đang đồng bộ',
  PARTIAL: 'Một phần lỗi',
  FAILED: 'Thất bại'
};

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
  const [toast, setToast] = useState<ToastState | null>(null);

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

  const getStatusBadge = (status: string) => (
    <Badge variant="outline" className={cn('gap-1 font-bold', STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 border-slate-200')}>
      {status === 'COMPLETED' && <CloudCheck className="size-3.5" />}
      {status === 'IN_PROGRESS' && <RotateCw className="size-3.5" />}
      {status === 'PARTIAL' && <TriangleAlert className="size-3.5" />}
      {STATUS_LABEL[status] || status}
    </Badge>
  );

  // KPIs
  const totalSyncs = runs.length;
  const activeCoursesFromSync = runs.reduce((acc, r) => acc + (r.coursesCount || 0), 0);
  const latestRun = runs[0];

  return (
    <div className="mx-auto max-w-[1440px] p-4 md:p-6">
      <PageHeader
        title="Quản lý Phiên Đồng bộ Google Classroom"
        subtitle="Lịch sử các phiên đồng bộ dữ liệu từ Google Classroom, xem chi tiết khoá học theo phiên và hỗ trợ rollback dữ liệu an toàn."
        action={
          <div className="flex items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={loadSyncRuns}>
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Làm mới danh sách</TooltipContent>
            </Tooltip>
            <Button variant="outline" onClick={() => navigate('/classroom')} className="font-semibold">
              Xem Khoá học
            </Button>
            <Button onClick={() => navigate('/connections')} className="font-semibold">
              <RotateCw className="size-4" />
              Đồng bộ dữ liệu
            </Button>
          </div>
        }
      />

      {/* Thống kê nhanh KPI */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <p className="text-xs font-semibold text-slate-500 uppercase">Tổng phiên đồng bộ</p>
          <p className="mt-1 text-3xl font-extrabold text-[#0f172a]">{totalSyncs}</p>
          <p className="mt-1 text-sm text-slate-400">Lần quét & import từ trước tới nay</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <p className="text-xs font-semibold text-slate-500 uppercase">Khoá học đang lưu vết</p>
          <p className="mt-1 text-3xl font-extrabold text-primary">{activeCoursesFromSync}</p>
          <p className="mt-1 text-sm text-slate-400">Thuộc các phiên đồng bộ hiện hành</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <p className="text-xs font-semibold text-slate-500 uppercase">Phiên gần nhất</p>
          <p className="mt-2 overflow-hidden text-sm font-bold text-nowrap text-ellipsis text-[#0f172a]">
            {latestRun ? formatDate(latestRun.startedAt) : 'Chưa có'}
          </p>
          <p className="mt-1 text-sm text-slate-500">{latestRun?.performedBy || 'Chưa thực hiện'}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <p className="text-xs font-semibold text-slate-500 uppercase">Trạng thái gần nhất</p>
          <div className="mt-2">{latestRun ? getStatusBadge(latestRun.status) : '—'}</div>
          <p className="mt-2 text-sm text-slate-400">
            {latestRun ? `${latestRun.coursesSuccess}/${latestRun.coursesTotal} khoá thành công` : 'Sẵn sàng'}
          </p>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="relative max-w-[450px]">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <Input placeholder="Tìm theo mã phiên, người thực hiện hoặc trạng thái..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {/* Bảng danh sách phiên đồng bộ */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="w-full overflow-x-auto">
          <Table className="min-w-[800px]">
            <TableHeader className="bg-slate-50">
              <TableRow className="hover:bg-slate-50">
                <TableHead className="text-[0.85rem] font-bold text-slate-600">Mã Phiên Đồng bộ</TableHead>
                <TableHead className="text-[0.85rem] font-bold text-slate-600">Thời gian thực hiện</TableHead>
                <TableHead className="text-[0.85rem] font-bold text-slate-600">Người thực hiện</TableHead>
                <TableHead className="text-[0.85rem] font-bold text-slate-600">Khoá học của phiên</TableHead>
                <TableHead className="text-[0.85rem] font-bold text-slate-600">Trạng thái</TableHead>
                <TableHead className="text-right text-[0.85rem] font-bold text-slate-600">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, idx) => (
                  <TableRow key={idx}>
                    <TableCell colSpan={6} className="py-4">
                      <Skeleton className="h-7 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : pagedRuns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center">
                    <div className="mb-3 inline-flex rounded-full bg-slate-100 p-4">
                      <History className="size-9 text-slate-400" />
                    </div>
                    <p className="font-semibold text-slate-700">Chưa có phiên đồng bộ nào</p>
                    <p className="mt-1 mb-4 text-sm text-slate-500">Thực hiện đồng bộ dữ liệu từ Google Classroom để xem lịch sử tại đây.</p>
                    <Button variant="outline" onClick={() => navigate('/connections')}>
                      <RotateCw className="size-4" />
                      Đi tới Kết nối & Đồng bộ
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRuns.map((run) => {
                  const hasActiveCourses = run.coursesCount > 0;
                  return (
                    <TableRow key={run.id}>
                      {/* Mã phiên */}
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-9 place-items-center rounded-lg bg-secondary text-primary">
                            <History className="size-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-[#0f172a]">{run.id}</p>
                            <p className="text-xs text-slate-500">Loại: {run.type}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Thời gian */}
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800">Bắt đầu: {formatDate(run.startedAt)}</p>
                        {run.finishedAt && <p className="text-xs text-slate-500">Xong: {formatDate(run.finishedAt)}</p>}
                      </TableCell>

                      {/* Người thực hiện */}
                      <TableCell>
                        <p className="text-sm font-semibold text-slate-800">{run.performedBy || 'Hệ thống'}</p>
                      </TableCell>

                      {/* Số khoá học */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="size-4 text-slate-500" />
                          <span className={cn('text-sm font-bold', hasActiveCourses ? 'text-primary' : 'text-slate-500')}>
                            {run.coursesCount} khoá học
                          </span>
                          <span className="text-xs text-slate-400">(Quét: {run.coursesTotal})</span>
                        </div>
                      </TableCell>

                      {/* Trạng thái */}
                      <TableCell>{getStatusBadge(run.status)}</TableCell>

                      {/* Thao tác */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => handleViewCourses(run)} disabled={!hasActiveCourses}>
                            <Eye className="size-4" />
                            Xem khoá học
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleOpenRollback(run)}>
                            <ListX className="size-4" />
                            Rollback
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredRuns.length > rowsPerPage && (
          <div className="flex items-center justify-center gap-3 border-t border-slate-200 p-3 text-sm text-slate-500">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Trước
            </Button>
            <span>
              Trang {page}/{totalPages}
            </span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Sau
            </Button>
          </div>
        )}
      </div>

      {/* DIALOG: Danh sách khoá học thuộc phiên */}
      <Dialog open={openCoursesDialog} onOpenChange={setOpenCoursesDialog}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Khoá học thuộc phiên {selectedRun?.id}</DialogTitle>
          </DialogHeader>
          {loadingCourses ? (
            <div className="py-8 text-center">
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-slate-500">Đang tải danh sách khoá học...</p>
            </div>
          ) : coursesInRun.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">Không có khoá học nào thuộc phiên này (hoặc đã bị rollback).</p>
            </div>
          ) : (
            <div className="max-h-[440px] overflow-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow className="hover:bg-slate-50">
                    <TableHead className="font-bold">Tên Khoá học</TableHead>
                    <TableHead className="font-bold">Lớp & Khối</TableHead>
                    <TableHead className="font-bold">Môn học</TableHead>
                    <TableHead className="font-bold">Sĩ số / GV</TableHead>
                    <TableHead className="font-bold">Bài tập</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coursesInRun.map((course) => (
                    <TableRow key={course.id}>
                      <TableCell>
                        <p className="text-sm font-bold text-[#0f172a]">{course.name}</p>
                        <p className="text-xs text-slate-500">
                          ID: {course.id} {course.room ? `• Phòng: ${course.room}` : ''}
                        </p>
                      </TableCell>
                      <TableCell>
                        {course.className ? (
                          <Badge variant="outline" className="gap-1 border-transparent bg-secondary font-semibold text-[#1d4ed8]">
                            <GraduationCap className="size-3.5" />
                            {course.className}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Chưa phân lớp</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-700">{course.subjectName || 'Chưa phân môn'}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="size-3.5 text-slate-500" />
                          <span className="text-sm font-semibold text-slate-800">{course.rosterStudents || 0} HS</span>
                        </div>
                        <p className="text-xs text-slate-500">{course.rosterTeachers || 0} giáo viên</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ClipboardList className="size-3.5 text-slate-500" />
                          <span className="text-sm text-slate-800">{course.contentCoursework || 0} bài tập</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenCoursesDialog(false)}>
              Đóng
            </Button>
            <Button
              onClick={() => {
                setOpenCoursesDialog(false);
                navigate('/classroom');
              }}
            >
              Quản lý Khoá học
              <ArrowRight className="size-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: Xác nhận Rollback phiên */}
      <Dialog open={openRollbackDialog} onOpenChange={(open) => !open && !rollbackSubmitting && setOpenRollbackDialog(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TriangleAlert className="size-5" />
              Xác nhận Rollback phiên {rollbackRun?.id}
            </DialogTitle>
          </DialogHeader>
          {rollbackError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{rollbackError}</AlertDescription>
            </Alert>
          )}
          <p className="font-semibold text-[#0f172a]">Bạn có chắc chắn muốn rollback toàn bộ dữ liệu của phiên đồng bộ này?</p>
          <p className="text-sm text-slate-600">Hành động này sẽ thực hiện các thao tác sau:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
            <li>
              Xoá toàn bộ <strong>{rollbackRun?.coursesCount || 0} khoá học</strong> được import trong phiên này.
            </li>
            <li>Xoá dữ liệu con cascade: bài tập, tài liệu, thông báo, bài nộp, thành viên của các khoá học.</li>
            <li>Tự động tổng hợp và tính toán lại danh sách lớp học và các chỉ số thống kê trường học.</li>
            <li>Lớp học tạo thủ công và thời khoá biểu đã xếp sẽ được bảo toàn nguyên vẹn.</li>
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenRollbackDialog(false)} disabled={rollbackSubmitting}>
              Huỷ bỏ
            </Button>
            <Button variant="destructive" onClick={handleRollbackSubmit} disabled={rollbackSubmitting}>
              {rollbackSubmitting && <Loader2 className="size-4 animate-spin" />}
              {rollbackSubmitting ? 'Đang xử lý...' : 'Xác nhận Rollback'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
