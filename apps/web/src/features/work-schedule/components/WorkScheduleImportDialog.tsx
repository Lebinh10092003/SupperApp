import { useState } from 'react';
import readXlsxFile from 'read-excel-file';
import { Bot, Download, FileSpreadsheet, Loader2, TriangleAlert } from 'lucide-react';
import { api } from '../../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type Kind = 'events' | 'tasks';
type Row = Record<string, unknown>;
interface PreviewError { row: number; column: string; value: string; message: string }
interface PreviewResponse { valid: boolean; errors: PreviewError[]; rows: Row[] }

const EVENT_COLUMNS = [
  ['title', 'Tiêu đề'], ['date', 'Ngày'], ['startTime', 'Giờ bắt đầu'], ['endTime', 'Giờ kết thúc'], ['location', 'Địa điểm'], ['campusId', 'Cơ sở'], ['scope', 'Phạm vi'], ['chairPerId', 'Chủ trì'], ['participantPerIds', 'Thành phần'], ['description', 'Nội dung']
] as const;
const TASK_COLUMNS = [
  ['title', 'Tên việc'], ['startAt', 'Bắt đầu'], ['dueAt', 'Hạn hoàn thành'], ['location', 'Địa điểm'], ['campusId', 'Cơ sở'], ['assigneePerId', 'Người thực hiện'], ['collaboratorPerIds', 'Người phối hợp'], ['description', 'Nội dung']
] as const;

