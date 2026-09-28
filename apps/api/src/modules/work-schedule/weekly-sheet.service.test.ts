import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, gte, lte } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { ltcWeeklySheetRows } from './weekly-sheet.schema.js';
import {
  mondayOf,
  listWeeklySheetRows,
  createWeeklySheetRow,
  updateWeeklySheetRow,
  deleteWeeklySheetRow,
  copyWeekRows,
  isWeeklySheetEditor,
  AppError
} from './weekly-sheet.service.js';

/**
 * Test thật với Postgres (không mock) — bỏ qua nếu không có DATABASE_URL.
 * WEEKLY_SHEET_EDITOR_EMAILS mặc định (env.ts) chứa
 * 'phuongvd.c2gv@badinhedu.vn' — dùng đúng email này làm "editor" trong
 * test, email khác bất kỳ làm "không phải editor".
 */
const skip = !process.env.DATABASE_URL;

const EDITOR = { perId: 'PER.WS_EDITOR', email: 'phuongvd.c2gv@badinhedu.vn' };
const NON_EDITOR = { perId: 'PER.WS_OTHER', email: 'khac@example.com' };

async function cleanup() {
  await db.delete(ltcWeeklySheetRows).where(and(gte(ltcWeeklySheetRows.rowDate, '2026-01-01'), lte(ltcWeeklySheetRows.rowDate, '2026-01-31')));
}

test('weeklySheet: mondayOf — tính đúng Thứ Hai của tuần bất kể ngày trong tuần đó', () => {
  assert.equal(mondayOf('2026-09-21'), '2026-09-21'); // chính là Thứ Hai
  assert.equal(mondayOf('2026-09-23'), '2026-09-21'); // Thứ Tư cùng tuần
  assert.equal(mondayOf('2026-09-27'), '2026-09-21'); // Chủ Nhật cùng tuần
  assert.equal(mondayOf('2026-09-28'), '2026-09-28'); // Thứ Hai tuần sau
});

test('weeklySheet: isWeeklySheetEditor — đúng theo WEEKLY_SHEET_EDITOR_EMAILS, không phân biệt hoa thường', () => {
  assert.equal(isWeeklySheetEditor('phuongvd.c2gv@badinhedu.vn'), true);
  assert.equal(isWeeklySheetEditor('PHUONGVD.C2GV@BADINHEDU.VN'), true);
  assert.equal(isWeeklySheetEditor('khac@example.com'), false);
  assert.equal(isWeeklySheetEditor(null), false);
});

