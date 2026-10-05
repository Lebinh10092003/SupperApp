/**
 * ExamSchedulePage.tsx — "Lịch trông thi" (§17-25
 * huong_dan_lich_cong_tac_giao_viec.md). Tra cứu dữ liệu đã import: lọc
 * theo ngày/môn/lớp/giáo viên (GV tiết đầu HOẶC GV tiết sau — §25), import
 * file mới (ExamImportDialog.tsx, admin/lãnh đạo mới thấy nút).
 */
import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, FileUp, Search, X } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { useActor } from './hooks/useActor';
import { CAMPUS_IDS, CAMPUS_LABEL } from './constants';
import { ExamImportDialog } from './components/ExamImportDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export default function ExamSchedulePage() {
  const { hasRole } = useActor();
  const isLeadership = hasRole('R.PRINCIPAL') || hasRole('R.VICE_PRINCIPAL');

  const [month, setMonth] = useState(monthNow());
  const [dateFilter, setDateFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [campusFilter, setCampusFilter] = useState(ALL_CAMPUS);

  const [items, setItems] = useState<ExamShift[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

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

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const filtered = useMemo(
    () => (campusFilter === ALL_CAMPUS ? items : items.filter((i) => i.campusId === campusFilter)),
    [items, campusFilter]
  );

  return (
    <>
      <PageHeader
        title="Lịch trông thi"
        icon={<CalendarClock />}
        action={
          isLeadership ? (
            <Button onClick={() => setImportOpen(true)}>
              <FileUp className="size-4" />
              Nhập từ file
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Tháng</label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Ngày</label>
          <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="w-40" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Cơ sở</label>
          <Select value={campusFilter} onValueChange={setCampusFilter}>
            <SelectTrigger className="w-44">
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
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-500">Môn khảo sát</label>
          <Input value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="VD: Toán" className="w-36" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Lớp</label>
          <Input value={classFilter} onChange={(e) => setClassFilter(e.target.value)} placeholder="VD: 8A1" className="w-28" />
        </div>
        <div className="relative">
          <label className="mb-1 block text-xs font-medium text-slate-500">Giáo viên (tiết đầu hoặc tiết sau)</label>
          <Search className="pointer-events-none absolute top-[34px] left-2.5 size-3.5 text-slate-400" />
          <Input value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)} placeholder="Tìm tên GV..." className="w-52 pl-7" />
        </div>
        <Button variant="outline" onClick={load}>
          Lọc
        </Button>
        {(dateFilter || subjectFilter || classFilter || teacherFilter || campusFilter !== ALL_CAMPUS) && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setDateFilter('');
              setSubjectFilter('');
              setClassFilter('');
              setTeacherFilter('');
              setCampusFilter(ALL_CAMPUS);
              setTimeout(load, 0);
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-500">
                  Đang tải...
                </TableCell>
              </TableRow>
            )}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-8 text-center text-sm text-slate-400">
                  Không có ca trông thi nào khớp bộ lọc.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.examDate}</TableCell>
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
    </>
  );
}
