import { useEffect, useState, useMemo } from 'react';
import { Upload, Undo2, Search, CalendarDays, CheckCircle2, Download, Loader2 } from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { api } from '../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

export default function SchedulesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [msg, setMsg] = useState<{ text: string; severity: 'success' | 'info' | 'error' } | null>(null);
  const [batch, setBatch] = useState(localStorage.getItem('scheduleBatch') || '');
  const [dayTab, setDayTab] = useState<number>(0);
  const [q, setQ] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const load = () => {
    setLoading(true);
    api<{ items: any[] }>('/api/schedules')
      .then((x) => {
        setItems(x.items || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const parse = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.trim().split(/\r?\n/);
      if (lines.length < 2) {
        setMsg({ text: 'File CSV không có dữ liệu!', severity: 'error' });
        return;
      }
      const h = lines[0]!.replace(/^﻿/, '').split(',').map((x) => x.trim());
      const data = lines.slice(1).map((l) =>
        Object.fromEntries(l.split(',').map((v, i) => [h[i], v.trim()]))
      );
      setRows(data);
      const p = await api<any>('/api/schedules/import/preview', {
        method: 'POST',
        body: JSON.stringify({ rows: data })
      });
      setPreviewData(p);
      setPreviewOpen(true);
    } catch (e: any) {
      setMsg({ text: `Lỗi đọc CSV: ${e.message}`, severity: 'error' });
    }
  };

  const imp = async () => {
    try {
      const r = await api<any>('/api/schedules/import', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });
      setBatch(r.importBatchId);
      localStorage.setItem('scheduleBatch', r.importBatchId);
      setMsg({ text: `Đã import thành công ${r.imported} tiết học vào thời khóa biểu!`, severity: 'success' });
      setPreviewOpen(false);
      load();
    } catch (e: any) {
      setMsg({ text: `Lỗi import: ${e.message}`, severity: 'error' });
    }
  };

  const rollback = async () => {
    if (!batch) return;
    try {
      await api(`/api/schedules/import/${batch}`, { method: 'DELETE' });
      setBatch('');
      localStorage.removeItem('scheduleBatch');
      setMsg({ text: 'Đã rollback đợt import gần nhất thành công!', severity: 'info' });
      load();
    } catch (e: any) {
      setMsg({ text: `Lỗi rollback: ${e.message}`, severity: 'error' });
    }
  };

  const downloadSampleTemplate = () => {
    const template = `dayOfWeek,period,startTime,endTime,className,subject,teacherEmail,meetingCode\n2,1,07:30,08:15,9A1,Toán học,giaovien@thcs-giangvo.edu.vn,gv-9a1-mat\n2,2,08:20,09:05,9A1,Ngữ văn,giaovien@thcs-giangvo.edu.vn,gv-9a1-lit\n`;
    const blob = new Blob(['﻿' + template], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mau-thoi-khoa-bieu.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = useMemo(() => {
    return items.filter((x) => {
      const matchDay = dayTab === 0 || x.dayOfWeek === dayTab + 1;
      const query = q.toLowerCase();
      const matchQuery =
        !query ||
        String(x.className || '').toLowerCase().includes(query) ||
        String(x.subject || '').toLowerCase().includes(query) ||
        String(x.teacherEmail || '').toLowerCase().includes(query);
      return matchDay && matchQuery;
    });
  }, [items, dayTab, q]);

  const dayNames = ['Tất cả', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  return (
    <>
      <PageHeader
        title="Thời khóa biểu"
        icon={<CalendarDays />}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={downloadSampleTemplate} className="font-semibold">
              <Download className="size-4" />
              Tải CSV Mẫu
            </Button>
            <Button asChild className="relative font-bold">
              <label>
                <Upload className="size-4" />
                Import CSV
                <input
                  type="file"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  accept=".csv"
                  onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
                />
              </label>
            </Button>
            {batch && (
              <Button
                variant="outline"
                onClick={rollback}
                className="border-amber-300 font-semibold text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              >
                <Undo2 className="size-4" />
                Rollback Import
              </Button>
            )}
          </div>
        }
      />

      {msg && (
        <Alert
          className={cn(
            'mb-4',
            msg.severity === 'error'
              ? 'border-red-200 bg-red-50'
              : msg.severity === 'success'
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-blue-200 bg-secondary'
          )}
        >
          <AlertDescription
            className={cn(msg.severity === 'error' ? 'text-red-700' : msg.severity === 'success' ? 'text-emerald-700' : 'text-blue-800')}
          >
            {msg.text}
          </AlertDescription>
        </Alert>
      )}

      {/* Filter Tabs and Search Bar */}
      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Tabs value={String(dayTab)} onValueChange={(v) => setDayTab(Number(v))} className="overflow-x-auto md:basis-2/3">
            <TabsList>
              {dayNames.map((d, i) => (
                <TabsTrigger key={d} value={String(i)} className="font-bold">
                  {d}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative md:basis-1/3">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input placeholder="Tìm theo lớp, môn, giáo viên..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
          </div>
        </div>
      </div>

      {/* Timetable Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Thứ</TableHead>
                <TableHead className="w-24">Tiết</TableHead>
                <TableHead className="w-28">Thời gian</TableHead>
                <TableHead>Lớp học</TableHead>
                <TableHead>Môn học</TableHead>
                <TableHead>Giáo viên phụ trách</TableHead>
                <TableHead>Google Meet Code</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <Loader2 className="mx-auto size-7 animate-spin text-primary" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <p className="mb-1 text-[2.5rem] text-slate-400">📅</p>
                    <p className="mb-1 text-lg font-bold text-slate-800">Chưa có tiết học nào trong thời khóa biểu</p>
                    <p className="mx-auto mb-5 max-w-[440px] text-sm text-slate-500">
                      Vui lòng sử dụng chức năng <strong>Import CSV</strong> để tải lịch học của trường lên hệ thống.
                    </p>
                    <Button asChild className="relative font-bold">
                      <label>
                        <Upload className="size-4" />
                        Tải File CSV Thời Khóa Biểu
                        <input
                          type="file"
                          className="absolute inset-0 cursor-pointer opacity-0"
                          accept=".csv"
                          onChange={(e) => e.target.files?.[0] && parse(e.target.files[0])}
                        />
                      </label>
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((x) => (
                  <TableRow key={x.id}>
                    <TableCell>
                      <Badge variant="outline" className="border-transparent bg-secondary font-bold text-[#1d4ed8]">
                        Thứ {x.dayOfWeek}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-transparent bg-slate-100 font-bold text-slate-700">
                        Tiết {x.period}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[0.8125rem] text-slate-500">
                      {x.startTime && x.endTime ? `${x.startTime} – ${x.endTime}` : x.startTime || x.endTime || '—'}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-bold text-[#0f172a]">{x.className}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-primary">{x.subject}</span>
                    </TableCell>
                    <TableCell className="text-slate-600">{x.teacherEmail}</TableCell>
                    <TableCell>
                      {x.meetingCode || x.spaceName ? (
                        <Badge variant="outline" className="gap-1 border-transparent bg-emerald-50 font-semibold text-emerald-600">
                          <CheckCircle2 className="size-3.5" />
                          {x.meetingCode || x.spaceName}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Chưa cấu hình</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* CSV Preview & Confirm Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Xem trước dữ liệu Thời khóa biểu CSV</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="flex flex-col gap-4">
              <div className="flex gap-3">
                <Alert className="flex-1 border-emerald-200 bg-emerald-50">
                  <AlertDescription className="text-emerald-700">
                    <strong>{previewData.valid}</strong> dòng hợp lệ
                  </AlertDescription>
                </Alert>
                {previewData.invalid > 0 && (
                  <Alert className="flex-1 border-red-200 bg-red-50">
                    <AlertDescription className="text-red-700">
                      <strong>{previewData.invalid}</strong> dòng lỗi
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <p className="text-sm font-semibold text-[#0f172a]">Dữ liệu mẫu 5 dòng đầu:</p>
              <div className="max-h-60 overflow-auto rounded-md border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Thứ</TableHead>
                      <TableHead>Tiết</TableHead>
                      <TableHead>Lớp</TableHead>
                      <TableHead>Môn</TableHead>
                      <TableHead>Giáo viên</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(previewData.sample || []).slice(0, 5).map((s: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell>{s.dayOfWeek}</TableCell>
                        <TableCell>{s.period}</TableCell>
                        <TableCell>{s.className}</TableCell>
                        <TableCell>{s.subject}</TableCell>
                        <TableCell>{s.teacherEmail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Hủy
            </Button>
            <Button onClick={imp}>Xác nhận Import vào hệ thống</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
