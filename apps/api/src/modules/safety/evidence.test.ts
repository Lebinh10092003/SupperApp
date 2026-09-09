import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { and, eq } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import * as catalog from './catalog.js';
import { evidence as evidenceTable } from './evidence.schema.js';
import {
  detectFormat,
  validateAndStoreEvidence,
  linkEvidenceToReport,
  purgeOrphanEvidence,
  getSignedDownloadUrl,
  canViewEvidence,
  scanBuffer,
  type EvidenceBucket
} from './evidence.js';

const skip = !process.env.DATABASE_URL;

// ---------------------------------------------------------------------------
// FakeBucket — mô phỏng đủ API dùng trong evidence.ts, port 1-1 từ
// test-evidence.js gốc (file(path).save()/.delete()/.getSignedUrl()).
// ---------------------------------------------------------------------------
class FakeFile {
  constructor(
    private store: Map<string, unknown>,
    private path: string
  ) {}
  async save(buffer: Buffer, opts: unknown) {
    this.store.set(this.path, { buffer, opts });
  }
  async delete() {
    if (!this.store.has(this.path)) {
      const e: any = new Error('object not found: ' + this.path);
      e.code = 404;
      throw e;
    }
    this.store.delete(this.path);
  }
  async getSignedUrl(opts: { action: string; expires: number; responseDisposition: string }): Promise<[string]> {
    return ['https://fake-storage.test/' + this.path + '?action=' + opts.action + '&expires=' + opts.expires + '&disposition=' + opts.responseDisposition];
  }
}
class FakeBucket implements EvidenceBucket {
  store = new Map<string, unknown>();
  file(path: string) {
    return new FakeFile(this.store, path) as any;
  }
}

function padded(prefixBytes: Buffer, totalLen: number): Buffer {
  const buf = Buffer.alloc(Math.max(totalLen, prefixBytes.length), 0);
  prefixBytes.copy(buf, 0);
  return buf;
}
function mp3Buffer() {
  return padded(Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x21', 'binary'), 200);
}
function mp4Buffer() {
  const head = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x20]), Buffer.from('ftyp', 'ascii'), Buffer.from('isom', 'ascii')]);
  return padded(head, 200);
}
function wavBuffer() {
  const head = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0x24, 0x00, 0x00, 0x00]), Buffer.from('WAVE', 'ascii')]);
  return padded(head, 200);
}
function webmBuffer() {
  const head = Buffer.from([0x1a, 0x45, 0xdf, 0xa3]);
  return padded(head, 200);
}
function garbageBuffer() {
  return Buffer.from('day khong phai file hop le tuyet doi khong khop chu ky nao', 'utf8');
}

async function clearEvidence() {
  await db.delete(evidenceTable);
}

