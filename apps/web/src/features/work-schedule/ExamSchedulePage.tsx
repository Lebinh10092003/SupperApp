/**
 * ExamSchedulePage.tsx — "Lịch trông thi" (§17-25
 * huong_dan_lich_cong_tac_giao_viec.md). Tra cứu dữ liệu đã import/tạo tay:
 * lọc theo ngày/môn/lớp/giáo viên (GV tiết đầu HOẶC GV tiết sau — §25), tạo
 * thủ công 1 ca (ExamShiftCreateDialog.tsx), import file (ExamImportDialog.tsx)
 * — cả 2 nút chỉ admin/lãnh đạo mới thấy. Chọn dòng + xóa hàng loạt (Sin yêu
 * cầu 2026-10-05), search/filter dùng lại đúng pattern "ô tìm kiếm + Popover
 * Bộ lọc" của EventsListPage.tsx/TasksListPage.tsx cho nhất quán, không tạo
 * hệ filter riêng.
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CirclePlus, FileUp, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useActor } from './hooks/useActor';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';
import { ExamImportDialog } from './components/ExamImportDialog';
import { ExamShiftCreateDialog } from './components/ExamShiftCreateDialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FilterPopover } from '@/components/FilterPopover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface ExamShift {
  id: string;
  examDate: string;
  session: string;
  periodLabel: string;
  timeLabel: string;
  subject: string;
  className: string;
  campusId: string;
  note: string;
  firstProctorLabel: string | null;
  secondProctorLabel: string | null;
}

const ALL_CAMPUS = '__all__';

function monthNow(): string {
  return new Date().toISOString().slice(0, 7);
}

/** `examDate` là chuỗi thuần 'YYYY-MM-DD' (không có giờ) — đổi trực tiếp
 * sang 'DD/MM/YYYY' bằng cách tách chuỗi, CỐ TÌNH không đi qua `new
 * Date(...)` để tránh lệch ngày do quy đổi múi giờ (midnight UTC có thể
 * hiện thành ngày hôm trước ở local timezone). */
