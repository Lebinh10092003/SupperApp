import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { assignments, dutyShifts } from '../identity/identity.schema.js';
import { findLeadershipForCampus, findOnDutyOfficersForCampus, getEscalationRecipients } from './escalation-recipients.js';
import { ROLE } from './catalog.js';

/** Port 1-1 từ `functions/test/test-escalation-recipients.js`. ID tiền tố `ESC_` riêng, tránh đụng file test khác (xem core/db/README.md). */

const skip = !process.env.DATABASE_URL;
const now = new Date('2026-08-21T09:00:00+07:00');

const PER_IDS = [
  'PER.ESC_HIEUTRUONG', 'PER.ESC_PHOHT_CS01', 'PER.ESC_PHOHT_CS02', 'PER.ESC_PHOHT_CS01_HET_HAN',
  'PER.ESC_TRUCBAN_DANG_TRUC', 'PER.ESC_TRUCBAN_KHONG_TRUC', 'PER.ESC_TRUCBAN_CS_KHAC'
];

async function cleanup() {
  await db.delete(assignments).where(inArray(assignments.perId, PER_IDS));
  await db.delete(dutyShifts).where(inArray(dutyShifts.perId, PER_IDS));
}

test('escalationRecipients: leadership + trực ban đúng cơ sở, khử trùng lặp', { skip }, async () => {
  await cleanup();
  try {
    await db.insert(assignments).values([
      { perId: 'PER.ESC_HIEUTRUONG', roleId: ROLE.PRINCIPAL, campusId: null },
      { perId: 'PER.ESC_PHOHT_CS01', roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01' },
      { perId: 'PER.ESC_PHOHT_CS02', roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.02' },
      // Phó HT đúng cơ sở nhưng đã HẾT hiệu lực -> phải bị loại.
      { perId: 'PER.ESC_PHOHT_CS01_HET_HAN', roleId: ROLE.VICE_PRINCIPAL, campusId: 'CS.01', fromDate: new Date('2020-01-01T00:00:00+07:00'), toDate: new Date('2021-01-01T00:00:00+07:00') }
    ]);

    const leadershipCS01 = await findLeadershipForCampus(db, 'CS.01', { now });
    assert.ok(leadershipCS01.includes('PER.ESC_HIEUTRUONG'), 'Hiệu trưởng luôn có mặt bất kể campusId');
    assert.ok(leadershipCS01.includes('PER.ESC_PHOHT_CS01'));
    assert.ok(!leadershipCS01.includes('PER.ESC_PHOHT_CS02'), 'Phó HT cơ sở khác không được lẫn vào');
    assert.ok(!leadershipCS01.includes('PER.ESC_PHOHT_CS01_HET_HAN'), 'assignment hết hiệu lực phải bị loại');

    const leadershipCS02 = await findLeadershipForCampus(db, 'CS.02', { now });
    assert.ok(leadershipCS02.includes('PER.ESC_HIEUTRUONG'));
    assert.ok(leadershipCS02.includes('PER.ESC_PHOHT_CS02'));

    await db.insert(assignments).values([
      { perId: 'PER.ESC_TRUCBAN_DANG_TRUC', roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' },
      { perId: 'PER.ESC_TRUCBAN_KHONG_TRUC', roleId: ROLE.DUTY_OFFICER, campusId: 'CS.01' },
      { perId: 'PER.ESC_TRUCBAN_CS_KHAC', roleId: ROLE.DUTY_OFFICER, campusId: 'CS.02' }
    ]);
    await db.insert(dutyShifts).values([
      { perId: 'PER.ESC_TRUCBAN_DANG_TRUC', fromAt: new Date(now.getTime() - 3600_000), toAt: new Date(now.getTime() + 3600_000) },
      { perId: 'PER.ESC_TRUCBAN_KHONG_TRUC', fromAt: new Date(now.getTime() - 5 * 3600_000), toAt: new Date(now.getTime() - 2 * 3600_000) },
      { perId: 'PER.ESC_TRUCBAN_CS_KHAC', fromAt: new Date(now.getTime() - 3600_000), toAt: new Date(now.getTime() + 3600_000) }
    ]);

    const onDutyCS01 = await findOnDutyOfficersForCampus(db, 'CS.01', { now });
    assert.ok(onDutyCS01.includes('PER.ESC_TRUCBAN_DANG_TRUC'));
    assert.ok(!onDutyCS01.includes('PER.ESC_TRUCBAN_KHONG_TRUC'), 'ca trực đã kết thúc không được tính');
    assert.ok(!onDutyCS01.includes('PER.ESC_TRUCBAN_CS_KHAC'), 'khác cơ sở không được tính');
    assert.deepEqual(await findOnDutyOfficersForCampus(db, 'CS.99', { now }), []);

    const merged = await getEscalationRecipients(db, { campusId: 'CS.01' }, { now });
    assert.ok(merged.leadershipPerIds.includes('PER.ESC_HIEUTRUONG') && merged.leadershipPerIds.includes('PER.ESC_PHOHT_CS01'));
    assert.ok(merged.onDutyPerIds.includes('PER.ESC_TRUCBAN_DANG_TRUC'));
    assert.ok(!merged.leadershipPerIds.includes('PER.ESC_PHOHT_CS02') && !merged.onDutyPerIds.includes('PER.ESC_TRUCBAN_CS_KHAC'));

    // Bản gốc (Firestore) còn 1 case "1 người có 2 assignment DUTY_OFFICER
    // trùng cùng cơ sở -> vẫn chỉ xuất hiện 1 lần (khử trùng lặp bằng Set)".
    // BỎ ở đây vì không còn tái hiện được: unique index
    // `assignments_per_role_idx` (perId, roleId) ở `identity.schema.ts`
    // (đúng theo composite doc ID gốc `perId + '__' + roleId`) khiến việc
    // chèn 2 dòng trùng (perId, roleId) bị CHẶN NGAY ở tầng DB — ràng buộc
    // dữ liệu chặt hơn bản gốc, không cần dựa vào dedup ở tầng code nữa.
  } finally {
    await cleanup();
  }
});
