import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { reports, reportIdentities } from './reports.schema.js';
import { incidents } from './incidents.schema.js';
import { notifyReporterForReport, notifyReporterForIncident, REPORTER_EVENT } from './reporter-notify.js';
import type { DispatchAdapter } from './dispatch.js';

/**
 * Không có file gốc `test-reporterNotify.js` để port 1-1 (module gốc chưa
 * từng có test riêng trong dự án Firebase) — viết mới, bám sát hành vi đã
 * đọc trong `reporterNotify.js`. ID tiền tố `RN_` riêng.
 */

const skip = !process.env.DATABASE_URL;

async function cleanup() {
  await db.delete(reportIdentities).where(inArray(reportIdentities.reportId, ['TB.RN_1', 'TB.RN_2', 'TB.RN_3']));
  await db.delete(reports).where(inArray(reports.reportId, ['TB.RN_1', 'TB.RN_2', 'TB.RN_3']));
  await db.delete(incidents).where(eq(incidents.incidentId, 'SC.RN_1'));
}

function baseReport(reportId: string, publicCode: string) {
  return {
    reportId,
    publicCode,
    channel: 'public_web',
    campusId: 'CS.RN_01',
    categoryCode: 'facility_general',
    occurredAt: new Date('2026-08-21T08:00:00+07:00'),
    confidentiality: 'C1',
    content: 'test',
    anonymous: false,
    createdAt: new Date('2026-08-21T08:00:00+07:00')
  };
}

test('reporterNotify: notifyReporterForReport — không có email/không có adapter -> sent:false, có cả 2 -> gửi thật qua adapter', { skip }, async () => {
  await cleanup();
  try {
    await db.insert(reports).values(baseReport('TB.RN_1', 'GV-RN-0001'));
    const noEmail = await notifyReporterForReport(db, { reportId: 'TB.RN_1', eventType: REPORTER_EVENT.RECEIVED }, {});
    assert.equal(noEmail.sent, false);
    assert.equal(noEmail.reason, 'no_email');

    await db.insert(reportIdentities).values({ reportId: 'TB.RN_1', email: 'nguoibaotin@example.com' });
    const noAdapter = await notifyReporterForReport(db, { reportId: 'TB.RN_1', eventType: REPORTER_EVENT.RECEIVED }, {});
    assert.equal(noAdapter.sent, false);
    assert.equal(noAdapter.reason, 'no_adapter_configured');

    const sentMessages: Array<{ to?: unknown; text?: unknown }> = [];
    const fakeAdapter: DispatchAdapter = {
      send: async (msg) => { sentMessages.push(msg); return { status: 'sent_test' }; }
    };
    const ok = await notifyReporterForReport(db, { reportId: 'TB.RN_1', eventType: REPORTER_EVENT.RECEIVED }, { emailAdapter: fakeAdapter });
    assert.equal(ok.sent, true);
    assert.equal(ok.status, 'sent_test');
    assert.equal(sentMessages.length, 1);
    assert.equal(sentMessages[0]!.to, 'nguoibaotin@example.com');
    assert.ok(String(sentMessages[0]!.text).includes('GV-RN-0001'));
    assert.ok(!String(sentMessages[0]!.text).includes('TB.RN_1'), 'nội dung email TUYỆT ĐỐI không được lộ mã nội bộ');

    const notFound = await notifyReporterForReport(db, { reportId: 'TB.RN_NOPE', eventType: REPORTER_EVENT.RECEIVED }, { emailAdapter: fakeAdapter });
    assert.equal(notFound.sent, false);
    assert.equal(notFound.reason, 'report_not_found');
  } finally {
    await cleanup();
  }
});

test('reporterNotify: notifyReporterForIncident — gửi tới người báo tin của TỪNG report đã gộp', { skip }, async () => {
  await cleanup();
  try {
    await db.insert(reports).values([baseReport('TB.RN_2', 'GV-RN-0002'), baseReport('TB.RN_3', 'GV-RN-0003')]);
    await db.insert(reportIdentities).values([
      { reportId: 'TB.RN_2', email: 'a@example.com' },
      { reportId: 'TB.RN_3', email: null }
    ]);
    await db.insert(incidents).values({
      incidentId: 'SC.RN_1', campusId: 'CS.RN_01', categoryCode: 'facility_general', priority: 'P2',
      confidentiality: 'C1', state: 'Mới tiếp nhận', reportIds: ['TB.RN_2', 'TB.RN_3'], version: 1,
      createdAt: new Date(), updatedAt: new Date()
    });

    const sentMessages: unknown[] = [];
    const fakeAdapter: DispatchAdapter = { send: async (msg) => { sentMessages.push(msg); return { status: 'sent_test' }; } };
    const results = await notifyReporterForIncident(db, { incidentId: 'SC.RN_1', eventType: REPORTER_EVENT.CLOSED }, { emailAdapter: fakeAdapter });
    assert.equal(results.length, 2);
    assert.equal(results.find((r) => r.reportId === 'TB.RN_2')!.sent, true);
    assert.equal(results.find((r) => r.reportId === 'TB.RN_3')!.sent, false);
    assert.equal(sentMessages.length, 1);

    const noIncident = await notifyReporterForIncident(db, { incidentId: 'SC.RN_NOPE', eventType: REPORTER_EVENT.CLOSED }, { emailAdapter: fakeAdapter });
    assert.deepEqual(noIncident, []);
  } finally {
    await cleanup();
  }
});
