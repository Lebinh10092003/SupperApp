import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSpreadsheetId, parseWeeklySheetRows } from './google-sheets-import.js';

test('extractSpreadsheetId — nhận cả link đầy đủ lẫn ID trần, từ chối chuỗi rác', () => {
  assert.equal(
    extractSpreadsheetId('https://docs.google.com/spreadsheets/d/12k9HSj5xRMqjEoJYupdPzfWtagiUeroOEj5NL2_9JRA/edit?usp=drivesdk'),
    '12k9HSj5xRMqjEoJYupdPzfWtagiUeroOEj5NL2_9JRA'
  );
  assert.equal(extractSpreadsheetId('12k9HSj5xRMqjEoJYupdPzfWtagiUeroOEj5NL2_9JRA'), '12k9HSj5xRMqjEoJYupdPzfWtagiUeroOEj5NL2_9JRA');
  assert.throws(() => extractSpreadsheetId('không phải link gì cả'), /invalid_input|Không nhận diện/);
  assert.throws(() => extractSpreadsheetId(''), /invalid_input|Không nhận diện/);
});

test('parseWeeklySheetRows — bỏ qua hàng tiêu đề/header phía trên, forward-fill ô ngày gộp trống', () => {
  // Mô phỏng ĐÚNG shape Sheets API trả về cho sheet test thật đã tạo
  // 2026-09-28 (link: docs.google.com/spreadsheets/d/12k9HSj5xRMqjEoJYupdPzfWtagiUeroOEj5NL2_9JRA)
  // — Sheets API CẮT các ô trắng cuối mỗi hàng, không đệm đủ 5 cột.
  const values = [
    ['LỊCH CÔNG TÁC TUẦN 03 TỪ 21/9-27/9/2026'],
    ['Thứ/ngày', 'Thời gian', 'Nội dung công việc', 'Địa điểm', 'Người thực hiện'],
    ['2026-09-21', '7h30', 'Chào cờ...', 'Điểm trường chính', 'BGH'],
    ['', '8h00', 'Chấm thi HSG lớp 9 cấp trường', 'Điểm trường chính', 'GV theo phân công'],
    ['', '9h00', 'Họp Giao ban BGH', 'Phòng Hiệu trưởng', 'BGH'],
    ['2026-09-22', '9h30', 'Văn phòng Phát hành Giấy mời họp TBPH và PHHS'], // ô Địa điểm/Người thực hiện trống -> Sheets API cắt hẳn
    ['', 'Tiết 1', 'Tiết dạy thí điểm mô hình Lớp học trung tâm/LHM (Tin học)', 'THCS Giảng Võ']
  ];

  const rows = parseWeeklySheetRows(values, 2026);
  assert.equal(rows.length, 5, 'bỏ đúng 2 hàng tiêu đề + header, giữ lại 5 hàng dữ liệu');

  assert.equal(rows[0]!.rowDate, '2026-09-21');
  assert.equal(rows[0]!.timeLabel, '7h30');
  assert.equal(rows[0]!.content, 'Chào cờ...');
  assert.equal(rows[0]!.sortOrder, 0);

  assert.equal(rows[1]!.rowDate, '2026-09-21', 'ô ngày trống ở hàng 2 -> forward-fill lấy ngày hàng trước (ô gộp)');
  assert.equal(rows[1]!.timeLabel, '8h00');
  assert.equal(rows[1]!.sortOrder, 1, 'thứ tự tăng dần trong cùng 1 ngày');

  assert.equal(rows[2]!.rowDate, '2026-09-21');
  assert.equal(rows[2]!.sortOrder, 2);

  assert.equal(rows[3]!.rowDate, '2026-09-22', 'sang ngày mới -> đổi rowDate đúng');
  assert.equal(rows[3]!.content, 'Văn phòng Phát hành Giấy mời họp TBPH và PHHS');
  assert.equal(rows[3]!.location, '', 'hàng bị Sheets API cắt cụt (thiếu cột Địa điểm/Người thực hiện) -> điền rỗng, không throw');
  assert.equal(rows[3]!.sortOrder, 0, 'reset thứ tự về 0 khi sang ngày mới');

  assert.equal(rows[4]!.rowDate, '2026-09-22');
  assert.equal(rows[4]!.timeLabel, 'Tiết 1');
  assert.equal(rows[4]!.sortOrder, 1);
});

test('parseWeeklySheetRows — chấp nhận cột ngày dạng D/M (không phải ISO), suy năm từ targetYear', () => {
  const values = [
    ['Thứ Hai (21/9)', '7h30', 'Chào cờ', 'Sân trường', 'BGH'],
    ['', '8h00', 'Việc khác', 'Đâu đó', 'Ai đó']
  ];
  const rows = parseWeeklySheetRows(values, 2027);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.rowDate, '2027-09-21', 'suy đúng ngày/tháng từ "21/9" lẫn trong chữ, năm lấy theo targetYear');
  assert.equal(rows[1]!.rowDate, '2027-09-21');
});

test('parseWeeklySheetRows — hàng trắng hoàn toàn bị bỏ qua, không sinh dòng rỗng chen giữa', () => {
  const values = [
    ['2026-09-21', '7h30', 'A', '', 'X'],
    ['', '', '', '', ''],
    ['', '8h00', 'B', '', 'Y']
  ];
  const rows = parseWeeklySheetRows(values, 2026);
  assert.equal(rows.length, 2, 'hàng trắng hoàn toàn (kể cả cột ngày) không sinh dòng');
  assert.equal(rows[1]!.content, 'B');
});

test('parseWeeklySheetRows — mảng values rỗng hoặc chỉ có tiêu đề -> mảng rỗng, không throw', () => {
  assert.deepEqual(parseWeeklySheetRows([], 2026), []);
  assert.deepEqual(parseWeeklySheetRows([['LỊCH CÔNG TÁC TUẦN X']], 2026), []);
});