test('evidence: nhận diện magic bytes + chấp nhận file đúng định dạng', { skip }, async () => {
  await clearEvidence();
  const bucket = new FakeBucket();

  const jpegBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
  const rJpeg = await validateAndStoreEvidence(db, bucket, { buffer: jpegBuf, declaredMimeType: 'image/jpeg', declaredFilename: 'anh.jpg' }, { now: new Date() });
  assert.equal(rJpeg.rejected, false);
  assert.equal((rJpeg as any).fileType, 'image');

  const pngBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toBuffer();
  const rPng = await validateAndStoreEvidence(db, bucket, { buffer: pngBuf, declaredMimeType: 'image/png', declaredFilename: 'anh.png' }, { now: new Date() });
  assert.equal(rPng.rejected, false);

  const webpBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 255 } } }).webp().toBuffer();
  const rWebp = await validateAndStoreEvidence(db, bucket, { buffer: webpBuf, declaredMimeType: 'image/webp', declaredFilename: 'anh.webp' }, { now: new Date() });
  assert.equal(rWebp.rejected, false);

  const rMp3 = await validateAndStoreEvidence(db, bucket, { buffer: mp3Buffer(), declaredMimeType: 'audio/mpeg', declaredFilename: 'ghiam.mp3' }, { now: new Date() });
  assert.equal(rMp3.rejected, false);
  assert.equal((rMp3 as any).fileType, 'audio');

  const rMp4 = await validateAndStoreEvidence(db, bucket, { buffer: mp4Buffer(), declaredMimeType: 'video/mp4', declaredFilename: 'video.mp4' }, { now: new Date() });
  assert.equal(rMp4.rejected, false);
  assert.equal((rMp4 as any).fileType, 'video');

  const rWav = await validateAndStoreEvidence(db, bucket, { buffer: wavBuffer(), declaredMimeType: 'audio/wav', declaredFilename: 'ghiam.wav' }, { now: new Date() });
  assert.equal(rWav.rejected, false);

  const rWebm = await validateAndStoreEvidence(db, bucket, { buffer: webmBuffer(), declaredMimeType: 'video/webm', declaredFilename: 'video.webm' }, { now: new Date() });
  assert.equal(rWebm.rejected, false);

  assert.equal(bucket.store.size, 7);

  // Buffer rác không khớp chữ ký nào -> reject, KHÔNG ghi Storage thêm.
  const rGarbage = await validateAndStoreEvidence(db, bucket, { buffer: garbageBuffer(), declaredMimeType: 'image/jpeg', declaredFilename: 'anh.jpg' }, { now: new Date() });
  assert.equal(rGarbage.rejected, true);
  assert.equal(bucket.store.size, 7);

  // Ảnh JPEG thật nhưng đặt tên .png (giả mạo đuôi file) -> reject.
  const rMismatch = await validateAndStoreEvidence(db, bucket, { buffer: jpegBuf, declaredMimeType: 'image/png', declaredFilename: 'gia_mao.png' }, { now: new Date() });
  assert.equal(rMismatch.rejected, true);
  assert.equal((rMismatch as any).reason, 'extension_signature_mismatch');

  // Vượt giới hạn kích thước theo đúng loại file.
  const oversizedWav = Buffer.concat([wavBuffer(), Buffer.alloc(catalog.EVIDENCE_LIMITS.MAX_SIZE_BYTES.audio + 1024, 0)]);
  const rOversized = await validateAndStoreEvidence(db, bucket, { buffer: oversizedWav, declaredMimeType: 'audio/wav', declaredFilename: 'dai.wav' }, { now: new Date() });
  assert.equal(rOversized.rejected, true);
  assert.equal((rOversized as any).reason, 'file_too_large');

  await clearEvidence();
});

test('evidence: linkEvidenceToReport — bỏ qua ID không hợp lệ, không throw', { skip }, async () => {
  await clearEvidence();
  const bucket = new FakeBucket();
  const now = new Date('2026-08-20T08:00:00+07:00');
  const jpegBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
  const pngBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toBuffer();

  const okOne = await validateAndStoreEvidence(db, bucket, { buffer: jpegBuf, declaredMimeType: 'image/jpeg', declaredFilename: 'a.jpg' }, { now });
  const okTwo = await validateAndStoreEvidence(db, bucket, { buffer: pngBuf, declaredMimeType: 'image/png', declaredFilename: 'b.png' }, { now });
  assert.equal(okOne.rejected, false);
  assert.equal(okTwo.rejected, false);

  const expiredId = 'MC.EXPIREDEXPIRED0';
  await db.insert(evidenceTable).values({
    evidenceId: expiredId, reportId: null, storagePath: 'evidence_uploads/' + expiredId + '/file.jpg',
    fileType: 'image', mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 10,
    scanStatus: catalog.EVIDENCE_SCAN_STATUS.PENDING_SCAN, uploadedAt: now, linkedAt: null,
    expiresUnlinkedAt: new Date(now.getTime() - 1000), deleted: false
  });
  const alreadyLinkedId = 'MC.ALREADYLINKED000';
  await db.insert(evidenceTable).values({
    evidenceId: alreadyLinkedId, reportId: 'TB.2608.00001', storagePath: 'x', fileType: 'image',
    mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 10, scanStatus: 'pending_scan',
    uploadedAt: now, linkedAt: now, expiresUnlinkedAt: new Date(now.getTime() + 1000), deleted: false
  });

  const linked = await linkEvidenceToReport(
    db,
    { evidenceIds: [(okOne as any).evidenceId, (okTwo as any).evidenceId, expiredId, alreadyLinkedId, 'MC.KHONGTONTAIDAUCA'], reportId: 'TB.2608.00099' },
    { now }
  );
  assert.equal(linked.length, 2);
  assert.ok(linked.includes((okOne as any).evidenceId));
  assert.ok(linked.includes((okTwo as any).evidenceId));

  const [okOneRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, (okOne as any).evidenceId));
  assert.equal(okOneRow!.reportId, 'TB.2608.00099');
  const [expiredRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, expiredId));
  assert.equal(expiredRow!.reportId, null);

  await clearEvidence();
});

