import { and, asc, eq, gte, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ltcWeeklySheetRows } from './weekly-sheet.schema.js';
import { env } from '../../config/env.js';

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Db = NodePgDatabase<Record<string, never>>;

/** Danh sách email được sửa — xem WEEKLY_SHEET_EDITOR_EMAILS ở config/env.ts. */
function editorEmails(): Set<string> {
  return new Set(
    env.WEEKLY_SHEET_EDITOR_EMAILS.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isWeeklySheetEditor(email: string | null | undefined): boolean {
  if (!email) return false;
  return editorEmails().has(email.toLowerCase());
}

function requireEditor(email: string | null | undefined) {
  if (!isWeeklySheetEditor(email)) {
    throw new AppError('forbidden', 'Bạn không có quyền sửa lịch công tác tuần này — chỉ xem được.');
  }
}

/** Thứ Hai của tuần chứa `dateStr` (YYYY-MM-DD), tính theo giờ Việt Nam (UTC+7) — khớp cách người dùng nghĩ về "tuần". */
/**
 * Parse/format thuần theo lịch (calendar date) — CỐ Ý dùng `Date.UTC` làm
 * "trục" tính toán trung lập, KHÔNG bao giờ đụng tới local timezone của
 * máy chạy hay offset +07:00 nào cả. Lỗi thật gặp phải lúc viết: parse
 * bằng offset '+07:00' rồi format lại bằng `toISOString()` (LUÔN quy đổi
 * ra UTC) làm ngày bị lùi 1 hôm mỗi khi giờ local >= 17:00 UTC cùng ngày
 * (VD 2026-01-06 00:00 +07 = 2026-01-05 17:00 UTC -> toISOString() ra hẳn
 * "2026-01-05", sai 1 ngày). Dùng UTC cho CẢ 2 chiều (không trộn local +
 * UTC) thì không còn phụ thuộc timezone máy chủ nữa.
 */
function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new AppError('invalid_input', 'Ngày không hợp lệ: ' + dateStr);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function mondayOf(dateStr: string): string {
  const d = parseDateOnly(dateStr);
  const day = d.getUTCDay(); // 0 = Chủ Nhật ... 6 = Thứ Bảy
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return formatDateOnly(d);
}

function addDays(dateStr: string, days: number): string {
  const d = parseDateOnly(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDateOnly(d);
}

export interface WeeklySheetRowInput {
  rowDate: string;
  timeLabel?: string;
  content?: string;
  location?: string;
  people?: string;
  sortOrder?: number;
}

/** Danh sách dòng của 1 tuần (Thứ Hai -> Chủ Nhật chứa `weekStart`), sắp theo ngày rồi thứ tự thủ công. */
export async function listWeeklySheetRows(db: Db, input: { weekStart: string }) {
  const monday = mondayOf(input.weekStart);
  const sunday = addDays(monday, 6);
  const rows = await db
    .select()
    .from(ltcWeeklySheetRows)
    .where(and(gte(ltcWeeklySheetRows.rowDate, monday), lte(ltcWeeklySheetRows.rowDate, sunday)))
    .orderBy(asc(ltcWeeklySheetRows.rowDate), asc(ltcWeeklySheetRows.sortOrder));
  return { weekStart: monday, weekEnd: sunday, rows };
}

export async function createWeeklySheetRow(
  db: Db,
  input: WeeklySheetRowInput,
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  if (!input.rowDate) throw new AppError('invalid_input', 'Thiếu ngày (rowDate).');
  const now = opts?.now ?? new Date();
  const [row] = await db
    .insert(ltcWeeklySheetRows)
    .values({
      rowDate: input.rowDate,
      timeLabel: input.timeLabel ?? '',
      content: input.content ?? '',
      location: input.location ?? '',
      people: input.people ?? '',
      sortOrder: input.sortOrder ?? 0,
      createdByPerId: actor.perId,
      updatedByPerId: actor.perId,
      createdAt: now,
      updatedAt: now
    })
    .returning();
  if (!row) throw new Error('weeklySheet: insert không trả về dòng vừa tạo (không nên xảy ra).');
  return row;
}

export type WeeklySheetRowPatch = Partial<Pick<WeeklySheetRowInput, 'rowDate' | 'timeLabel' | 'content' | 'location' | 'people' | 'sortOrder'>>;

export async function updateWeeklySheetRow(
  db: Db,
  id: string,
  patch: WeeklySheetRowPatch,
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  const [existing] = await db.select().from(ltcWeeklySheetRows).where(eq(ltcWeeklySheetRows.id, id)).limit(1);
  if (!existing) throw new AppError('not_found', 'Không tìm thấy dòng ' + id);
  const now = opts?.now ?? new Date();
  const [row] = await db
    .update(ltcWeeklySheetRows)
    .set({ ...patch, updatedByPerId: actor.perId, updatedAt: now })
    .where(eq(ltcWeeklySheetRows.id, id))
    .returning();
  if (!row) throw new Error('weeklySheet: update không trả về dòng vừa sửa (không nên xảy ra).');
  return row;
}

export async function deleteWeeklySheetRow(db: Db, id: string, actor: { perId: string; email: string | null }) {
  requireEditor(actor.email);
  const [existing] = await db.select().from(ltcWeeklySheetRows).where(eq(ltcWeeklySheetRows.id, id)).limit(1);
  if (!existing) throw new AppError('not_found', 'Không tìm thấy dòng ' + id);
  await db.delete(ltcWeeklySheetRows).where(eq(ltcWeeklySheetRows.id, id));
  return { deleted: true };
}

/**
 * Sao chép nguyên khung 1 tuần sang tuần khác — Sin chốt 2026-09-28: đúng
 * thói quen sheet cũ (nhân bản tab tuần trước để sửa lại thay vì gõ từ
 * đầu). Dịch NGÀY theo đúng số ngày lệch giữa 2 tuần, giữ nguyên nội dung —
 * người dùng tự sửa lại nội dung sau khi copy.
 */
export async function copyWeekRows(
  db: Db,
  input: { fromWeekStart: string; toWeekStart: string },
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  const fromMonday = mondayOf(input.fromWeekStart);
  const toMonday = mondayOf(input.toWeekStart);
  if (fromMonday === toMonday) throw new AppError('invalid_input', 'Tuần nguồn và tuần đích trùng nhau.');
  const { rows: sourceRows } = await listWeeklySheetRows(db, { weekStart: fromMonday });
  if (sourceRows.length === 0) return { copied: 0, rows: [] };

  const dayShift = Math.round((parseDateOnly(toMonday).getTime() - parseDateOnly(fromMonday).getTime()) / (24 * 60 * 60 * 1000));

  const now = opts?.now ?? new Date();
  const values = sourceRows.map((r) => ({
    rowDate: addDays(r.rowDate, dayShift),
    timeLabel: r.timeLabel,
    content: r.content,
    location: r.location,
    people: r.people,
    sortOrder: r.sortOrder,
    createdByPerId: actor.perId,
    updatedByPerId: actor.perId,
    createdAt: now,
    updatedAt: now
  }));
  const inserted = await db.insert(ltcWeeklySheetRows).values(values).returning();
  return { copied: inserted.length, rows: inserted };
}
