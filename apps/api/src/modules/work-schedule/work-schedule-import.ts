import { VALID_CAMPUS_IDS } from './work-schedule.schema.js';

export type ImportKind = 'events' | 'tasks';
export interface ImportError { row: number; column: string; value: string; message: string }
export interface EventImportRow { rowNumber?: number; title?: string; date?: string; startTime?: string; endTime?: string; location?: string; campusId?: string; scope?: string; chairPerId?: string; participantPerIds?: string[] | string; description?: string }
export interface TaskImportRow { rowNumber?: number; title?: string; startAt?: string; dueAt?: string; location?: string; campusId?: string; assigneePerId?: string; collaboratorPerIds?: string[] | string; description?: string }

export interface ImportPerson { perId: string; name: string }
export interface ExistingImportEvent { id: string; title: string; startAt: Date; endAt: Date | null; chairPerId: string; participantPerIds: string[] }

function clean(value: unknown) { return typeof value === 'string' ? value.trim() : ''; }
function lookupKey(value: unknown) {
  return clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' ');
}
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

const CAMPUS_BY_NAME: Record<string, string> = {
  main_campus: 'MAIN_CAMPUS', 'diem truong chinh': 'MAIN_CAMPUS', 'co so chinh': 'MAIN_CAMPUS',
  campus_1: 'CAMPUS_1', 'phan hieu 1': 'CAMPUS_1', 'co so 1': 'CAMPUS_1',
  campus_2: 'CAMPUS_2', 'phan hieu 2': 'CAMPUS_2', 'co so 2': 'CAMPUS_2'
};

function resolveCampus(value: unknown): string {
  const raw = clean(value);
  return CAMPUS_BY_NAME[lookupKey(raw).replace(/ /g, '_')] || CAMPUS_BY_NAME[lookupKey(raw)] || raw;
}

function resolvePerson(value: string, peopleByName: Map<string, ImportPerson[]>): { perId?: string; error?: string } {
  if (!value) return {};
  // Backwards compatible for existing machine-generated files, while V4 templates only expose names.
  if (/^PER[._-]/i.test(value)) return { perId: value };
  const matches = peopleByName.get(lookupKey(value)) || [];
  if (matches.length === 1) return { perId: matches[0]!.perId };
  if (matches.length === 0) return { error: `Không tìm thấy người có tên “${value}”.` };
  return { error: `Tên “${value}” trùng với ${matches.length} người; không thể tự chọn. Hãy dùng tên hiển thị đầy đủ duy nhất.` };
}