test('evidence: purgeOrphanEvidence — chỉ xoá file mồ côi đã hết hạn, KHÔNG đụng file đã liên kết', { skip }, async () => {
  await clearEvidence();
  const bucket = new FakeBucket();
  const now = new Date('2026-08-20T10:00:00+07:00');

  const orphanExpired = 'MC.ORPHANEXPIRED0001';
  await db.insert(evidenceTable).values({
    evidenceId: orphanExpired, reportId: null, storagePath: 'evidence_uploads/' + orphanExpired + '/file.jpg',
    fileType: 'image', mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 10,
    scanStatus: 'pending_scan', uploadedAt: now, linkedAt: null,
    expiresUnlinkedAt: new Date(now.getTime() - 1000), deleted: false
  });
  await bucket.file('evidence_uploads/' + orphanExpired + '/file.jpg').save(Buffer.from('x'), {});

  const orphanFresh = 'MC.ORPHANFRESH000001';
  await db.insert(evidenceTable).values({
    evidenceId: orphanFresh, reportId: null, storagePath: 'evidence_uploads/' + orphanFresh + '/file.jpg',
    fileType: 'image', mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 10,
    scanStatus: 'pending_scan', uploadedAt: now, linkedAt: null,
    expiresUnlinkedAt: new Date(now.getTime() + catalog.EVIDENCE_ORPHAN_TTL_MS), deleted: false
  });
  await bucket.file('evidence_uploads/' + orphanFresh + '/file.jpg').save(Buffer.from('x'), {});

  const linkedButExpiredTtl = 'MC.LINKEDBUTOLD00001';
  await db.insert(evidenceTable).values({
    evidenceId: linkedButExpiredTtl, reportId: 'TB.2608.00050', storagePath: 'evidence_uploads/' + linkedButExpiredTtl + '/file.jpg',
    fileType: 'image', mimeType: 'image/jpeg', extension: 'jpg', sizeBytes: 10,
    scanStatus: 'pending_scan', uploadedAt: now, linkedAt: now,
    expiresUnlinkedAt: new Date(now.getTime() - 999999), deleted: false
  });
  await bucket.file('evidence_uploads/' + linkedButExpiredTtl + '/file.jpg').save(Buffer.from('x'), {});

  const purgedCount = await purgeOrphanEvidence(db, bucket, { now });
  assert.equal(purgedCount, 1);

  const [orphanExpiredRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, orphanExpired));
  assert.equal(orphanExpiredRow!.deleted, true);
  assert.ok(!bucket.store.has('evidence_uploads/' + orphanExpired + '/file.jpg'));

  const [orphanFreshRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, orphanFresh));
  assert.notEqual(orphanFreshRow!.deleted, true);
  assert.ok(bucket.store.has('evidence_uploads/' + orphanFresh + '/file.jpg'));

  const [linkedRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, linkedButExpiredTtl));
  assert.notEqual(linkedRow!.deleted, true);
  assert.ok(bucket.store.has('evidence_uploads/' + linkedButExpiredTtl + '/file.jpg'));

  await clearEvidence();
});

test('evidence: getSignedDownloadUrl — hết hạn 5 phút, ép tải xuống', { skip }, async () => {
  const bucket = new FakeBucket();
  const now = new Date('2026-08-20T10:00:00+07:00');
  const url = await getSignedDownloadUrl(bucket, 'evidence_uploads/x/file.jpg', { now });
  assert.ok(url.includes('disposition=attachment'));
  assert.ok(url.includes('expires=' + (now.getTime() + 5 * 60 * 1000)));
});

test('evidence: canViewEvidence — dùng lại authz 9 bước, đúng action incident.view_evidence', () => {
  const principalActor = { perId: 'PER.00000001', session: { valid: true, revoked: false }, roles: [{ roleId: catalog.ROLE.PRINCIPAL }] };
  const teacherActor = { perId: 'PER.00000002', session: { valid: true, revoked: false }, roles: [{ roleId: catalog.ROLE.TEACHER, campusId: 'CS.01' }] };
  const teacherAssignedActor = { perId: 'PER.00000003', session: { valid: true, revoked: false }, roles: [{ roleId: catalog.ROLE.TEACHER, campusId: 'CS.01' }] };
  const incidentC3 = {
    campus_id: 'CS.01', confidentiality: 'C3', priority: 'P1',
    commander_per_id: null, assigned_task_per_ids: [teacherAssignedActor.perId]
  };
  assert.equal(canViewEvidence(principalActor, incidentC3), true);
  assert.equal(canViewEvidence(teacherActor, incidentC3), false);
  assert.equal(canViewEvidence(teacherAssignedActor, incidentC3), true);
});

