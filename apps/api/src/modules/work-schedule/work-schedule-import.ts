import { VALID_CAMPUS_IDS } from './work-schedule.schema.js';

export type ImportKind = 'events' | 'tasks';
export interface ImportError { row: number; column: string; value: string; message: string }
export interface EventImportRow { rowNumber?: number; title?: string; date?: string; startTime?: string; endTime?: string; location?: string; campusId?: string; scope?: string; chairPerId?: string; participantPerIds?: string[] | string; description?: string }
export interface TaskImportRow { rowNumber?: number; title?: string; startAt?: string; dueAt?: string; location?: string; campusId?: string; assigneePerId?: string; collaboratorPerIds?: string[] | string; description?: string }

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function people(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[;,]/) : [];
  return [...new Set(raw.map(clean).filter(Boolean))];
}
function parseDate(value: string): string | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const parts = iso || /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!parts) return null;
  const year = Number(iso ? parts[1] : parts[3]);
  const month = Number(parts[2]);
  const day = Number(iso ? parts[3] : parts[1]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}
function parseDateTime(date: string, time: string): Date | null {
  const day = parseDate(date);
  if (!day || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const result = new Date(`${day}T${time.padStart(5, '0')}:00+07:00`);
  return Number.isNaN(result.getTime()) ? null : result;
}
function parseIsoDateTime(value: string): Date | null {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null;
  const result = new Date(value);
  return value && !Number.isNaN(result.getTime()) ? result : null;
}

export function validateEventImportRows(rows: EventImportRow[], defaultChairPerId: string, now = new Date()) {
  const errors: ImportError[] = [];
  if (rows.length === 0) errors.push({ row: 0, column: 'Tệp', value: '', message: 'Không có dòng dữ liệu để import.' });
  const normalized = rows.map((row, index) => {
    const rowNumber = row.rowNumber || index + 1;
    const title = clean(row.title);
    const date = clean(row.date);
    const startTime = clean(row.startTime);
    const endTime = clean(row.endTime);
    const campusId = clean(row.campusId) || 'MAIN_CAMPUS';
    const rawScope = clean(row.scope);
    const normalizedScope = rawScope.normalize('NFC').toLowerCase();
    const scope = rawScope.toUpperCase() === 'SCHOOL_WIDE' || normalizedScope === 'toàn trường' ? 'SCHOOL_WIDE' : 'CAMPUS';
    const startAt = parseDateTime(date, startTime);
    const endAt = endTime ? parseDateTime(date, endTime) : null;
    if (!title) errors.push({ row: rowNumber, column: 'Tiêu đề', value: '', message: 'Bắt buộc.' });
    if (!startAt) errors.push({ row: rowNumber, column: 'Ngày/Giờ bắt đầu', value: `${date} ${startTime}`.trim(), message: 'Dùng dd/mm/yyyy và HH:mm.' });
    if (startAt && startAt < now) errors.push({ row: rowNumber, column: 'Ngày/Giờ bắt đầu', value: `${date} ${startTime}`, message: 'Không được ở trong quá khứ.' });
    if (endTime && !endAt) errors.push({ row: rowNumber, column: 'Giờ kết thúc', value: endTime, message: 'Dùng HH:mm.' });
    if (startAt && endAt && endAt <= startAt) errors.push({ row: rowNumber, column: 'Giờ kết thúc', value: endTime, message: 'Phải sau giờ bắt đầu.' });
    if (rawScope && rawScope.toUpperCase() !== 'CAMPUS' && normalizedScope !== 'cá nhân' && rawScope.toUpperCase() !== 'SCHOOL_WIDE' && normalizedScope !== 'toàn trường') errors.push({ row: rowNumber, column: 'Phạm vi', value: rawScope, message: 'Dùng CAMPUS/Cá nhân hoặc SCHOOL_WIDE/Toàn trường.' });
    if (!VALID_CAMPUS_IDS.includes(campusId as (typeof VALID_CAMPUS_IDS)[number])) errors.push({ row: rowNumber, column: 'Cơ sở', value: campusId, message: 'Mã cơ sở không hợp lệ.' });
    return { rowNumber, title, description: clean(row.description), campusId, scope, startAt, endAt, location: clean(row.location), chairPerId: clean(row.chairPerId) || defaultChairPerId, participantPerIds: people(row.participantPerIds) };
  });
  return { normalized, errors };
}

export function validateTaskImportRows(rows: TaskImportRow[], defaultAssigneePerId: string, now = new Date()) {
  const errors: ImportError[] = [];
  if (rows.length === 0) errors.push({ row: 0, column: 'Tệp', value: '', message: 'Không có dòng dữ liệu để import.' });
  const normalized = rows.map((row, index) => {
    const rowNumber = row.rowNumber || index + 1;
    const title = clean(row.title);
    const startAt = clean(row.startAt) ? parseIsoDateTime(clean(row.startAt)) : null;
    const dueAt = parseIsoDateTime(clean(row.dueAt));
    const campusId = clean(row.campusId) || 'MAIN_CAMPUS';
    if (!title) errors.push({ row: rowNumber, column: 'Tên việc', value: '', message: 'Bắt buộc.' });
    if (!dueAt) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Ngày giờ không hợp lệ.' });
    if (dueAt && dueAt < now) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Không được ở trong quá khứ.' });
    if (startAt && dueAt && dueAt <= startAt) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Phải sau thời gian bắt đầu.' });
    if (!VALID_CAMPUS_IDS.includes(campusId as (typeof VALID_CAMPUS_IDS)[number])) errors.push({ row: rowNumber, column: 'Cơ sở', value: campusId, message: 'Mã cơ sở không hợp lệ.' });
    return { rowNumber, title, description: clean(row.description), campusId, startAt, dueAt, location: clean(row.location), assigneePerId: clean(row.assigneePerId) || defaultAssigneePerId, collaboratorPerIds: people(row.collaboratorPerIds) };
  });
  return { normalized, errors };
}