/** Resolve Vietnamese display names before structural validation. No persistence occurs here. */
export function resolveImportReferences(kind: ImportKind, rows: Array<EventImportRow | TaskImportRow>, directoryPeople: ImportPerson[]) {
  const peopleByName = new Map<string, ImportPerson[]>();
  for (const person of directoryPeople) {
    const key = lookupKey(person.name);
    if (!key) continue;
    peopleByName.set(key, [...(peopleByName.get(key) || []), person]);
  }
  const errors: ImportError[] = [];
  const resolved = rows.map((source, index) => {
    const rowNumber = source.rowNumber || index + 1;
    const row = { ...source, rowNumber, campusId: resolveCampus(source.campusId) } as EventImportRow & TaskImportRow;
    const singleField = kind === 'events' ? 'chairPerId' : 'assigneePerId';
    const singleLabel = kind === 'events' ? 'Chủ trì' : 'Người thực hiện';
    const singleRaw = clean(row[singleField]);
    const single = resolvePerson(singleRaw, peopleByName);
    if (single.error) errors.push({ row: rowNumber, column: singleLabel, value: singleRaw, message: single.error });
    if (single.perId) row[singleField] = single.perId;

    const manyField = kind === 'events' ? 'participantPerIds' : 'collaboratorPerIds';
    const manyLabel = kind === 'events' ? 'Thành phần' : 'Người phối hợp';
    const rawPeople = people(row[manyField]);
    const resolvedPeople: string[] = [];
    for (const raw of rawPeople) {
      const match = resolvePerson(raw, peopleByName);
      if (match.error) errors.push({ row: rowNumber, column: manyLabel, value: raw, message: match.error });
      if (match.perId) resolvedPeople.push(match.perId);
    }
    row[manyField] = resolvedPeople;
    return row;
  });
  return { rows: resolved, errors };
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
    const campusId = resolveCampus(row.campusId) || 'MAIN_CAMPUS';
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
    if (!VALID_CAMPUS_IDS.includes(campusId as (typeof VALID_CAMPUS_IDS)[number])) errors.push({ row: rowNumber, column: 'Cơ sở', value: campusId, message: 'Không nhận ra cơ sở. Dùng Điểm trường chính, Phân hiệu 1 hoặc Phân hiệu 2.' });
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
    const campusId = resolveCampus(row.campusId) || 'MAIN_CAMPUS';
    if (!title) errors.push({ row: rowNumber, column: 'Tên việc', value: '', message: 'Bắt buộc.' });
    if (!dueAt) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Ngày giờ không hợp lệ.' });
    if (dueAt && dueAt < now) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Không được ở trong quá khứ.' });
    if (startAt && dueAt && dueAt <= startAt) errors.push({ row: rowNumber, column: 'Hạn hoàn thành', value: clean(row.dueAt), message: 'Phải sau thời gian bắt đầu.' });
    if (!VALID_CAMPUS_IDS.includes(campusId as (typeof VALID_CAMPUS_IDS)[number])) errors.push({ row: rowNumber, column: 'Cơ sở', value: campusId, message: 'Không nhận ra cơ sở. Dùng Điểm trường chính, Phân hiệu 1 hoặc Phân hiệu 2.' });
    return { rowNumber, title, description: clean(row.description), campusId, startAt, dueAt, location: clean(row.location), assigneePerId: clean(row.assigneePerId) || defaultAssigneePerId, collaboratorPerIds: people(row.collaboratorPerIds) };
  });
  return { normalized, errors };
}

/** Conflicts are blocking import errors, unlike the advisory conflictNote on manual creation. */
export function validateImportedEventConflicts(
  rows: ReturnType<typeof validateEventImportRows>['normalized'],
  existing: ExistingImportEvent[]
): ImportError[] {
  const errors: ImportError[] = [];
  const candidates = rows.filter((row): row is typeof row & { startAt: Date; endAt: Date } => Boolean(row.startAt && row.endAt));
  const peopleFor = (row: { chairPerId: string; participantPerIds: string[] }) => new Set([row.chairPerId, ...row.participantPerIds].filter(Boolean));
  const overlaps = (a: { startAt: Date; endAt: Date }, b: { startAt: Date; endAt: Date | null }) => Boolean(b.endAt && a.startAt < b.endAt && a.endAt > b.startAt);
  const shared = (a: Set<string>, b: Set<string>) => [...a].filter((id) => b.has(id));
  for (let index = 0; index < candidates.length; index += 1) {
    const row = candidates[index]!;
    const rowPeople = peopleFor(row);
    for (const other of existing) {
      const common = shared(rowPeople, peopleFor(other));
      if (common.length && overlaps(row, other)) {
        errors.push({ row: row.rowNumber, column: 'Thời gian/Thành phần', value: row.title, message: `Trùng thời gian với lịch “${other.title}” và có ${common.length} người trùng.` });
        break;
      }
    }
    for (let previous = 0; previous < index; previous += 1) {
      const other = candidates[previous]!;
      const common = shared(rowPeople, peopleFor(other));
      if (common.length && overlaps(row, other)) {
        errors.push({ row: row.rowNumber, column: 'Thời gian/Thành phần', value: row.title, message: `Trùng với dòng ${other.rowNumber} trong tệp và có ${common.length} người trùng.` });
        break;
      }
    }
  }
  return errors;
}

export function validImportRows<T extends { rowNumber: number }>(rows: T[], errors: ImportError[]): T[] {
  const invalid = new Set(errors.filter((error) => error.row > 0).map((error) => error.row));
  return rows.filter((row) => !invalid.has(row.rowNumber));
}
