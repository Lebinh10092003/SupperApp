import { test } from 'node:test';
import assert from 'node:assert/strict';
import { and, gte, lte } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { ltcWeeklySheetRows, ltcWeeklySheetConnection } from './weekly-sheet.schema.js';
import { ltcEvents, ltcTasks } from './work-schedule.schema.js';
import { createEvent as createEventService, createTask as createTaskService, changeTaskStatus } from './work-schedule.service.js';
import {
  mondayOf,
  listWeeklySheetRows,
  createWeeklySheetRow,
  updateWeeklySheetRow,
  deleteWeeklySheetRow,
  copyWeekRows,
  isWeeklySheetEditor,
  getSheetConnection,
  setSheetConnection,
  clearSheetConnection,
  weeklySheetEditorEmails,
  AppError
} from './weekly-sheet.service.js';

/**
 * Test thật với Postgres (không mock) — bỏ qua nếu không có DATABASE_URL.
 * Database tests require WEEKLY_SHEET_EDITOR_EMAILS to contain EDITOR_EMAIL
 * in the isolated test process environment.
 */
const skip = !process.env.DATABASE_URL;

const EDITOR_EMAIL = 'weekly-editor@example.test';
const EDITOR = { perId: 'PER.WS_EDITOR', email: EDITOR_EMAIL };
const NON_EDITOR = { perId: 'PER.WS_OTHER', email: 'khac@example.com' };

function createEvent(...args: Parameters<typeof createEventService>) {
  const [database, input, options] = args;
  return createEventService(database, input, {
    now: new Date('2025-12-01T00:00:00+07:00'),
    ...options
  });
}

function createTask(...args: Parameters<typeof createTaskService>) {
  const [database, input, options] = args;
  return createTaskService(database, input, {
    now: new Date('2025-12-01T00:00:00+07:00'),
    ...options
  });
}

async function cleanup() {
  await db.delete(ltcWeeklySheetRows).where(and(gte(ltcWeeklySheetRows.rowDate, '2026-01-01'), lte(ltcWeeklySheetRows.rowDate, '2026-01-31')));
}

async function cleanupConnection() {
  await db.delete(ltcWeeklySheetConnection).where(eq(ltcWeeklySheetConnection.id, 'default'));
}

test('weeklySheet: mondayOf — tính đúng Thứ Hai của tuần bất kể ngày trong tuần đó', () => {
  assert.equal(mondayOf('2026-09-21'), '2026-09-21'); // chính là Thứ Hai
  assert.equal(mondayOf('2026-09-23'), '2026-09-21'); // Thứ Tư cùng tuần
  assert.equal(mondayOf('2026-09-27'), '2026-09-21'); // Chủ Nhật cùng tuần
  assert.equal(mondayOf('2026-09-28'), '2026-09-28'); // Thứ Hai tuần sau
});