function normalize(value: unknown) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
}
function importCellValue(key: string, value: unknown): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return String(value ?? '').trim();
  const pad = (part: number) => String(part).padStart(2, '0');
  if (key === 'date') return `${pad(value.getDate())}/${pad(value.getMonth() + 1)}/${value.getFullYear()}`;
  if (key === 'startTime' || key === 'endTime') return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return value.toISOString();
}
function csvRows(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(value); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); row = []; value = ''; }
    else value += char;
  }
  row.push(value); if (row.some((cell) => cell.trim())) rows.push(row); return rows;
}
function mapTable(table: unknown[][], kind: Kind): Row[] {
  if (table.length < 2) throw new Error('File cần một dòng tiêu đề và ít nhất một dòng dữ liệu.');
  const columns = kind === 'events' ? EVENT_COLUMNS : TASK_COLUMNS;
  const lookup = new Map(columns.map(([key, label]) => [normalize(label), key]));
  const keys = table[0]!.map((cell) => lookup.get(normalize(cell)));
  if (!keys.includes('title')) throw new Error(`Thiếu cột ${kind === 'events' ? 'Tiêu đề' : 'Tên việc'}.`);
  return table.slice(1).filter((cells) => cells.some((cell) => String(cell ?? '').trim())).map((cells, index) => {
    const row: Row = { rowNumber: index + 1 };
    keys.forEach((key, column) => { if (key) row[key] = importCellValue(key, cells[column]); });
    return row;
  });
}
function downloadTemplate(kind: Kind) {
  const columns = kind === 'events' ? EVENT_COLUMNS : TASK_COLUMNS;
  const sample = kind === 'events'
    ? ['Họp tổ chuyên môn', '07/10/2026', '08:00', '09:00', 'Phòng họp', 'MAIN_CAMPUS', 'Cá nhân', '', 'PER.001;PER.002', 'Nội dung họp']
    : ['Chuẩn bị báo cáo', '2026-10-07T08:00:00+07:00', '2026-10-08T17:00:00+07:00', 'Văn phòng', 'MAIN_CAMPUS', 'PER.001', 'PER.002', 'Nội dung công việc'];
  const csv = `\uFEFF${columns.map(([, label]) => `"${label}"`).join(',')}\n${sample.map((cell) => `"${cell}"`).join(',')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = kind === 'events' ? 'mau-import-lich-cong-tac.csv' : 'mau-import-giao-viec.csv'; link.click(); URL.revokeObjectURL(url);
}
function aiPrompt(kind: Kind) {
  return kind === 'events'
    ? 'Hãy chuyển nội dung của tôi thành JSON array. Mỗi phần tử chỉ gồm: title, date (dd/mm/yyyy), startTime (HH:mm), endTime (HH:mm hoặc rỗng), location, campusId, scope (CAMPUS hoặc SCHOOL_WIDE), chairPerId, participantPerIds (mảng), description. Không đoán dữ liệu thiếu; để rỗng để hệ thống báo kiểm tra.'
    : 'Hãy chuyển nội dung của tôi thành JSON array. Mỗi phần tử chỉ gồm: title, startAt, dueAt (ISO 8601 có múi giờ), location, campusId, assigneePerId, collaboratorPerIds (mảng), description. Không đoán người hoặc thời hạn còn thiếu; để rỗng để hệ thống báo kiểm tra.';
}

export function WorkScheduleImportDialog({ open, kind, onClose, onImported }: { open: boolean; kind: Kind; onClose: () => void; onImported: () => void }) {
  const [rows, setRows] = useState<Row[]>([]); const [preview, setPreview] = useState<PreviewResponse | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [aiText, setAiText] = useState('');
  const title = kind === 'events' ? 'Import lịch công tác' : 'Import giao việc';
  const reset = () => { setRows([]); setPreview(null); setError(''); setAiText(''); };
  const loadFile = async (file: File) => {
    setError(''); setPreview(null);
    try {
      if (/\.xlsm$/i.test(file.name)) throw new Error('Không nhận file có macro (.xlsm). Hãy lưu thành .xlsx hoặc .csv.');
      const table = /\.xlsx$/i.test(file.name) ? await readXlsxFile(file) : csvRows(await file.text());
      setRows(mapTable(table, kind));
    } catch (caught: any) { setRows([]); setError(caught.message || 'Không đọc được file.'); }
  };
  const parseAi = () => { try { const parsed = JSON.parse(aiText); if (!Array.isArray(parsed)) throw new Error(); setRows(parsed.map((row, index) => ({ ...row, rowNumber: index + 1 }))); setPreview(null); setError(''); } catch { setError('Kết quả AI phải là một JSON array hợp lệ. Không có dữ liệu nào được lưu.'); } };
  const runPreview = async () => { setBusy(true); setError(''); try { setPreview(await api.post<PreviewResponse>('/api/work-schedule/imports/preview', { kind, rows })); } catch (caught: any) { setError(caught.message || 'Không kiểm tra được dữ liệu.'); } finally { setBusy(false); } };
  const apply = async () => { setBusy(true); setError(''); try { await api.post('/api/work-schedule/imports/apply', { kind, rows, confirm: true }); onImported(); reset(); onClose(); } catch (caught: any) { setError(caught.message || 'Import thất bại; không có dữ liệu nào được lưu.'); } finally { setBusy(false); } };
  const displayRows = preview?.rows || rows;
  return <Dialog open={open} onOpenChange={(value) => { if (!value) { reset(); onClose(); } }}><DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="space-y-4">
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => downloadTemplate(kind)}><Download className="size-4" />Tải file mẫu</Button><Button variant="outline" onClick={() => document.getElementById(`v3-import-${kind}`)?.click()}><FileSpreadsheet className="size-4" />Chọn CSV/XLSX</Button><input id={`v3-import-${kind}`} className="hidden" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadFile(file); event.target.value = ''; }} /></div>
    <Alert><Bot className="size-4" /><AlertDescription><p className="font-semibold">Nhập qua AI chat (có kiểm tra lại)</p><p className="mt-1 text-xs">Sao chép prompt này vào công cụ AI của bạn, rồi dán JSON trả về bên dưới. Hệ thống không tự gửi dữ liệu ra dịch vụ AI.</p><pre className="mt-2 whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs dark:bg-slate-900">{aiPrompt(kind)}</pre></AlertDescription></Alert>
    <div><Label className="mb-1.5 block">JSON từ AI</Label><Textarea rows={4} value={aiText} onChange={(event) => setAiText(event.target.value)} placeholder="Dán JSON array vào đây..." /><Button variant="outline" size="sm" className="mt-2" disabled={!aiText.trim()} onClick={parseAi}>Đọc JSON để xem trước</Button></div>
    {error && <Alert className="border-red-200 bg-red-50"><TriangleAlert className="size-4" /><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
    {!!preview?.errors.length && <Alert className="border-amber-200 bg-amber-50"><AlertDescription className="text-amber-800"><p className="font-semibold">Cần sửa {preview.errors.length} lỗi trước khi import:</p><ul className="mt-1 list-disc pl-5 text-xs">{preview.errors.map((item, index) => <li key={index}>Dòng {item.row}, {item.column}: {item.message}</li>)}</ul></AlertDescription></Alert>}
    {preview?.valid && <Alert className="border-emerald-200 bg-emerald-50"><AlertDescription className="text-emerald-700">Đã kiểm tra {preview.rows.length} dòng. Nhấn “Xác nhận import” để lưu.</AlertDescription></Alert>}
    {displayRows.length > 0 && <div className="max-h-72 overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{kind === 'events' ? 'Tiêu đề' : 'Tên việc'}</TableHead><TableHead>{kind === 'events' ? 'Thời gian' : 'Hạn hoàn thành'}</TableHead><TableHead>Cơ sở</TableHead><TableHead>{kind === 'events' ? 'Chủ trì' : 'Người thực hiện'}</TableHead></TableRow></TableHeader><TableBody>{displayRows.map((row, index) => <TableRow key={index}><TableCell>{String(row.rowNumber || index + 1)}</TableCell><TableCell>{String(row.title || '—')}</TableCell><TableCell>{String((kind === 'events' ? row.startAt || `${row.date || ''} ${row.startTime || ''}` : row.dueAt) || '—')}</TableCell><TableCell>{String(row.campusId || 'MAIN_CAMPUS')}</TableCell><TableCell>{String((kind === 'events' ? row.chairPerId : row.assigneePerId) || 'Mặc định là tôi')}</TableCell></TableRow>)}</TableBody></Table></div>}
  </div><DialogFooter><Button variant="ghost" onClick={() => { reset(); onClose(); }}>Đóng</Button>{!preview?.valid ? <Button disabled={rows.length === 0 || busy} onClick={runPreview}>{busy && <Loader2 className="size-4 animate-spin" />}Kiểm tra & xem trước</Button> : <Button disabled={busy} onClick={apply}>{busy && <Loader2 className="size-4 animate-spin" />}Xác nhận import {preview.rows.length} dòng</Button>}</DialogFooter></DialogContent></Dialog>;
}