test('evidence: quét mã độc thật (S8) — opts.scanBuffer tiêm được, KHÔNG cần mạng thật', { skip }, async () => {
  await clearEvidence();
  const bucket = new FakeBucket();
  const now = new Date('2026-08-21T09:00:00+07:00');
  const jpegBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 255, g: 0, b: 0 } } }).jpeg().toBuffer();
  const pngBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 255, b: 0 } } }).png().toBuffer();
  const webpBuf = await sharp({ create: { width: 4, height: 4, channels: 3, background: { r: 0, g: 0, b: 255 } } }).webp().toBuffer();

  // clean -> CLEAR
  const cleanScan = async () => ({ status: 'clean', detail: 'OK' });
  const rClean = await validateAndStoreEvidence(db, bucket, { buffer: jpegBuf, declaredMimeType: 'image/jpeg', declaredFilename: 'sach.jpg' }, { now, scanBuffer: cleanScan });
  assert.equal(rClean.rejected, false);
  const [cleanRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, (rClean as any).evidenceId));
  assert.equal(cleanRow!.scanStatus, catalog.EVIDENCE_SCAN_STATUS.CLEAR);
  assert.ok(bucket.store.has(cleanRow!.storagePath));

  // infected -> INFECTED, xoá object Storage + audit log
  const infectedScan = async () => ({ status: 'infected', detail: 'Eicar-Test-Signature FOUND' });
  const rInfected = await validateAndStoreEvidence(db, bucket, { buffer: pngBuf, declaredMimeType: 'image/png', declaredFilename: 'nhiem.png' }, { now, scanBuffer: infectedScan });
  assert.equal(rInfected.rejected, false);
  const [infectedRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, (rInfected as any).evidenceId));
  assert.equal(infectedRow!.scanStatus, catalog.EVIDENCE_SCAN_STATUS.INFECTED);
  assert.ok(!bucket.store.has(infectedRow!.storagePath));

  const { auditLogs } = await import('./audit.schema.js');
  const auditRows = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.action, 'evidence.scan_infected_deleted'), eq(auditLogs.objectId, (rInfected as any).evidenceId)));
  assert.equal(auditRows.length, 1);
  assert.equal(auditRows[0]!.objectId, (rInfected as any).evidenceId);

  // scan_error -> giữ nguyên PENDING_SCAN
  const errorScan = async () => ({ status: 'scan_error', detail: 'timeout' });
  const rScanError = await validateAndStoreEvidence(db, bucket, { buffer: webpBuf, declaredMimeType: 'image/webp', declaredFilename: 'loi_quet.webp' }, { now, scanBuffer: errorScan });
  assert.equal(rScanError.rejected, false);
  const [scanErrorRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, (rScanError as any).evidenceId));
  assert.equal(scanErrorRow!.scanStatus, catalog.EVIDENCE_SCAN_STATUS.PENDING_SCAN);

  // scanBuffer throw thẳng -> vẫn KHÔNG throw ra ngoài, vẫn PENDING_SCAN
  const throwingScan = async (): Promise<never> => {
    throw new Error('mạng đứt đột ngột');
  };
  const rThrowScan = await validateAndStoreEvidence(db, bucket, { buffer: mp3Buffer(), declaredMimeType: 'audio/mpeg', declaredFilename: 'am_thanh.mp3' }, { now, scanBuffer: throwingScan });
  assert.equal(rThrowScan.rejected, false);
  const [throwScanRow] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, (rThrowScan as any).evidenceId));
  assert.equal(throwScanRow!.scanStatus, catalog.EVIDENCE_SCAN_STATUS.PENDING_SCAN);

  await clearEvidence();
});

test('evidence: scanBuffer thật — thiếu EVIDENCE_SCANNER_URL trả scan_error, KHÔNG throw', async () => {
  const savedScannerUrl = process.env.EVIDENCE_SCANNER_URL;
  delete process.env.EVIDENCE_SCANNER_URL;
  const noUrlResult = await scanBuffer(Buffer.from('x'));
  assert.equal(noUrlResult.status, 'scan_error');
  if (savedScannerUrl !== undefined) process.env.EVIDENCE_SCANNER_URL = savedScannerUrl;
});