function formatExamDate(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return value || '—';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export default function ExamSchedulePage() {
  const { hasRole } = useActor();
  const isLeadership = hasRole('R.PRINCIPAL') || hasRole('R.VICE_PRINCIPAL');

  const [month, setMonth] = useState(monthNow());
  const [dateFilter, setDateFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState(ALL_CAMPUS);
  const activeFilterCount = [dateFilter, subjectFilter, classFilter, campusFilter !== ALL_CAMPUS ? '1' : ''].filter(Boolean).length;

  const [items, setItems] = useState<ExamShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  const load = () => {
    setLoading(true);
    const q = new URLSearchParams({ month });
    if (dateFilter) q.set('examDate', dateFilter);
    if (subjectFilter.trim()) q.set('subject', subjectFilter.trim());
    if (classFilter.trim()) q.set('className', classFilter.trim());
    if (teacherFilter.trim()) q.set('teacherName', teacherFilter.trim());
    api
      .get<{ items: ExamShift[] }>(`/api/work-schedule/exam-shifts?${q.toString()}`)
      .then((res) => setItems(res.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  // Tự động tải lại khi đổi bộ lọc (khớp UX "gõ là lọc luôn, không cần bấm
  // nút" của Lịch công tác/Giao việc) — debounce nhẹ 300ms cho các ô gõ tự
  // do (môn/lớp/GV) để không bắn request mỗi lần gõ 1 ký tự; tháng/ngày/cơ
  // sở là input rời rạc (chọn 1 lần) nên áp dụng ngay, không cần debounce.
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, dateFilter, subjectFilter, classFilter, teacherFilter]);

  const filtered = useMemo(
    () => (campusFilter === ALL_CAMPUS ? items : items.filter((i) => i.campusId === campusFilter)),
    [items, campusFilter]
  );

  // --- Chọn nhiều dòng để xóa hàng loạt (Sin yêu cầu 2026-10-05) ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const allOnPageSelected = filtered.length > 0 && filtered.every((row) => selectedIds.has(row.id));
  const toggleSelectAllOnPage = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const row of filtered) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  };
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleBulkDelete = async () => {
    setDeleting(true);
    let okCount = 0;
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      try {
        await api.delete(`/api/work-schedule/exam-shifts/${id}`);
        okCount++;
      } catch {
        // tiếp tục xóa các dòng còn lại, báo tổng kết sau — cùng cách
        // handleBulkApprove làm ở EventsListPage.tsx.
      }
    }
    setDeleting(false);
    setConfirmDeleteOpen(false);
    setSelectedIds(new Set());
    setToast({
      message: okCount === ids.length ? `Đã xóa ${okCount} ca trông thi.` : `Đã xóa ${okCount}/${ids.length} ca (một số ca không thể xóa).`,
      severity: okCount > 0 ? 'success' : 'error'
    });
    load();
  };

  return (
    <>
      <PageHeader
        title="Lịch trông thi"
        icon={<CalendarClock />}
        action={
          isLeadership ? (
            <>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <CirclePlus className="size-4" />
                Tạo ca trông thi
              </Button>
              <Button onClick={() => setImportOpen(true)}>
                <FileUp className="size-4" />
                Nhập từ file
              </Button>
            </>
          ) : undefined
        }
      />

      {toast && (
        <Alert className={`mb-4 ${toast.severity === 'error' ? 'border-red-200 bg-red-50' : 'border-emerald-200 bg-emerald-50'}`}>
          <AlertDescription className={toast.severity === 'error' ? 'text-red-700' : 'text-emerald-700'}>{toast.message}</AlertDescription>
        </Alert>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && isLeadership ? (
            <>
              <span className="text-sm font-medium text-slate-600">Đã chọn {selectedIds.size}</span>
              <Button variant="outline" size="sm" className="text-red-600" onClick={() => setConfirmDeleteOpen(true)}>
                <X className="size-4" />
                Xóa
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                Bỏ chọn
              </Button>
            </>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Tháng</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-56 sm:w-72">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Tìm theo tên GV (tiết đầu hoặc tiết sau)"
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              className="pl-9"
            />
          </div>

          <FilterPopover
            activeCount={activeFilterCount}
            onClear={() => {
              setDateFilter('');
              setSubjectFilter('');
              setClassFilter('');
              setCampusFilter(ALL_CAMPUS);
            }}
          >
                <div>
                  <Label htmlFor="exam-filter-date" className="mb-1.5 block">
                    Ngày
                  </Label>
                  <Input id="exam-filter-date" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
                </div>
                <div>
                  <Label className="mb-1.5 block">Cơ sở</Label>
                  <Select value={campusFilter} onValueChange={setCampusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_CAMPUS}>Tất cả cơ sở</SelectItem>
                      {CAMPUS_IDS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CAMPUS_LABEL[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="exam-filter-subject" className="mb-1.5 block">
                    Môn khảo sát
                  </Label>
                  <Input id="exam-filter-subject" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="VD: Toán" />
                </div>
                <div>
                  <Label htmlFor="exam-filter-class" className="mb-1.5 block">
                    Lớp
                  </Label>
                  <Input id="exam-filter-class" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} placeholder="VD: 8A1" />
                </div>
          </FilterPopover>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
              {isLeadership && (
                <TableHead className="w-10">
                  <Checkbox checked={allOnPageSelected} onCheckedChange={(v) => toggleSelectAllOnPage(Boolean(v))} aria-label="Chọn tất cả" />
                </TableHead>
              )}
              <TableHead>Ngày</TableHead>
              <TableHead>Buổi</TableHead>
              <TableHead>Tiết KS</TableHead>
              <TableHead>Giờ</TableHead>
              <TableHead>Môn khảo sát</TableHead>
              <TableHead>Lớp</TableHead>
              <TableHead>Cơ sở</TableHead>
              <TableHead>GV tiết đầu</TableHead>
              <TableHead>GV tiết sau</TableHead>
              <TableHead>Ghi chú</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow>
                <TableCell colSpan={isLeadership ? 11 : 10} className="py-8 text-center text-sm text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={isLeadership ? 11 : 10} className="py-8 text-center text-sm text-slate-400">
                  Không có ca trông thi nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={row.id}>
                {isLeadership && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(v) => toggleSelectOne(row.id, Boolean(v))}
                      aria-label={`Chọn ca ${row.examDate}`}
                    />
                  </TableCell>
                )}
                <TableCell>{formatExamDate(row.examDate)}</TableCell>
                <TableCell>{row.session || '—'}</TableCell>
                <TableCell>{row.periodLabel || '—'}</TableCell>
                <TableCell>{row.timeLabel || '—'}</TableCell>
                <TableCell>{row.subject || '—'}</TableCell>
                <TableCell>{row.className || '—'}</TableCell>
                <TableCell>{CAMPUS_LABEL[row.campusId] || row.campusId}</TableCell>
                <TableCell>{row.firstProctorLabel || '—'}</TableCell>
                <TableCell>{row.secondProctorLabel || '—'}</TableCell>
                <TableCell className="text-slate-500">{row.note || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ExamImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
      <ExamShiftCreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={load} />

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xóa {selectedIds.size} ca trông thi?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600">Hành động này không thể hoàn tác. Các ca trông thi đã chọn sẽ bị xóa vĩnh viễn.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteOpen(false)} disabled={deleting}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Đang xóa...' : 'Xóa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
