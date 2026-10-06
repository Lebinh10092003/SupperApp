import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ltcWeeklySheetRows, ltcWeeklySheetConnection } from './weekly-sheet.schema.js';
import { ltcEvents } from './work-schedule.schema.js';
import { attachTaskProgress } from './work-schedule.service.js';
import { env } from '../../config/env.js';
import { extractSpreadsheetId, fetchGoogleSheetValues, parseWeeklySheetRows, GoogleSheetsImportError } from './google-sheets-import.js';

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type Db = NodePgDatabase<Record<string, never>>;

/** Danh sách email được sửa — xem WEEKLY_SHEET_EDITOR_EMAILS ở config/env.ts. */
export function weeklySheetEditorEmails(value: string): Set<string> {
  return new Set(
    value.split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isWeeklySheetEditor(email: string | null | undefined): boolean {
  if (!email) return false;
  return weeklySheetEditorEmails(env.WEEKLY_SHEET_EDITOR_EMAILS).has(email.trim().toLowerCase());
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
  linkedEventId?: string | null;
}

/** Xác nhận `eventId` tồn tại thật trước khi cho liên kết — tránh lưu 1 FK trỏ vào hư không. */
async function assertEventExists(db: Db, eventId: string) {
  const [ev] = await db.select({ id: ltcEvents.id }).from(ltcEvents).where(eq(ltcEvents.id, eventId)).limit(1);
  if (!ev) throw new AppError('not_found', `Không tìm thấy lịch công tác ${eventId} để liên kết.`);
}

/**
 * Gắn tóm tắt (tiêu đề/trạng thái/% tiến độ) của sự kiện đã liên kết vào
 * mỗi dòng có `linkedEventId` — cùng cơ chế `attachTaskProgress` dùng ở
 * work-schedule.service.ts (tái dùng thẳng, không tính lại % theo cách
 * khác). Trả về map theo `eventId` để frontend tự nối với đúng dòng, thay
 * vì nhúng lồng vào từng dòng (giữ `rows` nguyên dạng cũ, không phá cấu
 * trúc response mà UI hiện tại đang đọc).
 */
async function attachLinkedEventSummaries(db: Db, rows: (typeof ltcWeeklySheetRows.$inferSelect)[]) {
  const eventIds = [...new Set(rows.map((r) => r.linkedEventId).filter((id): id is string => !!id))];
  if (eventIds.length === 0) return {};
  const events = await db.select().from(ltcEvents).where(inArray(ltcEvents.id, eventIds));
  const withProgress = await attachTaskProgress(db, events);
  const map: Record<string, { id: string; title: string; status: string; taskCount: number; taskCompletedCount: number; taskProgressPercent: number | null }> = {};
  for (const ev of withProgress) {
    map[ev.id] = {
      id: ev.id,
      title: ev.title,
      status: ev.status,
      taskCount: ev.taskCount,
      taskCompletedCount: ev.taskCompletedCount,
      taskProgressPercent: ev.taskProgressPercent
    };
  }
  return map;
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
  const linkedEvents = await attachLinkedEventSummaries(db, rows);
  return { weekStart: monday, weekEnd: sunday, rows, linkedEvents };
}

export async function createWeeklySheetRow(
  db: Db,
  input: WeeklySheetRowInput,
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  if (!input.rowDate) throw new AppError('invalid_input', 'Thiếu ngày (rowDate).');
  if (input.linkedEventId) await assertEventExists(db, input.linkedEventId);
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
      linkedEventId: input.linkedEventId ?? null,
      createdByPerId: actor.perId,
      updatedByPerId: actor.perId,
      createdAt: now,
      updatedAt: now
    })
    .returning();
  if (!row) throw new Error('weeklySheet: insert không trả về dòng vừa tạo (không nên xảy ra).');
  return row;
}

export type WeeklySheetRowPatch = Partial<Pick<WeeklySheetRowInput, 'rowDate' | 'timeLabel' | 'content' | 'location' | 'people' | 'sortOrder' | 'linkedEventId'>>;

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
  // `linkedEventId` CÓ THỂ là `null` một cách CÓ CHỦ Ý (bỏ liên kết) — phải
  // phân biệt với "không truyền field này" (giữ nguyên), nên check bằng
  // `in` thay vì `patch.linkedEventId` (falsy cả với null lẫn undefined).
  if ('linkedEventId' in patch && patch.linkedEventId) await assertEventExists(db, patch.linkedEventId);
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

const SHEET_CONNECTION_ID = 'default';

