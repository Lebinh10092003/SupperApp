/**
 * exam-schedule.service.test.ts — xác nhận import atomic (§21-22 đặc tả):
 * 1 dòng lỗi -> không import dòng nào; file hợp lệ -> import hết. Test
 * thật với Postgres (không mock), bỏ qua nếu không có DATABASE_URL.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { ltcExamShifts } from './exam-schedule.schema.js';
import { ltcAuditLogs } from './work-schedule.schema.js';
import { importExamShifts, listExamShifts, ImportValidationError, type ImportRowInput } from './exam-schedule.service.js';
import { AppError } from './exam-schedule.service.js';

const skip = !process.env.DATABASE_URL;

async function cleanup() {
  await db.delete(ltcAuditLogs).where(eq(ltcAuditLogs.entityType, 'exam_shift'));
  await db.delete(ltcExamShifts);
}

test('importExamShifts: file hợp lệ toàn bộ -> import hết, đúng campusId và chữ tự do GV', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const rows: ImportRowInput[] = [
    { rowNumber: 1, examDate: '22/09/2026', session: 'Sáng', periodLabel: '1+2', timeLabel: '7h30-9h00', subject: 'Toán', className: '8A1', firstProctorName: 'Nguyễn Văn A', secondProctorName: 'Trần Thị B' },
    { rowNumber: 2, examDate: '22/09/2026', session: 'Sáng', periodLabel: '1+2', timeLabel: '7h30-9h00', subject: 'Văn', className: '8A2', firstProctorName: 'Lê Văn C' }
  ];
  const result = await importExamShifts(db, { campusId: 'MAIN_CAMPUS', rows }, 'per-admin');
  assert.equal(result.count, 2);

  const saved = await listExamShifts(db, { monthStart: '2026-09-01', monthEnd: '2026-09-30' });
  assert.equal(saved.length, 2);
  assert.equal(saved[0]!.examDate, '2026-09-22');
  assert.equal(saved[0]!.campusId, 'MAIN_CAMPUS');
  assert.equal(saved[0]!.firstProctorName, 'Nguyễn Văn A');
  assert.equal(saved[0]!.firstProctorPerId, null, 'dòng import không gán perId tự động');

  const logs = await db.select().from(ltcAuditLogs).where(eq(ltcAuditLogs.entityType, 'exam_shift'));
  assert.ok(logs.some((l) => l.action === 'exam_shift.imported'));
});

test('importExamShifts: 1 dòng lỗi ngày -> KHÔNG import dòng nào, báo đúng dòng/cột/giá trị/lỗi', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  const rows: ImportRowInput[] = [
    { rowNumber: 1, examDate: '22/09/2026', subject: 'Toán', className: '8A1' },
    { rowNumber: 2, examDate: '32/09/2026', subject: 'Văn', className: '8A2' }, // ngày không hợp lệ
    { rowNumber: 3, examDate: '2026-09-25', subject: 'Anh', className: '8A3' } // sai định dạng (ISO thay vì dd/mm/yyyy)
  ];

  await assert.rejects(
    () => importExamShifts(db, { campusId: 'MAIN_CAMPUS', rows }, 'per-admin'),
    (err: unknown) => {
      assert.ok(err instanceof ImportValidationError);
      assert.equal(err.errors.length, 2);
      assert.deepEqual(err.errors[0], { row: 2, column: 'Ngày', value: '32/09/2026', message: 'Ngày không hợp lệ.' });
      assert.deepEqual(err.errors[1], { row: 3, column: 'Ngày', value: '2026-09-25', message: 'Sai định dạng. Yêu cầu dd/mm/yyyy.' });
      return true;
    }
  );

  const saved = await listExamShifts(db, { monthStart: '2026-01-01', monthEnd: '2026-12-31' });
  assert.equal(saved.length, 0, 'dòng 1 hợp lệ nhưng KHÔNG được import vì file có lỗi ở dòng khác');
});

test('importExamShifts: thiếu campusId hoặc file rỗng -> lỗi rõ ràng', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  await assert.rejects(
    () => importExamShifts(db, { campusId: '', rows: [{ rowNumber: 1, examDate: '22/09/2026' }] }, 'per-admin'),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input'
  );
  await assert.rejects(
    () => importExamShifts(db, { campusId: 'MAIN_CAMPUS', rows: [] }, 'per-admin'),
    (err: unknown) => err instanceof AppError && err.code === 'invalid_input'
  );
});

test('listExamShifts: lọc theo teacherName kiểm tra CẢ firstProctorName lẫn secondProctorName (OR)', { skip }, async (t) => {
  t.after(cleanup);
  await cleanup();

  await importExamShifts(
    db,
    {
      campusId: 'CAMPUS_1',
      rows: [
        { rowNumber: 1, examDate: '22/09/2026', firstProctorName: 'Nguyễn Văn A', secondProctorName: 'Trần Thị B' },
        { rowNumber: 2, examDate: '22/09/2026', firstProctorName: 'Lê Văn C', secondProctorName: 'Nguyễn Văn A' },
        { rowNumber: 3, examDate: '22/09/2026', firstProctorName: 'Phạm Thị D', secondProctorName: 'Hoàng Văn E' }
      ]
    },
    'per-admin'
  );

  const found = await listExamShifts(db, { monthStart: '2026-09-01', monthEnd: '2026-09-30', teacherName: 'Nguyễn Văn A' });
  assert.equal(found.length, 2, 'phải thấy cả 2 dòng — 1 ở cột đầu, 1 ở cột sau');
});