test('weeklySheet: allowlist is empty by default and configured values normalize safely', () => {
  assert.equal(weeklySheetEditorEmails('').size, 0);
  assert.deepEqual(
    [...weeklySheetEditorEmails(' weekly-editor@example.test,SECOND@example.test ')],
    ['weekly-editor@example.test', 'second@example.test']
  );
  assert.equal(isWeeklySheetEditor(EDITOR_EMAIL), process.env.WEEKLY_SHEET_EDITOR_EMAILS === EDITOR_EMAIL);
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

test('weeklySheet: liên kết dòng tuần với 1 sự kiện Lịch công tác — % tiến độ mượn nguyên từ đó, bỏ liên kết được, liên kết eventId rác bị từ chối', { skip }, async () => {
  await cleanup();
  const EVENT_TITLE = '[WS-LINK-TEST] Họp tổ chuyên môn';
  try {
    const event = await createEvent(db, {
      title: EVENT_TITLE,
      campusId: 'CAMPUS_1',
      startAt: new Date('2026-01-05T08:00:00+07:00'),
      endAt: new Date('2026-01-05T09:00:00+07:00'),
      chairPerId: 'per-a',
      createdByPerId: 'per-a'
    });
    const task1 = await createTask(db, {
      eventId: event.id,
      title: '[WS-LINK-TEST] Việc 1',
      campusId: 'CAMPUS_1',
      assigneePerId: 'per-b',
      dueAt: new Date('2026-01-05T08:00:00+07:00'),
      createdByPerId: 'per-a'
    });
    await createTask(db, {
      eventId: event.id,
      title: '[WS-LINK-TEST] Việc 2',
      campusId: 'CAMPUS_1',
      assigneePerId: 'per-b',
      dueAt: new Date('2026-01-05T08:00:00+07:00'),
      createdByPerId: 'per-a'
    });
    // 2026-10-05: chỉ còn 2 trạng thái, chủ trì (assignee) tự đánh dấu hoàn thành.
    await changeTaskStatus(db, { taskId: task1.id, nextStatus: 'COMPLETED', actorPerId: 'per-b' });

    // Liên kết eventId không tồn tại -> bị chặn ngay lúc tạo dòng.
    await assert.rejects(
      () => createWeeklySheetRow(db, { rowDate: '2026-01-05', content: 'Họp tổ', linkedEventId: '00000000-0000-4000-8000-000000000000' }, EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'not_found'
    );

    const row = await createWeeklySheetRow(db, { rowDate: '2026-01-05', timeLabel: '7h30', content: 'Họp tổ chuyên môn', linkedEventId: event.id }, EDITOR);
    assert.equal(row.linkedEventId, event.id);

    const week = await listWeeklySheetRows(db, { weekStart: '2026-01-05' });
    const summary = week.linkedEvents[event.id];
    assert.ok(summary, 'phải có tóm tắt sự kiện đã liên kết trong linkedEvents');
    assert.equal(summary!.title, EVENT_TITLE);
    assert.equal(summary!.taskCount, 2);
    assert.equal(summary!.taskCompletedCount, 1);
    assert.equal(summary!.taskProgressPercent, 50, '1/2 việc xong -> đúng 50%, mượn nguyên từ attachTaskProgress');

    // Bỏ liên kết — truyền `null` tường minh, không phải bỏ field.
    const unlinked = await updateWeeklySheetRow(db, row.id, { linkedEventId: null }, EDITOR);
    assert.equal(unlinked.linkedEventId, null);
    const weekAfterUnlink = await listWeeklySheetRows(db, { weekStart: '2026-01-05' });
    assert.deepEqual(weekAfterUnlink.linkedEvents, {}, 'không còn dòng nào liên kết -> map rỗng');
  } finally {
    await cleanup();
    await db.delete(ltcTasks).where(eq(ltcTasks.title, '[WS-LINK-TEST] Việc 1'));
    await db.delete(ltcTasks).where(eq(ltcTasks.title, '[WS-LINK-TEST] Việc 2'));
    await db.delete(ltcEvents).where(eq(ltcEvents.title, EVENT_TITLE));
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

test('weeklySheet: kết nối Google Sheet — chưa kết nối trả null, chỉ editor lưu/đổi/ngắt được, lưu link rác bị từ chối', { skip }, async () => {
  await cleanupConnection();
  try {
    assert.equal(await getSheetConnection(db), null);

    await assert.rejects(
      () => setSheetConnection(db, 'https://docs.google.com/spreadsheets/d/ABC123DEF456GHI789JKL/edit', NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );

    await assert.rejects(
      () => setSheetConnection(db, 'không phải link gì cả', EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'invalid_input'
    );

    const saved = await setSheetConnection(db, 'https://docs.google.com/spreadsheets/d/ABC123DEF456GHI789JKL/edit', EDITOR);
    assert.equal(saved.sheetUrl, 'https://docs.google.com/spreadsheets/d/ABC123DEF456GHI789JKL/edit');
    assert.equal(saved.connectedByPerId, EDITOR.perId);

    const fetched = await getSheetConnection(db);
    assert.equal(fetched?.sheetUrl, saved.sheetUrl);

    // Đổi link (lưu lần 2) -> ghi đè đúng 1 dòng duy nhất, không tạo thêm dòng mới.
    const changed = await setSheetConnection(db, 'https://docs.google.com/spreadsheets/d/ZYXWVUTSRQPONMLKJIH/edit', EDITOR);
    assert.equal(changed.sheetUrl, 'https://docs.google.com/spreadsheets/d/ZYXWVUTSRQPONMLKJIH/edit');

    await assert.rejects(
      () => clearSheetConnection(db, NON_EDITOR),
      (e: unknown) => e instanceof AppError && e.code === 'forbidden'
    );

    await clearSheetConnection(db, EDITOR);
    assert.equal(await getSheetConnection(db), null);
  } finally {
    await cleanupConnection();
  }
});
