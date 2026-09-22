import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isEscalation, effectiveConfidentiality, canTransition, isTerminal,
  STATE, extractGradeFromClassName, CATEGORY_CATALOG
} from './catalog.js';

test('isEscalation: nâng mức (rank thấp hơn) mới coi là leo thang', () => {
  assert.equal(isEscalation('P2', 'P0'), true);
  assert.equal(isEscalation('P0', 'P2'), false);
  assert.equal(isEscalation('P1', 'P1'), false);
});

test('effectiveConfidentiality: chỉ được nâng, không được hạ dưới sàn danh mục', () => {
  assert.equal(effectiveConfidentiality('abuse_neglect', 'C1'), 'C4'); // sàn C4, yêu cầu C1 -> vẫn C4
  assert.equal(effectiveConfidentiality('facility_general', 'C3'), 'C3'); // sàn C1, yêu cầu C3 cao hơn -> giữ C3
  assert.equal(effectiveConfidentiality('facility_general', undefined), 'C1'); // không hợp lệ -> về sàn
});

test('canTransition: đúng ma trận chuyển trạng thái gốc, "Đã đóng" chỉ mở lại được', () => {
  assert.equal(canTransition(STATE.NEW, STATE.CLASSIFYING), true);
  assert.equal(canTransition(STATE.NEW, STATE.CLOSED), false);
  assert.equal(canTransition(STATE.CLOSED, STATE.REOPENED), true);
  assert.equal(canTransition(STATE.CLOSED, STATE.IN_PROGRESS), false);
  assert.equal(isTerminal(STATE.CLOSED), true);
  assert.equal(isTerminal(STATE.IN_PROGRESS), false);
});

test('extractGradeFromClassName: chỉ lấy số đầu, không đoán bừa', () => {
  assert.equal(extractGradeFromClassName('8A3'), '8');
  assert.equal(extractGradeFromClassName('10A1 '), '10');
  assert.equal(extractGradeFromClassName('Lớp ghép A'), null);
  assert.equal(extractGradeFromClassName(null), null);
});

test('CATEGORY_CATALOG: đúng 20 nhóm sự cố, không thiếu/thừa so với bản gốc', () => {
  assert.equal(Object.keys(CATEGORY_CATALOG).length, 20);
});