test('weeklySheet: người không phải editor bị chặn tạo/sửa/xoá/copy — thông báo rõ ràng', { skip }, async () => {
  await cleanup();
  try {
    await assert.rejects(
      () => createWeeklySheetRow(db, { rowDate: '2026-01-05', content: 'x' }, NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );
    const row = await createWeeklySheetRow(db, { rowDate: '2026-01-05', content: 'nội dung gốc' }, EDITOR);
    await assert.rejects(
      () => updateWeeklySheetRow(db, row.id, { content: 'sửa lén' }, NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );
    await assert.rejects(
      () => deleteWeeklySheetRow(db, row.id, NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );
    await assert.rejects(
      () => copyWeekRows(db, { fromWeekStart: '2026-01-05', toWeekStart: '2026-01-12' }, NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );
  } finally {
    await cleanup();
  }
});

test('weeklySheet: CRUD cơ bản — tạo, liệt kê theo đúng tuần, sửa, xoá', { skip }, async () => {
  await cleanup();
  try {
    // Thứ Hai 2026-01-05, Thứ Tư 2026-01-07 — cùng tuần. 2026-01-12 là tuần KẾ TIẾP.
    await createWeeklySheetRow(db, { rowDate: '2026-01-05', timeLabel: '7h30', content: 'Chào cờ', location: 'Sân trường', people: 'BGH, TPT', sortOrder: 0 }, EDITOR);
    const row2 = await createWeeklySheetRow(db, { rowDate: '2026-01-07', timeLabel: 'Tiết 1', content: 'Dự giờ', sortOrder: 0 }, EDITOR);
    await createWeeklySheetRow(db, { rowDate: '2026-01-12', content: 'Tuần sau, không thuộc tuần này' }, EDITOR);

    const week = await listWeeklySheetRows(db, { weekStart: '2026-01-06' }); // bất kỳ ngày nào trong tuần đều ra cùng kết quả
    assert.equal(week.weekStart, '2026-01-05');
    assert.equal(week.weekEnd, '2026-01-11');
    assert.equal(week.rows.length, 2, 'chỉ 2 dòng thuộc đúng tuần 05-11/1, KHÔNG lẫn dòng tuần sau');
    assert.ok(week.rows.every((r) => r.rowDate >= '2026-01-05' && r.rowDate <= '2026-01-11'));

    const updated = await updateWeeklySheetRow(db, row2.id, { content: 'Dự giờ đã đổi phòng' }, EDITOR);
    assert.equal(updated.content, 'Dự giờ đã đổi phòng');
    assert.equal(updated.updatedByPerId, EDITOR.perId);

    await deleteWeeklySheetRow(db, row2.id, EDITOR);
    const afterDelete = await listWeeklySheetRows(db, { weekStart: '2026-01-05' });
    assert.equal(afterDelete.rows.length, 1);

    await assert.rejects(
      () => updateWeeklySheetRow(db, row2.id, { content: 'sửa dòng đã xoá' }, EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'not_found'
    );
  } finally {
    await cleanup();
  }
});

test('weeklySheet: copyWeekRows — nhân bản đúng nội dung, dịch ngày đúng số ngày lệch giữa 2 tuần', { skip }, async () => {
  await cleanup();
  try {
    await createWeeklySheetRow(db, { rowDate: '2026-01-05', timeLabel: '7h30', content: 'Chào cờ', location: 'Sân trường', people: 'BGH', sortOrder: 0 }, EDITOR);
    await createWeeklySheetRow(db, { rowDate: '2026-01-08', timeLabel: '9h00', content: 'Họp giao ban', sortOrder: 1 }, EDITOR);

    const result = await copyWeekRows(db, { fromWeekStart: '2026-01-05', toWeekStart: '2026-01-12' }, EDITOR);
    assert.equal(result.copied, 2);

    const nextWeek = await listWeeklySheetRows(db, { weekStart: '2026-01-12' });
    assert.equal(nextWeek.rows.length, 2);
    const monday = nextWeek.rows.find((r) => r.content === 'Chào cờ');
    const thursday = nextWeek.rows.find((r) => r.content === 'Họp giao ban');
    assert.equal(monday?.rowDate, '2026-01-12', 'Thứ Hai gốc -> Thứ Hai tuần đích');
    assert.equal(thursday?.rowDate, '2026-01-15', 'lệch đúng 3 ngày như tuần gốc (05 -> 08)');
    assert.equal(monday?.location, 'Sân trường', 'giữ nguyên nội dung, chỉ đổi ngày');

    // Tuần gốc không bị đụng tới.
    const stillOriginal = await listWeeklySheetRows(db, { weekStart: '2026-01-05' });
    assert.equal(stillOriginal.rows.length, 2);

    await assert.rejects(
      () => copyWeekRows(db, { fromWeekStart: '2026-01-05', toWeekStart: '2026-01-05' }, EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'invalid_input'
    );

    const emptySource = await copyWeekRows(db, { fromWeekStart: '2026-02-02', toWeekStart: '2026-02-09' }, EDITOR);
    assert.equal(emptySource.copied, 0);
  } finally {
    await cleanup();
    await db.delete(ltcWeeklySheetRows).where(and(gte(ltcWeeklySheetRows.rowDate, '2026-02-01'), lte(ltcWeeklySheetRows.rowDate, '2026-02-28')));
  }
});
