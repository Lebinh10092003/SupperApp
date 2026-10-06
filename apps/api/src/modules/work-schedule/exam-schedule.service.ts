/**
 * exam-schedule.service.ts — CRUD cho "Lịch thi" (ltc_exam_shifts). Xem
 * ghi chú thiết kế đầy đủ ở exam-schedule.schema.ts. Quyền admin
 * (tạo/sửa/xoá) kiểm tra Ở TẦNG ROUTE (isLeadership, work-schedule.authz.ts)
 * — service này KHÔNG tự kiểm tra vai trò, chỉ nhận input và ghi DB, đúng
 * khuôn work-schedule.service.ts đã dùng cho events/tasks.
 */
import { and, asc, eq, gte, ilike, lte, or, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ltcExamShifts } from './exam-schedule.schema.js';
import { ltcAuditLogs } from './work-schedule.schema.js';
import { VALID_CAMPUS_IDS } from './work-schedule.schema.js';

type Db = NodePgDatabase<Record<string, never>>;

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function writeAuditLog(db: Db, params: { entityId: string; action: string; actorPerId: string; before?: unknown; after?: unknown }) {
  await db.insert(ltcAuditLogs).values({
    entityType: 'exam_shift',
    entityId: params.entityId,
    action: params.action,
    actorPerId: params.actorPerId,
    before: params.before ?? null,
    after: params.after ?? null
  });
}

