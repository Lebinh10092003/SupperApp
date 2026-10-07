import { useState } from 'react';
import type ExcelJS from 'exceljs';
import readXlsxFile from 'read-excel-file';
import { Bot, Download, FileSpreadsheet, Loader2, TriangleAlert } from 'lucide-react';
import { api } from '../../../services/api';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

type Kind = 'events' | 'tasks';
type Row = Record<string, unknown>;
interface PreviewError { row: number; column: string; value: string; message: string }
interface PreviewResponse { valid: boolean; errors: PreviewError[]; rows: Row[]; validCount: number; invalidCount: number }
interface ApplyResponse { imported: number; skipped: number; errors: PreviewError[] }

const EVENT_COLUMNS = [
  ['title', 'Tiêu đề'], ['date', 'Ngày'], ['startTime', 'Giờ bắt đầu'], ['endTime', 'Giờ kết thúc'], ['location', 'Địa điểm'], ['campusId', 'Cơ sở'], ['scope', 'Phạm vi'], ['chairPerId', 'Chủ trì'], ['participantPerIds', 'Thành phần'], ['description', 'Nội dung']
] as const;
const TASK_COLUMNS = [
  ['title', 'Tên việc'], ['startAt', 'Bắt đầu'], ['dueAt', 'Hạn hoàn thành'], ['location', 'Địa điểm'], ['campusId', 'Cơ sở'], ['assigneePerId', 'Người thực hiện'], ['collaboratorPerIds', 'Người phối hợp'], ['description', 'Nội dung']
] as const;
const columnsFor = (kind: Kind) => kind === 'events' ? EVENT_COLUMNS : TASK_COLUMNS;
function normalize(value: unknown) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, ''); }
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
  const lookup = new Map(columnsFor(kind).map(([key, label]) => [normalize(label), key]));
  const keys = table[0]!.map((cell) => lookup.get(normalize(cell)));
  if (!keys.includes('title')) throw new Error(`Thiếu cột ${kind === 'events' ? 'Tiêu đề' : 'Tên việc'}.`);
  return table.slice(1).filter((cells) => cells.some((cell) => String(cell ?? '').trim())).map((cells, index) => {
    const row: Row = { rowNumber: index + 2 };
    keys.forEach((key, column) => { if (key) row[key] = importCellValue(key, cells[column]); });
    return row;
  });
}
function saveBuffer(buffer: ExcelJS.Buffer, filename: string) {
  const url = URL.createObjectURL(new Blob([buffer as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url);
}
async function downloadTemplate(kind: Kind) {
  const ExcelJSRuntime = (await import('exceljs')).default;
  const workbook = new ExcelJSRuntime.Workbook();
  const sheet = workbook.addWorksheet(kind === 'events' ? 'Lịch công tác' : 'Giao việc', { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns = columnsFor(kind);
  sheet.columns = columns.map(([key, header]) => ({ key, header, width: key === 'description' ? 34 : Math.max(15, header.length + 4) }));
  sheet.addRow(kind === 'events'
    ? { title: 'Họp tổ chuyên môn', date: '15/10/2026', startTime: '08:00', endTime: '09:00', location: 'Phòng họp', campusId: 'Điểm trường chính', scope: 'Cá nhân', chairPerId: 'Nguyễn Văn A', participantPerIds: 'Trần Thị B; Lê Văn C', description: 'Nội dung họp' }
    : { title: 'Chuẩn bị báo cáo', startAt: '2026-10-15T08:00:00+07:00', dueAt: '2026-10-16T17:00:00+07:00', location: 'Văn phòng', campusId: 'Điểm trường chính', assigneePerId: 'Nguyễn Văn A', collaboratorPerIds: 'Trần Thị B', description: 'Nội dung công việc' });
  const header = sheet.getRow(1);
  header.height = 24; header.font = { bold: true, color: { argb: 'FFFFFFFF' } }; header.alignment = { vertical: 'middle' }; header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  sheet.getRow(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + columns.length)}2` };
  const campusColumn = columns.findIndex(([key]) => key === 'campusId') + 1;
  for (let row = 2; row <= 500; row += 1) sheet.getCell(row, campusColumn).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Điểm trường chính,Phân hiệu 1,Phân hiệu 2"'] };
  if (kind === 'events') for (let row = 2; row <= 500; row += 1) sheet.getCell(row, 7).dataValidation = { type: 'list', allowBlank: false, formulae: ['"Cá nhân,Toàn trường"'] };
  const help = workbook.addWorksheet('Hướng dẫn'); help.columns = [{ width: 24 }, { width: 90 }];
  help.addRows([['Quy tắc', 'Giá trị chấp nhận'], ['Tên người', 'Nhập tên hiển thị tiếng Việt. Nếu có người trùng tên, dòng sẽ bị từ chối để bạn xác định lại.'], ['Cơ sở', 'Điểm trường chính / Phân hiệu 1 / Phân hiệu 2'], ...(kind === 'events' ? [['Phạm vi', 'Cá nhân / Toàn trường'], ['Thành phần', 'Nhiều người ngăn cách bằng dấu chấm phẩy (;)']] : [['Người phối hợp', 'Nhiều người ngăn cách bằng dấu chấm phẩy (;)']])]);
  help.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; help.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  saveBuffer(await workbook.xlsx.writeBuffer(), kind === 'events' ? 'mau-import-lich-cong-tac.xlsx' : 'mau-import-giao-viec.xlsx');
}
function errorColumns(error: PreviewError, kind: Kind): string[] {
  const text = normalize(error.column); const columns = columnsFor(kind);
  const direct = columns.filter(([, label]) => text.includes(normalize(label)) || normalize(label).includes(text)).map(([key]) => key);
  if (direct.length) return direct;
  if (text.includes('thoigian')) return kind === 'events' ? ['date', 'startTime', 'endTime', 'participantPerIds'] : ['startAt', 'dueAt'];
  return [];
}
async function downloadErrorWorkbook(kind: Kind, rows: Row[], errors: PreviewError[], invalidOnly: boolean) {
  const ExcelJSRuntime = (await import('exceljs')).default;
  const workbook = new ExcelJSRuntime.Workbook(); const sheet = workbook.addWorksheet('Dữ liệu lỗi', { views: [{ state: 'frozen', ySplit: 1 }] }); const columns = columnsFor(kind);
  sheet.columns = [{ key: 'rowNumber', header: 'Dòng gốc', width: 12 }, ...columns.map(([key, header]) => ({ key, header, width: key === 'description' ? 34 : 18 })), { key: '__errors', header: 'Lý do lỗi', width: 55 }];
  const invalidRows = new Set(errors.map((error) => error.row)); const output = invalidOnly ? rows.filter((row) => invalidRows.has(Number(row.rowNumber))) : rows;
  for (const source of output) {
    const rowErrors = errors.filter((error) => error.row === Number(source.rowNumber)); const added = sheet.addRow({ ...source, __errors: rowErrors.map((error) => `${error.column}: ${error.message}`).join(' | ') });
    for (const error of rowErrors) for (const key of errorColumns(error, kind)) { const cell = added.getCell(columns.findIndex(([columnKey]) => columnKey === key) + 2); cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }; cell.note = error.message; }
  }
  const header = sheet.getRow(1); header.font = { bold: true, color: { argb: 'FFFFFFFF' } }; header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };
  saveBuffer(await workbook.xlsx.writeBuffer(), invalidOnly ? 'cac-dong-import-loi.xlsx' : 'file-import-danh-dau-loi.xlsx');
}
function aiPrompt(kind: Kind) {
  return kind === 'events'
    ? 'Hãy chuyển nội dung thành JSON array gồm: title, date (dd/mm/yyyy), startTime (HH:mm), endTime, location, campusId (tên cơ sở tiếng Việt), scope (Cá nhân hoặc Toàn trường), chairPerId (tên người), participantPerIds (mảng tên người), description.'
    : 'Hãy chuyển nội dung thành JSON array gồm: title, startAt, dueAt (ISO 8601 có múi giờ), location, campusId (tên cơ sở tiếng Việt), assigneePerId (tên người), collaboratorPerIds (mảng tên người), description.';
}

export function WorkScheduleImportDialog({ open, kind, onClose, onImported, onToast }: { open: boolean; kind: Kind; onClose: () => void; onImported: () => void; onToast?: (message: string, severity: 'success' | 'error') => void }) {
  const [rows, setRows] = useState<Row[]>([]); const [preview, setPreview] = useState<PreviewResponse | null>(null); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0); const [stage, setStage] = useState(''); const [aiText, setAiText] = useState(''); const title = kind === 'events' ? 'Import lịch công tác' : 'Import giao việc';
  const reset = () => { setRows([]); setPreview(null); setError(''); setProgress(0); setStage(''); setAiText(''); };
  const loadFile = async (file: File) => { setError(''); setPreview(null); setBusy(true); setProgress(10); setStage('Đang đọc tệp…'); try { if (/\.xlsm$/i.test(file.name)) throw new Error('Không nhận file có macro (.xlsm). Hãy lưu thành .xlsx hoặc .csv.'); const table = /\.xlsx$/i.test(file.name) ? await readXlsxFile(file) : csvRows(await file.text()); setProgress(70); setStage('Đang chuẩn hoá dữ liệu…'); setRows(mapTable(table, kind)); setProgress(100); setStage(`Đã đọc ${Math.max(0, table.length - 1)} dòng.`); } catch (caught: any) { setRows([]); const message = caught.message || 'Không đọc được file.'; setError(message); onToast?.(message, 'error'); } finally { setBusy(false); } };
  const runPreview = async () => { setBusy(true); setError(''); setProgress(15); setStage('Đang gửi dữ liệu để kiểm tra…'); try { setProgress(45); const result = await api.post<PreviewResponse>('/api/work-schedule/imports/preview', { kind, rows }); setPreview(result); setProgress(100); setStage(result.errors.length ? `Hoàn tất: ${result.validCount} dòng hợp lệ, ${result.invalidCount} dòng lỗi.` : `Đã kiểm tra ${result.rows.length} dòng hợp lệ.`); } catch (caught: any) { const message = caught.message || 'Không kiểm tra được dữ liệu.'; setError(message); onToast?.(message, 'error'); } finally { setBusy(false); } };
  const apply = async (mode: 'all' | 'valid_only') => { setBusy(true); setError(''); setProgress(20); setStage('Đang xác nhận lại dữ liệu…'); try { setProgress(55); const result = await api.post<ApplyResponse>('/api/work-schedule/imports/apply', { kind, rows, confirm: true, mode }); setProgress(100); if (result.errors.length) await downloadErrorWorkbook(kind, rows, result.errors, true); onImported(); onToast?.(`Đã import ${result.imported} dòng${result.skipped ? `, bỏ qua ${result.skipped} dòng lỗi. File lỗi đã được tải xuống.` : '.'}`, 'success'); reset(); onClose(); } catch (caught: any) { const message = caught.message || 'Import thất bại; không có dữ liệu nào được lưu.'; setError(message); onToast?.(message, 'error'); } finally { setBusy(false); } };
  const parseAi = () => { try { const parsed = JSON.parse(aiText); if (!Array.isArray(parsed)) throw new Error(); setRows(parsed.map((row, index) => ({ ...row, rowNumber: index + 1 }))); setPreview(null); setError(''); setProgress(100); setStage(`Đã đọc ${parsed.length} dòng JSON.`); } catch { const message = 'Kết quả AI phải là một JSON array hợp lệ. Không có dữ liệu nào được lưu.'; setError(message); onToast?.(message, 'error'); } };
  // Keep the user's human-readable names visible; normalized IDs stay server-internal.
  const displayRows = rows;
  return <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) { reset(); onClose(); } }}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-x-hidden overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader><div className="min-w-0 space-y-4">
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void downloadTemplate(kind)}><Download className="size-4" />Tải mẫu XLSX</Button><Button variant="outline" disabled={busy} onClick={() => document.getElementById(`v4-import-${kind}`)?.click()}><FileSpreadsheet className="size-4" />Chọn CSV/XLSX</Button><input id={`v4-import-${kind}`} className="hidden" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const file = event.target.files?.[0]; if (file) void loadFile(file); event.target.value = ''; }} /></div>
    {(progress > 0 || busy) && <div className="space-y-1.5" aria-live="polite"><div className="flex justify-between text-xs text-slate-600"><span>{stage}</span><span>{progress}%</span></div><Progress value={progress} /></div>}
    <Alert><AlertDescription className="text-sm">Nhập tên cơ sở và tên người bằng tiếng Việt; không cần mã nội bộ. CSV vẫn được hỗ trợ cho dữ liệu thô. Mẫu và file đánh dấu ô lỗi dùng XLSX vì CSV không lưu được màu, ghi chú hay danh sách chọn.</AlertDescription></Alert>
    <details className="rounded-lg border p-3"><summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold"><Bot className="size-4" />Nhập qua AI chat</summary><p className="mt-2 text-xs text-slate-500">Dữ liệu không được tự gửi ra ngoài. Sao chép prompt rồi dán JSON nhận được vào đây.</p><pre className="mt-2 whitespace-pre-wrap rounded bg-slate-100 p-2 text-xs">{aiPrompt(kind)}</pre><Textarea className="mt-2" rows={4} value={aiText} onChange={(event) => setAiText(event.target.value)} placeholder="Dán JSON array…" /><Button variant="outline" size="sm" className="mt-2" disabled={!aiText.trim()} onClick={parseAi}>Đọc JSON để xem trước</Button></details>
    {error && <Alert className="border-red-200 bg-red-50"><TriangleAlert className="size-4" /><AlertDescription className="text-red-700">{error}</AlertDescription></Alert>}
    {!!preview?.errors.length && <Alert className="border-amber-200 bg-amber-50"><AlertDescription className="text-amber-900"><p className="font-semibold">Có {preview.invalidCount} dòng lỗi ({preview.errors.length} lỗi):</p><ul className="mt-1 max-h-36 list-disc overflow-y-auto pl-5 text-xs">{preview.errors.map((item, index) => <li key={index}>Dòng {item.row}, {item.column}: {item.message}</li>)}</ul><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" disabled={busy || preview.validCount === 0} onClick={() => void apply('valid_only')}>Tiếp tục {preview.validCount} dòng hợp lệ</Button><Button size="sm" variant="outline" onClick={() => void downloadErrorWorkbook(kind, rows, preview.errors, false)}><Download className="size-4" />Dừng và tải file đánh dấu lỗi</Button></div><p className="mt-2 text-xs">Chưa có bản ghi nào được lưu. Chỉ nút “Tiếp tục” mới import các dòng hợp lệ.</p></AlertDescription></Alert>}
    {displayRows.length > 0 && <div className="max-h-72 max-w-full overflow-auto rounded-lg border"><Table><TableHeader><TableRow><TableHead>#</TableHead><TableHead>{kind === 'events' ? 'Tiêu đề' : 'Tên việc'}</TableHead><TableHead>{kind === 'events' ? 'Thời gian' : 'Hạn hoàn thành'}</TableHead><TableHead>Cơ sở</TableHead><TableHead>{kind === 'events' ? 'Chủ trì' : 'Người thực hiện'}</TableHead></TableRow></TableHeader><TableBody>{displayRows.map((row, index) => <TableRow key={index}><TableCell>{String(row.rowNumber || index + 2)}</TableCell><TableCell className="max-w-64 truncate" title={String(row.title || '')}>{String(row.title || '—')}</TableCell><TableCell>{String((kind === 'events' ? row.startAt || `${row.date || ''} ${row.startTime || ''}` : row.dueAt) || '—')}</TableCell><TableCell>{String(row.campusId || 'Điểm trường chính')}</TableCell><TableCell className="max-w-56 truncate">{String((kind === 'events' ? row.chairPerId : row.assigneePerId) || 'Mặc định là tôi')}</TableCell></TableRow>)}</TableBody></Table></div>}
  </div><DialogFooter className="sticky bottom-0 -mx-6 -mb-6 border-t bg-background px-6 py-4"><Button variant="ghost" disabled={busy} onClick={() => { reset(); onClose(); }}>Đóng</Button>{!preview ? <Button disabled={rows.length === 0 || busy} onClick={runPreview}>{busy && <Loader2 className="size-4 animate-spin" />}Kiểm tra & xem trước</Button> : preview.valid && <Button disabled={busy} onClick={() => void apply('all')}>{busy && <Loader2 className="size-4 animate-spin" />}Xác nhận import {preview.rows.length} dòng</Button>}</DialogFooter></DialogContent></Dialog>;
}
