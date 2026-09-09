import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { accounts } from '../identity/identity.schema.js';
import { searchPeopleByName, getDisplayNamesByPerIds } from './people-search.js';

const skip = !process.env.DATABASE_URL;

// `accounts` dùng chung với module identity/các test khác — `uid` là PK,
// `per_id` có unique index (xem identity.schema.ts) — ID literal cố định
// sẽ đụng độ nếu chạy lặp lại trên DB chưa dọn giữa các lần chạy process
// (đã tự gây lỗi tương tự trước đây, xem mistake.md). Dùng suffix ngẫu
// nhiên RIÊNG cho mỗi lần chạy file này.
const RUN = crypto.randomUUID().slice(0, 8).toUpperCase();
function uid(label: string): string {
  return 'PS_' + RUN + '_' + label;
}
function perId(label: string): string {
  return 'PER.PS.' + RUN + '.' + label;
}

const seededUids: string[] = [];
async function resetTables() {
  if (seededUids.length === 0) return;
  await db.delete(accounts).where(inArray(accounts.uid, seededUids));
  seededUids.length = 0;
}

async function seedAccount(u: string, fields: { displayName?: string | null; perId?: string | null; email?: string }) {
  seededUids.push(u);
  await db.insert(accounts).values({
    uid: u,
    perId: fields.perId || 'PER.PS_' + u,
    displayName: fields.displayName ?? '',
    email: fields.email || u + '@thcsgiangvo.edu.vn'
  });
}

test('searchPeopleByName: query rỗng/1 ký tự -> trả mảng rỗng', { skip }, async () => {
  await resetTables();
  await seedAccount(uid('u1'), { displayName: 'Nguyễn Văn A', perId: perId('001') });

  assert.deepEqual(await searchPeopleByName(db, ''), []);
  assert.deepEqual(await searchPeopleByName(db, ' '), []);
  assert.deepEqual(await searchPeopleByName(db, 'a'), []);
  assert.deepEqual(await searchPeopleByName(db, undefined), []);
});

test('searchPeopleByName: khớp 1 phần tên, không dấu/khác hoa-thường, CHỈ trả perId+name', { skip }, async () => {
  await resetTables();
  await seedAccount(uid('u1'), { displayName: 'Nguyễn Văn A', perId: perId('001') });
  await seedAccount(uid('u2'), { displayName: 'Trần Thị B', perId: perId('002') });

  const results = await searchPeopleByName(db, 'van a');
  assert.equal(results.length, 1);
  assert.equal(results[0]!.perId, perId('001'));
  assert.equal(results[0]!.name, 'Nguyễn Văn A');
  assert.deepEqual(Object.keys(results[0]!).sort(), ['name', 'perId']);

  const resultsUpper = await searchPeopleByName(db, 'NGUYEN');
  assert.equal(resultsUpper.length, 1);
  assert.equal(resultsUpper[0]!.perId, perId('001'));

  const resultsAccent = await searchPeopleByName(db, 'nguyễn');
  assert.equal(resultsAccent.length, 1);
  assert.equal(resultsAccent[0]!.perId, perId('001'));
});

test('searchPeopleByName: nhiều người khớp -> giới hạn đúng 10 kết quả', { skip }, async () => {
  await resetTables();
  for (let i = 0; i < 15; i++) {
    const idx = String(i).padStart(2, '0');
    await seedAccount(uid('multi' + idx), { displayName: 'Nguyễn Văn PSTest' + idx, perId: perId('T' + idx) });
  }
  const results = await searchPeopleByName(db, 'nguyen van pstest');
  assert.equal(results.length, 10);
});

test('searchPeopleByName: không ai khớp -> mảng rỗng, không lỗi', { skip }, async () => {
  await resetTables();
  await seedAccount(uid('u1'), { displayName: 'Nguyễn Văn A', perId: perId('001') });
  const results = await searchPeopleByName(db, 'khong ton tai zzz');
  assert.deepEqual(results, []);
});

test('searchPeopleByName: bỏ qua account thiếu displayName hoặc thiếu perId', { skip }, async () => {
  await resetTables();
  await seedAccount(uid('incomplete1'), { displayName: '', perId: perId('099') });
  const results = await searchPeopleByName(db, 'khong');
  assert.equal(results.length, 0);
});

test('getDisplayNamesByPerIds: dùng để JOIN tên chỉ huy', { skip }, async () => {
  await resetTables();
  await seedAccount(uid('u1'), { displayName: 'Nguyễn Văn A', perId: perId('J01') });
  await seedAccount(uid('u2'), { displayName: 'Trần Thị B', perId: perId('J02') });

  const map = await getDisplayNamesByPerIds(db, [perId('J01'), perId('J02')]);
  assert.equal(map[perId('J01')], 'Nguyễn Văn A');
  assert.equal(map[perId('J02')], 'Trần Thị B');

  const mapMissing = await getDisplayNamesByPerIds(db, [perId('NOTFOUND')]);
  assert.equal(mapMissing[perId('NOTFOUND')], undefined);

  const mapEmpty = await getDisplayNamesByPerIds(db, []);
  assert.deepEqual(mapEmpty, {});

  const mapUndefined = await getDisplayNamesByPerIds(db, undefined);
  assert.deepEqual(mapUndefined, {});

  const mapWithNulls = await getDisplayNamesByPerIds(db, [perId('J01'), null, undefined, perId('J01')]);
  assert.equal(mapWithNulls[perId('J01')], 'Nguyễn Văn A');
  assert.equal(Object.keys(mapWithNulls).length, 1);
});

test('getDisplayNamesByPerIds: >30 perId -> vẫn trả đủ tên cho TẤT CẢ (Postgres IN không giới hạn 30 như Firestore)', { skip }, async () => {
  await resetTables();
  const ids: string[] = [];
  for (let i = 0; i < 45; i++) {
    const idx = String(i).padStart(3, '0');
    const pid = perId('B' + idx);
    ids.push(pid);
    await seedAccount(uid('batch_' + idx), { displayName: 'Người Chỉ Huy ' + idx, perId: pid });
  }
  const map = await getDisplayNamesByPerIds(db, ids);
  const allFound = ids.every((id, i) => map[id] === 'Người Chỉ Huy ' + String(i).padStart(3, '0'));
  assert.ok(allFound);
});