export interface ExamShiftInput {
  examDate: string; // 'YYYY-MM-DD'
  session?: string;
  periodLabel?: string;
  timeLabel?: string;
  subject?: string;
  className?: string;
  campusId: string;
  firstProctorPerId?: string | null;
  secondProctorPerId?: string | null;
  note?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateInput(input: ExamShiftInput) {
  if (!input.examDate || !DATE_RE.test(input.examDate)) throw new AppError('invalid_input', 'Thiếu hoặc sai định dạng examDate (YYYY-MM-DD).');
  if (!input.campusId) throw new AppError('invalid_input', 'Thiếu campusId.');
}

/**
 * Liệt kê ca trông thi trong 1 tháng. `forPerId` (KHÔNG truyền khi actor là
 * lãnh đạo/admin — xem route) lọc CHỈ ca có actor là 1 trong 2 giám thị —
 * Sin: "người khác chỉ cho xem lịch trông thi của bản thân thôi".
 *
 * §24-25 (2026-10-05) — bộ lọc bổ sung cho dữ liệu import: `subject`/
 * `className` so khớp CHÍNH XÁC (dữ liệu import đã chuẩn hoá theo đúng cột
 * file); `teacherName` so khớp KHÔNG PHÂN BIỆT HOA THƯỜNG, kiểm tra ĐỒNG
 * THỜI cả `firstProctorName` VÀ `secondProctorName` (OR — đúng §25: "không
 * được chỉ tìm ở một trong hai cột").
 */
export async function listExamShifts(
  db: Db,
  filter: {
    monthStart: string;
    monthEnd: string;
    forPerId?: string;
    examDate?: string;
    subject?: string;
    className?: string;
    teacherName?: string;
  }
) {
  const conditions: SQL[] = [gte(ltcExamShifts.examDate, filter.monthStart), lte(ltcExamShifts.examDate, filter.monthEnd)];
  if (filter.forPerId) {
    const perId = filter.forPerId;
    conditions.push(or(eq(ltcExamShifts.firstProctorPerId, perId), eq(ltcExamShifts.secondProctorPerId, perId))!);
  }
  if (filter.examDate) conditions.push(eq(ltcExamShifts.examDate, filter.examDate));
  if (filter.subject) conditions.push(eq(ltcExamShifts.subject, filter.subject));
  if (filter.className) conditions.push(eq(ltcExamShifts.className, filter.className));
  if (filter.teacherName) {
    const q = `%${filter.teacherName}%`;
    conditions.push(or(ilike(ltcExamShifts.firstProctorName, q), ilike(ltcExamShifts.secondProctorName, q))!);
  }
  return db.select().from(ltcExamShifts).where(and(...conditions)).orderBy(asc(ltcExamShifts.examDate), asc(ltcExamShifts.timeLabel));
}

export async function createExamShift(db: Db, input: ExamShiftInput, actorPerId: string) {
  validateInput(input);
  const [row] = await db
    .insert(ltcExamShifts)
    .values({
      examDate: input.examDate,
      session: input.session || '',
      periodLabel: input.periodLabel || '',
      timeLabel: input.timeLabel || '',
      subject: input.subject || '',
      className: input.className || '',
      campusId: input.campusId,
      firstProctorPerId: input.firstProctorPerId || null,
      secondProctorPerId: input.secondProctorPerId || null,
      note: input.note || '',
      createdByPerId: actorPerId
    })
    .returning();
  if (!row) throw new Error('Không tạo được ca trông thi.');
  await writeAuditLog(db, { entityId: row.id, action: 'exam_shift.created', actorPerId, after: row });
  return row;
}

export async function updateExamShift(db: Db, shiftId: string, input: ExamShiftInput, actorPerId: string) {
  validateInput(input);
  const [before] = await db.select().from(ltcExamShifts).where(eq(ltcExamShifts.id, shiftId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy ca trông thi ${shiftId}`);
  const [after] = await db
    .update(ltcExamShifts)
    .set({
      examDate: input.examDate,
      session: input.session || '',
      periodLabel: input.periodLabel || '',
      timeLabel: input.timeLabel || '',
      subject: input.subject || '',
      className: input.className || '',
      campusId: input.campusId,
      firstProctorPerId: input.firstProctorPerId || null,
      secondProctorPerId: input.secondProctorPerId || null,
      note: input.note || '',
      updatedAt: new Date()
    })
    .where(eq(ltcExamShifts.id, shiftId))
    .returning();
  await writeAuditLog(db, { entityId: shiftId, action: 'exam_shift.updated', actorPerId, before, after });
  return after!;
}

export async function deleteExamShift(db: Db, shiftId: string, actorPerId: string) {
  const [before] = await db.select().from(ltcExamShifts).where(eq(ltcExamShifts.id, shiftId)).limit(1);
  if (!before) throw new AppError('not_found', `Không tìm thấy ca trông thi ${shiftId}`);
  await db.delete(ltcExamShifts).where(eq(ltcExamShifts.id, shiftId));
  await writeAuditLog(db, { entityId: shiftId, action: 'exam_shift.deleted', actorPerId, before });
}

// ---------------------------------------------------------------------
// Import file (§17-25 huong_dan_lich_cong_tac_giao_viec.md)
// ---------------------------------------------------------------------

export interface ImportRowInput {
  rowNumber: number; // STT/số dòng thật trong file — dùng để báo lỗi rõ ràng, KHÔNG lưu vào DB.
  examDate: string; // 'dd/mm/yyyy' nguyên văn từ file — tự parse/validate ở đây.
  session?: string;
  periodLabel?: string;
  timeLabel?: string;
  subject?: string;
  className?: string;
  firstProctorName?: string;
  secondProctorName?: string;
  note?: string;
}

export interface ImportRowError {
  row: number;
  column: string;
  value: string;
  message: string;
}

export class ImportValidationError extends AppError {
  errors: ImportRowError[];
  constructor(errors: ImportRowError[]) {
    super('invalid_input', `File có ${errors.length} dòng lỗi — không import dòng nào.`);
    this.errors = errors;
  }
}

const DATE_DMY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** 'dd/mm/yyyy' -> 'yyyy-mm-dd', trả null nếu sai định dạng HOẶC không phải
 * ngày thật (VD 32/09/2026, 31/02/2026) — kiểm tra bằng cách dựng lại ngày
 * rồi so khớp ngược, không chỉ tin regex (regex chỉ bắt đúng HÌNH DẠNG). */
function parseDmyDate(raw: string): string | null {
  const m = DATE_DMY_RE.exec(raw.trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = Number(dd), mo = Number(mm), y = Number(yyyy);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Import atomic — §21: "Thành công toàn bộ hoặc thất bại toàn bộ". Validate
 * HẾT mọi dòng trước, gom đủ lỗi (§22: dòng/cột/giá trị/nội dung lỗi) —
 * CHỈ CẦN 1 dòng lỗi thì ném ImportValidationError, KHÔNG insert bất kỳ
 * dòng nào. Toàn bộ insert chạy trong 1 transaction — dù đã validate hết
 * trước, vẫn bọc transaction để không có dòng nào "lọt" nếu insert giữa
 * chừng lỗi vì lý do khác (vd mất kết nối DB).
 */
export async function importExamShifts(db: Db, input: { campusId: string; rows: ImportRowInput[] }, actorPerId: string) {
  if (!VALID_CAMPUS_IDS.includes(input.campusId as (typeof VALID_CAMPUS_IDS)[number])) {
    throw new AppError('invalid_input', 'Vui lòng chọn Điểm trường trước khi import.');
  }
  if (!input.rows || input.rows.length === 0) {
    throw new AppError('invalid_input', 'File không có dòng dữ liệu nào.');
  }

  const errors: ImportRowError[] = [];
  const toInsert: (typeof ltcExamShifts.$inferInsert)[] = [];

  for (const row of input.rows) {
    const rawDate = (row.examDate || '').trim();
    const isoDate = parseDmyDate(rawDate);
    if (!isoDate) {
      errors.push({
        row: row.rowNumber,
        column: 'Ngày',
        value: rawDate,
        message: DATE_DMY_RE.test(rawDate) ? 'Ngày không hợp lệ.' : 'Sai định dạng. Yêu cầu dd/mm/yyyy.'
      });
      continue;
    }
    toInsert.push({
      examDate: isoDate,
      session: row.session || '',
      periodLabel: row.periodLabel || '',
      timeLabel: row.timeLabel || '',
      subject: row.subject || '',
      className: row.className || '',
      campusId: input.campusId,
      firstProctorName: row.firstProctorName || null,
      secondProctorName: row.secondProctorName || null,
      note: row.note || '',
      createdByPerId: actorPerId
    });
  }

  if (errors.length > 0) throw new ImportValidationError(errors);

  const inserted = await db.transaction(async (tx) => {
    const rows = await tx.insert(ltcExamShifts).values(toInsert).returning();
    await tx.insert(ltcAuditLogs).values({
      entityType: 'exam_shift',
      entityId: 'bulk_import',
      action: 'exam_shift.imported',
      actorPerId,
      after: { count: rows.length, campusId: input.campusId }
    });
    return rows;
  });

  return { count: inserted.length };
}
