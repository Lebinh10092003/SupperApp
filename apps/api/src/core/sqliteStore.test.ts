import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { SqliteDb } from './sqliteStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEST_DB_DIR = path.resolve(__dirname, '../../data');
const TEST_DB_FILE = path.resolve(TEST_DB_DIR, 'test_persistence.db');

describe('SqliteStore ACID & Persistence Engine', () => {
  let db: SqliteDb;

  before(() => {
    if (fs.existsSync(TEST_DB_FILE)) {
      fs.unlinkSync(TEST_DB_FILE);
    }
    db = new (class extends SqliteDb {
      constructor() {
        super();
        (this as any).sql = new Database(TEST_DB_FILE);
        (this as any).sql.pragma('journal_mode = WAL');
        (this as any).initTables();
      }
    })();
  });

  after(() => {
    db.close();
    if (fs.existsSync(TEST_DB_FILE)) {
      try {
        fs.unlinkSync(TEST_DB_FILE);
      } catch {}
    }
  });

  test('should insert and read back document correctly', async () => {
    const ref = db.collection('students').doc('std_01');
    await ref.set({ name: 'Lê Văn Bình', email: '09.levanbinh2003@gmail.com', gpa: 9.6 });

    const snap = await ref.get();
    assert.equal(snap.exists, true);
    assert.equal(snap.data()?.name, 'Lê Văn Bình');
    assert.equal(snap.data()?.gpa, 9.6);
  });

  test('should merge document properties on set with { merge: true }', async () => {
    const ref = db.collection('students').doc('std_01');
    await ref.set({ className: 'Lớp 12A1', grade: 12 }, { merge: true });

    const snap = await ref.get();
    assert.equal(snap.data()?.name, 'Lê Văn Bình');
    assert.equal(snap.data()?.className, 'Lớp 12A1');
    assert.equal(snap.data()?.grade, 12);
  });

  test('should support nested subcollections', async () => {
    const memberRef = db.collection('courses').doc('course_12a1').collection('members').doc('teacher_01');
    await memberRef.set({ name: 'Nguyễn Văn Đức', role: 'TEACHER' });

    const snap = await memberRef.get();
    assert.equal(snap.exists, true);
    assert.equal(snap.data()?.role, 'TEACHER');
  });

  test('should query documents with where, orderBy, and limit', async () => {
    await db.collection('test_items').doc('i1').set({ val: 10, cat: 'A' });
    await db.collection('test_items').doc('i2').set({ val: 25, cat: 'A' });
    await db.collection('test_items').doc('i3').set({ val: 5, cat: 'B' });

    const querySnap = await db.collection('test_items').where('cat', '==', 'A').orderBy('val', 'desc').limit(2).get();
    assert.equal(querySnap.size, 2);
    assert.equal(querySnap.docs[0]!.data().val, 25);
    assert.equal(querySnap.docs[1]!.data().val, 10);
  });

  test('should delete documents properly', async () => {
    const ref = db.collection('students').doc('to_delete');
    await ref.set({ name: 'Temp' });
    await ref.delete();

    const snap = await ref.get();
    assert.equal(snap.exists, false);
    assert.equal(snap.data(), undefined);
  });

  test('should execute atomic batch writes with commit', async () => {
    const batch = db.batch();
    const r1 = db.collection('batch_test').doc('b1');
    const r2 = db.collection('batch_test').doc('b2');

    batch.set(r1, { num: 100 });
    batch.set(r2, { num: 200 });
    await batch.commit();

    const s1 = await r1.get();
    const s2 = await r2.get();
    assert.equal(s1.data()?.num, 100);
    assert.equal(s2.data()?.num, 200);
  });
});