/** Link Google Sheet đang kết nối (null nếu chưa ai kết nối lần nào). */
export async function getSheetConnection(db: Db) {
  const [row] = await db
    .select()
    .from(ltcWeeklySheetConnection)
    .where(eq(ltcWeeklySheetConnection.id, SHEET_CONNECTION_ID))
    .limit(1);
  return row ?? null;
}

/**
 * Lưu/đổi link Google Sheet kết nối — CHỈ lưu, KHÔNG gọi Sheets API ở đây
 * (xem lý do ở comment trong weekly-sheet.schema.ts). `extractSpreadsheetId`
 * vẫn được gọi để validate link hợp lệ trước khi lưu, tránh lưu rác.
 */
export async function setSheetConnection(
  db: Db,
  sheetUrl: string,
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  try {
    extractSpreadsheetId(sheetUrl); // chỉ validate link hợp lệ, không dùng ID trả về ở đây
  } catch (e) {
    if (e instanceof GoogleSheetsImportError) throw new AppError('invalid_input', e.message);
    throw e;
  }
  const now = opts?.now ?? new Date();
  const [row] = await db
    .insert(ltcWeeklySheetConnection)
    .values({ id: SHEET_CONNECTION_ID, sheetUrl, connectedByPerId: actor.perId, connectedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: ltcWeeklySheetConnection.id,
      set: { sheetUrl, connectedByPerId: actor.perId, updatedAt: now }
    })
    .returning();
  if (!row) throw new Error('weeklySheet: lưu kết nối Google Sheet không trả về dòng vừa lưu (không nên xảy ra).');
  return row;
}

export async function clearSheetConnection(db: Db, actor: { perId: string; email: string | null }) {
  requireEditor(actor.email);
  await db.delete(ltcWeeklySheetConnection).where(eq(ltcWeeklySheetConnection.id, SHEET_CONNECTION_ID));
  return { disconnected: true };
}

/**
 * "Đồng bộ từ Google Sheet" — 1 chiều, CHÈN THÊM vào tuần đích, KHÔNG
 * xoá dòng có sẵn (nếu tuần đích đã có dữ liệu, gọi lại chỉ cộng dồn
 * thêm — người dùng tự xoá dòng trùng nếu có, xem weekly-sheet.routes.ts
 * để biết chi tiết luồng). Không tự ghi ngược lại sheet.
 *
 * `sheetUrl` truyền vào là TÙY CHỌN (bổ sung 2026-09-28, sau khi Sin chỉ
 * ra phải có "kết nối" thật sự thay vì bắt dán lại link mỗi lần) — không
 * truyền thì dùng link đã lưu qua `setSheetConnection`; truyền vào (VD từ
 * dialog "Đổi link") thì dùng đúng link đó cho lần đồng bộ này, KHÔNG tự
 * ghi đè lên kết nối đã lưu (muốn đổi hẳn thì gọi `setSheetConnection`
 * riêng) — tách biệt "đồng bộ 1 lần" khỏi "đổi kết nối lâu dài".
 */
export async function importFromGoogleSheet(
  db: Db,
  input: { sheetUrl?: string; weekStart: string },
  actor: { perId: string; email: string | null },
  opts?: { now?: Date }
) {
  requireEditor(actor.email);
  if (!actor.email) throw new AppError('invalid_input', 'Không xác định được email của actor.');

  let sheetUrl = input.sheetUrl;
  if (!sheetUrl) {
    const connection = await getSheetConnection(db);
    if (!connection) {
      throw new AppError('not_connected', 'Chưa kết nối Google Sheet nào — kết nối trước khi đồng bộ.');
    }
    sheetUrl = connection.sheetUrl;
  }

  const spreadsheetId = extractSpreadsheetId(sheetUrl);
  const values = await fetchGoogleSheetValues(spreadsheetId, actor.email);

  const targetMonday = mondayOf(input.weekStart);
  const targetYear = Number(targetMonday.slice(0, 4));
  const parsedRows = parseWeeklySheetRows(values, targetYear);
  if (parsedRows.length === 0) return { imported: 0, rows: [] };

  const now = opts?.now ?? new Date();
  const toInsert = parsedRows.map((r) => ({
    rowDate: r.rowDate,
    timeLabel: r.timeLabel ?? '',
    content: r.content ?? '',
    location: r.location ?? '',
    people: r.people ?? '',
    sortOrder: r.sortOrder ?? 0,
    createdByPerId: actor.perId,
    updatedByPerId: actor.perId,
    createdAt: now,
    updatedAt: now
  }));
  const inserted = await db.insert(ltcWeeklySheetRows).values(toInsert).returning();
  return { imported: inserted.length, rows: inserted };
}
