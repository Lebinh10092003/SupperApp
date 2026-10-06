/**
 * ExamImportDialog.tsx — import file Lịch trông thi (§17-25
 * huong_dan_lich_cong_tac_giao_viec.md). Chọn Điểm trường TRƯỚC khi import
 * (§18, áp dụng cho toàn bộ file) rồi tải file CSV đúng 11 cột (§19). Parse
 * CSV ở CLIENT chỉ để xem trước — server (`importExamShifts`,
 * exam-schedule.service.ts) tự validate lại HẾT và chịu trách nhiệm atomic
 * thật (§21), không tin riêng phần kiểm tra ở đây.
 *
 * KHÔNG dùng thư viện đọc Excel (gói `xlsx`/SheetJS trên npm có 2 lỗ hổng
 * bảo mật chưa vá — GHSA-4r6h-8v6p-xvw6/GHSA-5pgg-2g8v-p4x9) — chỉ nhận
 * CSV, trường có thể "Save As CSV" từ Excel trước khi tải lên.
 */
import { useState } from 'react';
import { Download, FileUp, Loader2, TriangleAlert } from 'lucide-react';
import { api } from '../../../services/api';
import { CAMPUS_IDS, CAMPUS_LABEL } from '../constants';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// §19 — đúng 11 cột, thứ tự không bắt buộc (đọc theo TÊN cột ở dòng header).
const COLUMNS: { key: string; header: string; required: boolean }[] = [
  { key: 'stt', header: 'STT', required: false },
  { key: 'examDate', header: 'Ngày', required: true },
  { key: 'dayOfWeek', header: 'Thứ', required: false },
  { key: 'session', header: 'Buổi', required: false },
  { key: 'periodLabel', header: 'Tiết KS', required: false },
  { key: 'timeLabel', header: 'Giờ', required: false },
  { key: 'subject', header: 'Môn khảo sát', required: false },
  { key: 'className', header: 'Lớp', required: false },
  { key: 'firstProctorName', header: 'GV tiết đầu', required: false },
  { key: 'secondProctorName', header: 'GV tiết sau', required: false },
  { key: 'note', header: 'Ghi chú', required: false }
];

function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd');
}
function normalizeHeader(s: string): string {
  return stripDiacritics(s).toLowerCase().replace(/[^a-z0-9]/g, '');
}
const HEADER_LOOKUP = new Map(COLUMNS.map((c) => [normalizeHeader(c.header), c.key]));

/** Ví dụ 1 dòng dữ liệu mẫu cho file mẫu tải về — đúng key trong COLUMNS. */
const SAMPLE_ROW: Record<string, string> = {
  stt: '1',
  examDate: '20/12/2026',
  dayOfWeek: 'Thứ Hai',
  session: 'Sáng',
  periodLabel: '1',
  timeLabel: '07:30',
  subject: 'Toán',
  className: '8A1',
  firstProctorName: 'Nguyễn Văn A',
  secondProctorName: 'Trần Thị B',
  note: ''
};

/** Sinh file CSV mẫu TỪ CHÍNH `COLUMNS` (header cột ngày chỉ là "Ngày",
 * không nhét định dạng vào tên cột — Sin yêu cầu 2026-10-05) — đảm bảo
 * template tải về và parser phía trên LUÔN khớp nhau, không lệch khi 1 bên
 * đổi mà quên đổi bên kia. */
function downloadTemplateCsv() {
  const header = COLUMNS.map((c) => c.header).join(',');
  const sample = COLUMNS.map((c) => SAMPLE_ROW[c.key] ?? '').join(',');
  const csv = '﻿' + header + '\n' + sample + '\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mau-lich-trong-thi.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/** Parser CSV tối giản (đủ dùng cho file xuất từ Excel/Google Sheets) —
 * không xử lý escape RFC 4180 đầy đủ, nhưng đủ cho dấu phẩy trong ngoặc kép. */
function parseCsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/^﻿/, '').split('\n').filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const cells: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === ',' && !inQuotes) {
        cells.push(cur.trim());
        cur = '';
      } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  });
}

interface ParsedRow {
  rowNumber: number; // số dòng dữ liệu thật (không tính header) — khớp số báo lỗi từ server.
  values: Record<string, string>;
}

