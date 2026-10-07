import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  GraduationCap,
  Link2,
  CheckCircle2,
  RotateCw,
  Trash2,
  ListChecks,
  ExternalLink,
  RefreshCw,
  TriangleAlert,
  Loader2
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
    return items.filter((x) =>
      !query ||
      String(x.name || '').toLowerCase().includes(query) ||
      String(x.className || '').toLowerCase().includes(query) ||
      String(x.section || '').toLowerCase().includes(query)
    );
  }, [items, q]);

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
  const isSomeTableSelected = selectedTableIds.size > 0 && !isAllTableSelected;

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

  const isAllPreviewSelected = filteredPreviewItems.length > 0 && filteredPreviewItems.every((x) => previewSelectedIds.has(x.id));
  const isSomePreviewSelected = filteredPreviewItems.some((x) => previewSelectedIds.has(x.id)) && !isAllPreviewSelected;

  const PREVIEW_FILTER_CARDS: Array<{ key: typeof previewFilter; label: string; value: number; active: string; textActive: string }> = [
    { key: 'ALL', label: 'TẤT CẢ TÌM THẤY', value: previewCounts.total, active: 'border-2 border-blue-500 bg-secondary', textActive: 'text-[#0f172a]' },
    { key: 'NEW', label: 'LỚP MỚI CHƯA ĐỒNG BỘ', value: previewCounts.newCount, active: 'border-2 border-emerald-500 bg-emerald-50', textActive: 'text-emerald-600' },
    { key: 'SYNCED', label: 'ĐÃ ĐỒNG BỘ', value: previewCounts.syncedCount, active: 'border-2 border-blue-600 bg-secondary', textActive: 'text-primary' },
    { key: 'IGNORED', label: 'ĐÃ LOẠI TRỪ', value: previewCounts.ignoredCount, active: 'border-2 border-red-500 bg-red-50', textActive: 'text-red-600' }
  ];

  return (
    <>
      <PageHeader
        title="Khóa học Bộ môn (Google Classroom)"
        icon={<GraduationCap />}
        action={
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={handleOpenPreview}>
              <ListChecks className="size-4" />
              Duyệt & Đồng bộ Lớp học
            </Button>
            <Button variant="outline" onClick={handleQuickSync} disabled={syncingQuick}>
              {syncingQuick ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
              {syncingQuick ? 'Đang đồng bộ...' : 'Đồng bộ nhanh'}
            </Button>
            <Button variant="outline" onClick={() => navigate('/connections')}>
              <Link2 className="size-4" />
              Cấu hình Google Workspace
            </Button>
          </div>
        }
      />

      {toast && (
        <Alert
          className={cn(
            'mb-5',
            toast.severity === 'error'
              ? 'border-red-200 bg-red-50'
              : toast.severity === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : toast.severity === 'warning'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-blue-200 bg-secondary'
          )}
        >
          <AlertDescription
            className={cn(
              toast.severity === 'error'
                ? 'text-red-700'
                : toast.severity === 'success'
                  ? 'text-emerald-700'
                  : toast.severity === 'warning'
                    ? 'text-amber-800'
                    : 'text-blue-800'
            )}
          >
            {toast.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Summary KPI Cards */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-slate-500">Tổng khóa học đã đồng bộ</p>
          <p className="my-0.5 text-[1.875rem] font-bold tracking-tight text-[#0f172a]">{items.length}</p>
          <p className="text-xs text-slate-500">Khóa học Google Classroom thực tế đang hoạt động</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-slate-500">Tỷ lệ Mapping vào Lớp hành chính</p>
          <p className="my-0.5 text-[1.875rem] font-bold tracking-tight text-primary">
            {items.length ? Math.round((mappedCount / items.length) * 100) : 0}%
          </p>
          <p className="text-xs text-slate-500">
            {mappedCount}/{items.length} khóa học đã liên kết lớp hành chính
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <p className="text-xs font-medium text-slate-500">Tỷ lệ nộp bài trung bình</p>
          <p className="my-0.5 text-[1.875rem] font-bold tracking-tight text-emerald-500">{avgSubmissionRate}%</p>
          <p className="text-xs text-slate-500">{items.length ? 'Tổng hợp từ các bài tập đã giao trong học kỳ' : 'Chưa có dữ liệu bài tập'}</p>
        </div>
      </div>

      {/* Thanh thao tác hàng loạt khi có dòng được chọn */}
      {selectedTableIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-5 py-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-bold text-red-800">Đã chọn {selectedTableIds.size} khóa học</p>
            <Button size="sm" variant="ghost" onClick={() => setSelectedTableIds(new Set())} className="text-slate-500">
              Bỏ chọn
            </Button>
          </div>
          <Button size="sm" variant="destructive" onClick={() => setOpenBatchDeleteDialog(true)}>
            <Trash2 className="size-4" />
            Xóa {selectedTableIds.size} khóa học đã chọn
          </Button>
        </div>
      )}

      {/* Unified DataTable Block */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div className="relative w-full sm:w-[340px]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Tìm theo tên khóa học, lớp hoặc học kỳ" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-secondary text-[#1d4ed8]">
              Hiển thị {filtered.length} / {items.length} khóa học
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="outline" onClick={load}>
                  <RefreshCw className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tải lại danh sách</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {items.length === 0 && !loading ? (
          <div className="border-t border-slate-200 bg-slate-50 p-10 text-center">
            <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-[#1d4ed8] text-white shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
              <GraduationCap className="size-8" />
            </div>
            <p className="mb-1 font-bold text-[#0f172a]">Chưa có khóa học nào được đồng bộ từ Google Classroom</p>
            <p className="mx-auto mb-5 max-w-[580px] text-sm text-slate-500">
              Bạn có thể bấm "Duyệt & Đồng bộ Lớp học" để quét danh sách từ Google Classroom và chọn các lớp mong muốn, hoặc kết nối tài khoản
              Google trong phần cấu hình.
            </p>
            <div className="flex justify-center gap-3">
              <Button onClick={handleOpenPreview}>
                <ListChecks className="size-4" />
                Duyệt & Đồng bộ ngay
              </Button>
              <Button variant="outline" onClick={() => navigate('/connections')}>
                <Link2 className="size-4" />
                Cấu hình kết nối Google
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="hover:bg-slate-50">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={isAllTableSelected ? true : isSomeTableSelected ? 'indeterminate' : false}
                      onCheckedChange={toggleSelectAllTable}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Tên khóa học</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Học kỳ / Section</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Trạng thái</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Lớp hành chính</TableHead>
                  <TableHead className="text-xs font-medium text-slate-500">Sĩ số Roster</TableHead>
                  <TableHead className="min-w-40 text-xs font-medium text-slate-500">Tỷ lệ nộp bài</TableHead>
                  <TableHead className="text-right text-xs font-medium text-slate-500">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((x) => {
                  const rawSubRate = x.completionRate ?? x.content?.completionRate ?? x.content?.submissionRate;
                  const subRate = rawSubRate != null && rawSubRate !== '' && !isNaN(Number(rawSubRate)) ? Number(rawSubRate) : null;
                  const studentCount = x.rosterStudents ?? x.roster?.students ?? null;
                  const isMapped = Boolean(x.className || x.classId);
                  const isSelected = selectedTableIds.has(x.id);

                  return (
                    <TableRow key={x.id} className={cn(isSelected && 'bg-secondary/60')}>
                      <TableCell>
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectTableRow(x.id)} />
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-semibold text-[#0f172a]">{x.name}</p>
                        {x.alternateLink && (
                          <a
                            href={x.alternateLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Mở Google Classroom <ExternalLink className="size-3" />
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500">{x.section || '—'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-[22px] font-semibold',
                            x.courseState === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-slate-100 text-slate-500'
                          )}
                        >
                          {x.courseState === 'ACTIVE' ? 'Đang mở' : x.courseState}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isMapped ? (
                          <Badge variant="outline" className="gap-1 bg-secondary text-[#1d4ed8]">
                            <CheckCircle2 className="size-3.5" />
                            {x.className || x.classId}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700">
                            Chưa mapping
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-[#0f172a]">{studentCount != null ? `${studentCount} HS` : '—'}</span>
                      </TableCell>
                      <TableCell>
                        {subRate !== null ? (
                          <div className="flex items-center gap-2">
                            <Progress
                              value={Math.min(subRate, 100)}
                              className="h-1.5 flex-1 bg-slate-100"
                              indicatorClassName={subRate >= 90 ? 'bg-emerald-500' : 'bg-primary'}
                            />
                            <span className="min-w-9 text-xs font-semibold text-[#0f172a]">{subRate}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Chưa có bài tập</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button size="xs" variant="outline" onClick={() => openMapDialog(x)}>
                            <Link2 className="size-3.5" />
                            {isMapped ? 'Sửa map' : 'Mapping'}
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                onClick={() => {
                                  setDeleteTarget(x);
                                  setDeleteAddToIgnore(true);
                                }}
                                className="text-slate-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Xóa khóa học này khỏi hệ thống</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* DIALOG: DUYỆT & ĐỒNG BỘ GOOGLE CLASSROOM (SELECTIVE SYNC PREVIEW) */}
      <Dialog open={openPreviewDialog} onOpenChange={(open) => !executingSync && setOpenPreviewDialog(open)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <ListChecks className="size-5 text-primary" />
              <div>
                <DialogTitle>Duyệt & Chọn Lớp Đồng Bộ Từ Google Classroom</DialogTitle>
                <DialogDescription>Chọn chính xác các khóa học thuộc năm học hiện tại cần nạp vào hệ thống</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {previewLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto mb-3 size-9 animate-spin text-primary" />
              <p className="text-sm font-semibold text-slate-700">Đang kết nối Google Classroom và quét danh sách khóa học...</p>
              <p className="text-xs text-slate-400">Quá trình này có thể mất từ 3–5 giây tùy thuộc số lượng lớp của trường.</p>
            </div>
          ) : previewError ? (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{previewError}</AlertDescription>
            </Alert>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Thẻ đếm số lượng */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {PREVIEW_FILTER_CARDS.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setPreviewFilter(card.key)}
                    className={cn(
                      'rounded-lg border p-3 text-left',
                      previewFilter === card.key ? card.active : 'border-slate-200 bg-slate-50'
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-500">{card.label}</p>
                    <p className={cn('text-lg font-bold', previewFilter === card.key ? card.textActive : 'text-[#0f172a]')}>{card.value}</p>
                  </button>
                ))}
              </div>

              {/* Thanh lọc & Nút chọn nhanh */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full sm:w-[280px]">
                  <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Tìm theo tên khóa học hoặc lớp"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1.5">
                  <Button size="xs" variant="outline" onClick={() => setPreviewSelectedIds(new Set(previewItems.map((x) => x.id)))}>
                    Chọn tất cả ({previewItems.length})
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => {
                      const newIds = previewItems.filter((x) => !x.isAlreadySynced && !x.isIgnored).map((x) => x.id);
                      setPreviewSelectedIds(new Set(newIds));
                    }}
                  >
                    Chỉ chọn lớp mới ({previewCounts.newCount})
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => setPreviewSelectedIds(new Set())} className="text-slate-500">
                    Bỏ chọn
                  </Button>
                </div>
              </div>

              {/* Bảng danh sách chọn lớp */}
              <div className="max-h-[380px] overflow-auto rounded-lg border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={isAllPreviewSelected ? true : isSomePreviewSelected ? 'indeterminate' : false}
                          onCheckedChange={() => {
                            const next = new Set(previewSelectedIds);
                            if (isAllPreviewSelected) {
                              for (const x of filteredPreviewItems) next.delete(x.id);
                            } else {
                              for (const x of filteredPreviewItems) next.add(x.id);
                            }
                            setPreviewSelectedIds(next);
                          }}
                        />
                      </TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Khóa học Google</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Lớp đề xuất</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Môn học</TableHead>
                      <TableHead className="text-xs font-medium text-slate-500">Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPreviewItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-6 text-center text-slate-400">
                          Không có khóa học nào khớp với bộ lọc này.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPreviewItems.map((c) => {
                        const isChecked = previewSelectedIds.has(c.id);
                        return (
                          <TableRow
                            key={c.id}
                            className={cn('cursor-pointer', isChecked && 'bg-secondary/60')}
                            onClick={() => {
                              const next = new Set(previewSelectedIds);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              setPreviewSelectedIds(next);
                            }}
                          >
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={isChecked}
                                onCheckedChange={() => {
                                  const next = new Set(previewSelectedIds);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  setPreviewSelectedIds(next);
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-semibold text-[#0f172a]">{c.name}</p>
                              <p className="text-xs text-slate-500">
                                ID: {c.id} {c.section ? `• ${c.section}` : ''}
                              </p>
                            </TableCell>
                            <TableCell>
                              {c.className ? (
                                <Badge variant="outline" className="border-transparent bg-secondary text-[#1d4ed8]">
                                  {c.className}
                                </Badge>
                              ) : (
                                <span className="text-xs text-slate-500">Chưa xác định</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-slate-700">{c.subjectName || '—'}</span>
                            </TableCell>
                            <TableCell>
                              {c.isIgnored ? (
                                <Badge variant="outline" className="border-transparent bg-red-50 text-red-700">
                                  Đang loại trừ
                                </Badge>
                              ) : c.isAlreadySynced ? (
                                <Badge variant="outline" className="border-transparent bg-slate-100 text-slate-600">
                                  Đã có trong hệ thống
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="border-transparent bg-emerald-50 text-emerald-600">
                                  Lớp mới
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Tùy chọn loại trừ các lớp không chọn */}
              <label className="flex items-start gap-2.5 pt-1">
                <Checkbox checked={previewAutoIgnoreUnselected} onCheckedChange={(v) => setPreviewAutoIgnoreUnselected(v === true)} className="mt-0.5" />
                <span className="text-sm text-slate-600">
                  Đưa các khóa học <strong>không được chọn</strong> vào danh sách loại trừ (để tự động bỏ qua trong các đợt đồng bộ sau)
                </span>
              </label>
            </div>
          )}

          <DialogFooter className="flex-row items-center justify-between sm:justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Đã chọn: <strong className="text-primary">{previewSelectedIds.size}</strong> khóa học
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpenPreviewDialog(false)} disabled={executingSync}>
                Hủy
              </Button>
              <Button onClick={handleExecuteSelectiveSync} disabled={executingSync || previewSelectedIds.size === 0}>
                {executingSync ? <Loader2 className="size-4 animate-spin" /> : <RotateCw className="size-4" />}
                {executingSync ? 'Đang nạp dữ liệu...' : `Bắt đầu đồng bộ ${previewSelectedIds.size} khóa học`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: XÁC NHẬN XÓA 1 KHÓA HỌC */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <TriangleAlert className="size-5" />
              Xóa khóa học khỏi hệ thống
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-700">
                Bạn có chắc chắn muốn xóa khóa học <strong>{deleteTarget.name}</strong> không?
              </p>
              <p className="text-xs text-slate-500">Toàn bộ dữ liệu điểm số, bài nộp và liên kết của khóa học này trong hệ thống sẽ được dọn sạch.</p>
              <label className="flex items-start gap-2.5">
                <Checkbox checked={deleteAddToIgnore} onCheckedChange={(v) => setDeleteAddToIgnore(v === true)} className="mt-0.5" />
                <span className="text-sm text-slate-800">Đưa vào danh sách loại trừ (để không tự động nạp lại khi đồng bộ Google Classroom)</span>
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleDeleteCourse} disabled={deleting}>
              {deleting && <Loader2 className="size-4 animate-spin" />}
              {deleting ? 'Đang xử lý...' : 'Xác nhận xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: XÓA HÀNG LOẠT KHÓA HỌC */}
      <Dialog open={openBatchDeleteDialog} onOpenChange={(open) => !open && !batchDeleting && setOpenBatchDeleteDialog(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="size-5" />
              Xóa {selectedTableIds.size} khóa học đã chọn
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-700">
              Bạn đang yêu cầu xóa <strong>{selectedTableIds.size}</strong> khóa học cùng lúc khỏi hệ thống.
            </p>
            <p className="text-xs text-slate-500">Hành động này sẽ xóa vĩnh viễn dữ liệu bài tập và bài nộp liên quan của các khóa học được chọn.</p>
            <label className="flex items-start gap-2.5">
              <Checkbox checked={batchDeleteAddToIgnore} onCheckedChange={(v) => setBatchDeleteAddToIgnore(v === true)} className="mt-0.5" />
              <span className="text-sm text-slate-800">Đưa các khóa học này vào danh sách loại trừ (không tự động kéo lại)</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenBatchDeleteDialog(false)} disabled={batchDeleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleBatchDelete} disabled={batchDeleting}>
              {batchDeleting && <Loader2 className="size-4 animate-spin" />}
              {batchDeleting ? 'Đang xử lý...' : 'Xác nhận xóa tất cả'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapping Dialog */}
      <Dialog open={Boolean(mapTarget)} onOpenChange={(open) => !open && setMapTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mapping Khóa Học Với Lớp Hành Chính</DialogTitle>
          </DialogHeader>
          {mapTarget && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">
                Khóa học: <strong className="text-[#0f172a]">{mapTarget.name}</strong>
              </p>
              <div>
                <Label htmlFor="map-class-id" className="mb-1.5 block">
                  Mã Lớp (Class ID)
                </Label>
                <Input id="map-class-id" placeholder="Ví dụ: 9A1, 8A2, 7A3..." value={classId} onChange={(e) => setClassId(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="map-class-name" className="mb-1.5 block">
                  Tên Lớp hiển thị
                </Label>
                <Input id="map-class-name" placeholder="Ví dụ: Lớp 9A1, Lớp 8A2..." value={className} onChange={(e) => setClassName(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapTarget(null)}>
              Hủy
            </Button>
            <Button onClick={handleSaveMapping}>Lưu Ánh Xạ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
