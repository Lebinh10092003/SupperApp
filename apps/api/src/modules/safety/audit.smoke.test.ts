import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { auditLogs } from './audit.schema.js';
import { buildAuditRecord, writeAuditLog, isMandatoryAuditAction } from './audit.js';

test('buildAuditRecord: bắt buộc actorPerId/action/objectId', () => {
  assert.throws(() => buildAuditRecord({ actorPerId: '', action: 'x', objectId: 'y' }), /actorPerId/);
  assert.throws(() => buildAuditRecord({ actorPerId: 'PER.1', action: '', objectId: 'y' }), /action/);
  assert.throws(() => buildAuditRecord({ actorPerId: 'PER.1', action: 'x', objectId: '' }), /objectId/);
});

test('isMandatoryAuditAction: đúng danh sách hành động bắt buộc ghi log', () => {
  assert.equal(isMandatoryAuditAction('incident.reopen'), true);
  assert.equal(isMandatoryAuditAction('incident.view_c1_c2'), false); // C1/C2 không bắt buộc, chỉ C3/C4
});

const skip = !process.env.DATABASE_URL;

test('writeAuditLog: ghi thật vào Postgres, đọc lại đúng nội dung', { skip }, async () => {
  const objectId = `SC.TEST.${Date.now()}`;
  const record = buildAuditRecord({
    actorPerId: 'PER.SMOKE', action: 'incident.reopen', objectId,
    before: { status: 'Đã đóng' }, after: { status: 'Mở lại' }, reason: 'Test khói'
  });
  const logId = await writeAuditLog(db, record);
  try {
    const [row] = await db.select().from(auditLogs).where(eq(auditLogs.logId, logId)).limit(1);
    assert.equal(row?.actorPerId, 'PER.SMOKE');
    assert.equal(row?.action, 'incident.reopen');
    assert.deepEqual(row?.before, { status: 'Đã đóng' });
    assert.deepEqual(row?.after, { status: 'Mở lại' });
  } finally {
    await db.delete(auditLogs).where(eq(auditLogs.logId, logId));
  }
});