interface ImportServerError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export function ExamImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const [campusId, setCampusId] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [serverErrors, setServerErrors] = useState<ImportServerError[]>([]);
  const [importing, setImporting] = useState(false);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const reset = () => {
    setCampusId('');
    setFileName('');
    setRows([]);
    setParseError('');
    setServerErrors([]);
    setSuccessCount(null);
  };
  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File) => {
    setServerErrors([]);
    setSuccessCount(null);
    setParseError('');
    setFileName(file.name);
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length < 2) {
      setRows([]);
      setParseError('File không có dữ liệu (cần ít nhất 1 dòng tiêu đề + 1 dòng dữ liệu).');
      return;
    }
    const header = table[0]!.map((h) => normalizeHeader(h));
    const unknownRequired = COLUMNS.filter((c) => c.required && !header.some((h) => HEADER_LOOKUP.get(h) === c.key));
    if (unknownRequired.length > 0) {
      setRows([]);
      setParseError(`Thiếu cột bắt buộc: ${unknownRequired.map((c) => c.header).join(', ')}.`);
      return;
    }
    const parsed: ParsedRow[] = table.slice(1).map((cells, i) => {
      const values: Record<string, string> = {};
      header.forEach((h, colIdx) => {
        const key = HEADER_LOOKUP.get(h);
        if (key) values[key] = (cells[colIdx] || '').trim();
      });
      return { rowNumber: i + 1, values };
    });
    setRows(parsed);
  };

  const submitImport = async () => {
    setImporting(true);
    setServerErrors([]);
    try {
      await api.post('/api/work-schedule/exam-shifts/import', {
        campusId,
        rows: rows.map((r) => ({
          rowNumber: r.rowNumber,
          examDate: r.values.examDate || '',
          session: r.values.session,
          periodLabel: r.values.periodLabel,
          timeLabel: r.values.timeLabel,
          subject: r.values.subject,
          className: r.values.className,
          firstProctorName: r.values.firstProctorName,
          secondProctorName: r.values.secondProctorName,
          note: r.values.note
        }))
      });
      setSuccessCount(rows.length);
      setRows([]);
      onImported();
    } catch (e: any) {
      // §22 — route trả { error, errors: [{row,column,value,message}] } khi
      // import atomic thất bại; `api` (services/api.ts) chỉ giữ lại
      // `error.message` mặc định, nên đọc lại response thô ở đây để lấy
      // đủ danh sách lỗi theo dòng.
      if (Array.isArray(e?.errors)) {
        setServerErrors(e.errors);
      } else {
        setParseError(e.message || 'Import thất bại — không rõ nguyên nhân.');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nhập Lịch trông thi từ file</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Button type="button" variant="outline" size="sm" onClick={downloadTemplateCsv} className="self-start">
            <Download className="size-4" />
            Tải file mẫu
          </Button>

          <div>
            <Label className="mb-1.5 block">Điểm trường *</Label>
            <Select value={campusId} onValueChange={setCampusId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Chọn điểm trường — áp dụng cho toàn bộ file" />
              </SelectTrigger>
              <SelectContent>
                {CAMPUS_IDS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CAMPUS_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1.5 block">File CSV (11 cột: {COLUMNS.map((c) => c.header).join(', ')})</Label>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!campusId} asChild={false} onClick={() => document.getElementById('exam-import-file')?.click()}>
                <FileUp className="size-4" />
                Chọn file CSV
              </Button>
              <input
                id="exam-import-file"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
              {fileName && <span className="text-xs text-slate-500">{fileName} — {rows.length} dòng</span>}
            </div>
            {!campusId && <p className="mt-1 text-xs text-amber-600">Chọn Điểm trường trước khi tải file.</p>}
          </div>

          {parseError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">{parseError}</AlertDescription>
            </Alert>
          )}

          {serverErrors.length > 0 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                <p className="mb-1.5 flex items-center gap-1.5 font-semibold">
                  <TriangleAlert className="size-4" />
                  Import thất bại — file có {serverErrors.length} dòng lỗi, KHÔNG dòng nào được import.
                </p>
                <ul className="flex flex-col gap-1 text-xs">
                  {serverErrors.map((e, i) => (
                    <li key={i}>
                      Dòng {e.row}, cột "{e.column}": giá trị "{e.value}" — {e.message}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {successCount !== null && (
            <Alert className="border-emerald-200 bg-emerald-50">
              <AlertDescription className="text-emerald-700">Đã import thành công {successCount} dòng.</AlertDescription>
            </Alert>
          )}

          {rows.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Ngày</TableHead>
                    <TableHead>Buổi</TableHead>
                    <TableHead>Môn</TableHead>
                    <TableHead>Lớp</TableHead>
                    <TableHead>GV tiết đầu</TableHead>
                    <TableHead>GV tiết sau</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.rowNumber} className={serverErrors.some((e) => e.row === r.rowNumber) ? 'bg-red-50' : undefined}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell>{r.values.examDate || '—'}</TableCell>
                      <TableCell>{r.values.session || '—'}</TableCell>
                      <TableCell>{r.values.subject || '—'}</TableCell>
                      <TableCell>{r.values.className || '—'}</TableCell>
                      <TableCell>{r.values.firstProctorName || '—'}</TableCell>
                      <TableCell>{r.values.secondProctorName || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="border-slate-200 bg-slate-50">
            <Download className="size-4" />
            <AlertDescription className="text-slate-600">
              {/* Header cột CHỈ là tên cột, không nhét định dạng vào tên (Sin
                  yêu cầu 2026-10-05: "KHÔNG dùng 'Ngày (dd/mm/yyyy)' hay biến
                  thể chứa format trong tên cột") — hướng dẫn định dạng để
                  RIÊNG 1 câu phía sau, không ghép dính vào tên cột "Ngày". */}
              Dòng đầu file phải là tiêu đề đúng tên cột (không phân biệt hoa/thường, có/không dấu): {COLUMNS.map((c) => c.header).join(', ')}.
              <br />
              Cột "Ngày" nhập theo định dạng dd/mm/yyyy (VD: 20/12/2026).
            </AlertDescription>
          </Alert>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Đóng
          </Button>
          <Button onClick={submitImport} disabled={!campusId || rows.length === 0 || importing}>
            {importing && <Loader2 className="size-4 animate-spin" />}
            {importing ? 'Đang import...' : `Import ${rows.length} dòng`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
