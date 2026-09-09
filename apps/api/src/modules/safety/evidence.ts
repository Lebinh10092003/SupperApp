/**
 * evidence.ts — Kho minh chứng (S8 MVP), port 1-1 từ `evidence.js` (project
 * An toàn, Firebase). Vùng cách ly mô phỏng: mọi file qua allowlist magic-
 * byte chỉ được gắn nhãn 'pending_scan' — KHÔNG có 'clear' tự động chừng
 * nào chưa quét ClamAV thật xong.
 *
 * Kiến trúc giữ NGUYÊN so với bản gốc: upload đi qua Cloud Function/route
 * proxy — client KHÔNG BAO GIỜ ghi thẳng Storage. Module nhận CẢ `db`
 * (Postgres, tham số đầu) VÀ `bucket` (Cloud Storage, tham số 2) làm
 * dependency injection — không tự tạo bucket bên trong file này (tầng
 * route sẽ truyền `getStorage().bucket()` thật từ `firebase-admin/storage`,
 * project vẫn dùng chung Storage/Auth với App Cảnh báo an toàn cũ).
 *
 * Chống lộ danh tính (bắt buộc, không tuỳ chọn — người báo tin có thể ẩn
 * danh):
 *  - KHÔNG bao giờ dùng UID/IP/session id trong storage_path/tên file.
 *  - KHÔNG lưu tên file gốc người dùng chọn (không có cột original_filename).
 *  - Ảnh: strip EXIF/metadata (đặc biệt GPS) bằng sharp trước khi ghi.
 *  - Audio/video: MVP CHƯA strip metadata (cần ffmpeg, chưa có trong stack)
 *    — giữ nguyên giới hạn của bản gốc.
 *  - KHÔNG log IP/user-agent vào bảng nghiệp vụ nào ở đây.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/evidence.js
 */

import sharp from 'sharp';
import { eq, isNull } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as catalog from './catalog.js';
import { allocateRandomEvidenceId } from './ids.js';
import { checkAuthorization, type Actor } from './authz.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import { evidence as evidenceTable } from './evidence.schema.js';
import { AppError } from './shared.js';

type Db = NodePgDatabase<Record<string, never>>;

/**
 * Bucket tối giản — chỉ đúng 3 phương thức module này dùng tới (duck-typing
 * có chủ đích, giống cách `db` được tiêm ở mọi module khác trong dự án) —
 * KHÔNG phụ thuộc trực tiếp kiểu `Bucket` của `@google-cloud/storage` (chỉ
 * là dependency bắc cầu qua `firebase-admin`, chưa khai báo trực tiếp trong
 * package.json) để tránh phụ thuộc ngầm không kiểm soát được.
 */
export interface EvidenceFile {
  save(buffer: Buffer, opts: { contentType: string; resumable: boolean }): Promise<unknown>;
  delete(): Promise<unknown>;
  getSignedUrl(opts: { action: 'read'; expires: number; responseDisposition: string }): Promise<[string]>;
}
export interface EvidenceBucket {
  file(path: string): EvidenceFile;
}

// AppError dùng CHUNG (shared.ts) — trước đây tự định nghĩa riêng ở đây
// nhưng KHÔNG hàm nào trong file này thực sự throw nó (dead code); gộp
// lại cho nhất quán với zoneStats.ts/classStats.ts (cùng lớp lỗi đã gây
// bug instanceof thật ở đó khi route check theo bản shared.ts).
export { AppError };

// ---------------------------------------------------------------------------
// Nhận diện định dạng thật từ magic bytes — KHÔNG bao giờ tin content-type/
// đuôi file client khai trước khi kiểm tra xong bước này.
// ---------------------------------------------------------------------------
export function detectFormat(buffer: Buffer | null | undefined): string | null {
  if (!buffer || buffer.length < 3) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';

  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png';

  if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF') {
    const sub = buffer.subarray(8, 12).toString('ascii');
    if (sub === 'WEBP') return 'webp';
    if (sub === 'WAVE') return 'wav';
  }

  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'mp3';
  if (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] === 0xfb || buffer[1] === 0xfa)) return 'mp3';

  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'webm';

  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (brand === 'M4A ') return 'm4a_ftyp';
    return 'mp4_ftyp';
  }

  return null;
}

interface ExtensionSpec {
  format: string;
  fileType: (typeof catalog.EVIDENCE_FILE_TYPE)[keyof typeof catalog.EVIDENCE_FILE_TYPE];
  mime: string;
}

// Đúng bảng mục 3 spec — mọi giá trị lấy từ catalog.ts, KHÔNG lặp lại hằng số ở đây.
export const EXTENSION_TABLE: Record<string, ExtensionSpec> = {
  jpg: { format: 'jpeg', fileType: catalog.EVIDENCE_FILE_TYPE.IMAGE, mime: 'image/jpeg' },
  jpeg: { format: 'jpeg', fileType: catalog.EVIDENCE_FILE_TYPE.IMAGE, mime: 'image/jpeg' },
  png: { format: 'png', fileType: catalog.EVIDENCE_FILE_TYPE.IMAGE, mime: 'image/png' },
  webp: { format: 'webp', fileType: catalog.EVIDENCE_FILE_TYPE.IMAGE, mime: 'image/webp' },
  mp3: { format: 'mp3', fileType: catalog.EVIDENCE_FILE_TYPE.AUDIO, mime: 'audio/mpeg' },
  m4a: { format: 'm4a_ftyp', fileType: catalog.EVIDENCE_FILE_TYPE.AUDIO, mime: 'audio/mp4' },
  wav: { format: 'wav', fileType: catalog.EVIDENCE_FILE_TYPE.AUDIO, mime: 'audio/wav' },
  mp4: { format: 'mp4_ftyp', fileType: catalog.EVIDENCE_FILE_TYPE.VIDEO, mime: 'video/mp4' },
  mov: { format: 'mp4_ftyp', fileType: catalog.EVIDENCE_FILE_TYPE.VIDEO, mime: 'video/quicktime' },
  webm: { format: 'webm', fileType: catalog.EVIDENCE_FILE_TYPE.VIDEO, mime: 'video/webm' }
};

export function extractExtension(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = String(filename).split(/[?#]/)[0] ?? '';
  const idx = base.lastIndexOf('.');
  if (idx === -1 || idx === base.length - 1) return null;
  return base.slice(idx + 1).toLowerCase();
}

function toJsDate(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  return new Date(v as string);
}

// Timeout gọi service quét (ms) — có margin cho cold start container.
const SCAN_TIMEOUT_MS = 90 * 1000;

export interface ScanResult {
  status: string;
  detail?: string;
}
export type ScanBufferFn = (buffer: Buffer, opts?: ScanOpts) => Promise<ScanResult>;

/**
 * scanBuffer — gọi Cloud Run service `evidence-scanner` (ClamAV thật, tự
 * host) để quét 1 buffer file nhị phân. URL lấy từ `EVIDENCE_SCANNER_URL`.
 * Dùng `google-auth-library` để tự lấy ID token đúng audience = URL service
 * (Cloud Run deploy `--no-allow-unauthenticated`).
 *
 * KHÔNG BAO GIỜ throw ra ngoài — mọi lỗi trả về { status: 'scan_error' }.
 */
export const scanBuffer: ScanBufferFn = async (buffer, opts) => {
  const scannerUrl = opts?.scannerUrl || process.env.EVIDENCE_SCANNER_URL;
  if (!scannerUrl) {
    return { status: 'scan_error', detail: 'EVIDENCE_SCANNER_URL chưa được cấu hình.' };
  }
  try {
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth();
    const client = await auth.getIdTokenClient(scannerUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    let res;
    try {
      res = await client.request<{ status?: string; detail?: string }>({
        url: scannerUrl.replace(/\/$/, '') + '/scan',
        method: 'POST',
        data: buffer,
        headers: { 'Content-Type': 'application/octet-stream' },
        signal: controller.signal as any,
        responseType: 'json'
      });
    } finally {
      clearTimeout(timer);
    }
    const body = res?.data;
    if (!body || typeof body.status !== 'string') {
      return { status: 'scan_error', detail: 'Phản hồi không hợp lệ từ dịch vụ quét.' };
    }
    return { status: body.status, detail: body.detail };
  } catch (e) {
    return { status: 'scan_error', detail: 'Gọi dịch vụ quét thất bại: ' + (e instanceof Error ? e.message : String(e)) };
  }
};

interface ScanOpts {
  scannerUrl?: string;
  now?: Date;
  scanBuffer?: ScanBufferFn;
  deferScan?: boolean;
}

export interface ValidateAndStoreInput {
  buffer: Buffer;
  declaredMimeType?: string | null;
  declaredFilename?: string | null;
}

export type ValidateAndStoreResult =
  | { rejected: true; reason: string }
  | { rejected: false; evidenceId: string; fileType: string; sizeBytes: number };

/**
 * validateAndStoreEvidence — kiểm tra magic bytes, strip EXIF (ảnh), ghi
 * Storage + tạo dòng `evidence`. KHÔNG throw khi file không hợp lệ — trả
 * `{ rejected: true, reason }` để tầng route trả HTTP 200 kèm trạng thái rõ
 * ràng cho từng file, thay vì lỗi 500 hàng loạt.
 */
export async function validateAndStoreEvidence(
  db: Db,
  bucket: EvidenceBucket,
  input: ValidateAndStoreInput,
  opts?: ScanOpts
): Promise<ValidateAndStoreResult> {
  const now = opts?.now || new Date();
  const { buffer, declaredMimeType, declaredFilename } = input;

  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return { rejected: true, reason: 'empty_or_invalid_buffer' };
  }

  const extension = extractExtension(declaredFilename);
  if (!extension || !EXTENSION_TABLE[extension]) {
    return { rejected: true, reason: 'unsupported_extension' };
  }
  const spec = EXTENSION_TABLE[extension];

  const detected = detectFormat(buffer);
  if (!detected) {
    return { rejected: true, reason: 'unrecognized_file_signature' };
  }
  if (detected !== spec.format) {
    return { rejected: true, reason: 'extension_signature_mismatch' };
  }
  if (declaredMimeType && String(declaredMimeType).split('/')[0] !== spec.fileType) {
    return { rejected: true, reason: 'declared_mime_type_mismatch' };
  }

  const maxSize = catalog.EVIDENCE_LIMITS.MAX_SIZE_BYTES[spec.fileType];
  if (buffer.length > maxSize) {
    return { rejected: true, reason: 'file_too_large' };
  }

  let finalBuffer = buffer;
  if (spec.fileType === catalog.EVIDENCE_FILE_TYPE.IMAGE) {
    try {
      // sharp() KHÔNG giữ lại EXIF/metadata theo mặc định (chỉ giữ khi gọi
      // .withMetadata(), CỐ Ý không gọi) — .rotate() không tham số tự áp
      // orientation từ EXIF trước khi metadata bị bỏ đi.
      finalBuffer = await sharp(buffer).rotate().toBuffer();
    } catch {
      return { rejected: true, reason: 'image_processing_failed' };
    }
  }

  const evidenceId = allocateRandomEvidenceId();
  const storagePath = 'evidence_uploads/' + evidenceId + '/file.' + extension;

  await bucket.file(storagePath).save(finalBuffer, { contentType: spec.mime, resumable: false });

  const expiresUnlinkedAt = new Date(now.getTime() + catalog.EVIDENCE_ORPHAN_TTL_MS);
  await db.insert(evidenceTable).values({
    evidenceId,
    reportId: null,
    storagePath,
    fileType: spec.fileType,
    mimeType: spec.mime,
    extension,
    sizeBytes: finalBuffer.length,
    scanStatus: catalog.EVIDENCE_SCAN_STATUS.PENDING_SCAN,
    uploadedAt: now,
    linkedAt: null,
    expiresUnlinkedAt,
    deleted: false
  });

  // Quét mã độc — mặc định ĐỒNG BỘ ngay trong request này (giữ nguyên hành
  // vi cũ). Truyền opts.deferScan = true để bỏ qua bước này (dùng cho
  // production thật — việc quét thật chuyển sang Cloud Storage trigger
  // riêng, chạy SAU khi request đã trả lời xong).
  if (!opts?.deferScan) {
    await applyScanAndUpdate(db, bucket, { evidenceId, storagePath, buffer: finalBuffer }, { ...opts, now });
  }

  return { rejected: false, evidenceId, fileType: spec.fileType, sizeBytes: finalBuffer.length };
}

/**
 * applyScanAndUpdate — quét 1 buffer đã lưu ở `storagePath` rồi cập nhật
 * `scan_status` của đúng dòng `evidence` tương ứng. Dùng lại được ở CẢ 2
 * nơi: đường đồng bộ cũ VÀ Cloud Storage trigger mới (khi được nối dây).
 */
export async function applyScanAndUpdate(
  db: Db,
  bucket: EvidenceBucket,
  params: { evidenceId: string; storagePath: string; buffer: Buffer },
  opts?: ScanOpts
): Promise<ScanResult> {
  const now = opts?.now || new Date();
  const doScan = opts?.scanBuffer || scanBuffer;
  let scanResult: ScanResult;
  try {
    scanResult = await doScan(params.buffer, opts);
  } catch (e) {
    // Phòng hờ thêm — scanBuffer thật đã tự bắt lỗi bên trong và không
    // throw, nhưng hàm tiêm qua opts.scanBuffer (test) có thể throw.
    scanResult = { status: 'scan_error', detail: 'scanBuffer throw: ' + (e instanceof Error ? e.message : String(e)) };
  }

  if (scanResult.status === 'clean') {
    await db.update(evidenceTable).set({ scanStatus: catalog.EVIDENCE_SCAN_STATUS.CLEAR }).where(eq(evidenceTable.evidenceId, params.evidenceId));
  } else if (scanResult.status === 'infected') {
    try {
      await bucket.file(params.storagePath).delete();
    } catch (e) {
      console.warn('[evidence.applyScanAndUpdate] không xoá được object Storage bị nhiễm mã độc (vẫn đánh dấu INFECTED để không cho tải xuống):', params.storagePath, e instanceof Error ? e.message : e);
    }
    await db.update(evidenceTable).set({ scanStatus: catalog.EVIDENCE_SCAN_STATUS.INFECTED }).where(eq(evidenceTable.evidenceId, params.evidenceId));
    await writeAuditLog(
      db,
      buildAuditRecord({
        actorPerId: 'SYSTEM.EVIDENCE_SCANNER',
        action: 'evidence.scan_infected_deleted',
        objectId: params.evidenceId,
        after: { storage_path: params.storagePath, scan_detail: scanResult.detail || null },
        now
      })
    );
  } else {
    // scan_error hoặc giá trị lạ khác — GIỮ NGUYÊN pending_scan, chưa có cơ
    // chế retry tự động ở bước này.
    console.warn('[evidence.applyScanAndUpdate] quét mã độc không trả kết quả clean/infected, giữ nguyên pending_scan:', params.evidenceId, scanResult.status, scanResult.detail);
  }
  return scanResult;
}

/**
 * linkEvidenceToReport — liên kết các evidenceId hợp lệ (tồn tại, chưa liên
 * kết, chưa xoá, còn hạn) vào reportId vừa tạo. 1 evidenceId không hợp lệ
 * bị BỎ QUA lặng lẽ (không throw, không chặn submitReport).
 */
export async function linkEvidenceToReport(
  db: Db,
  params: { evidenceIds?: (string | null | undefined)[]; reportId: string },
  opts?: { now?: Date }
): Promise<string[]> {
  const now = opts?.now || new Date();
  const candidateIds = Array.isArray(params.evidenceIds) ? params.evidenceIds.slice(0, catalog.EVIDENCE_LIMITS.MAX_FILES_PER_SUBMISSION) : [];

  const linked: string[] = [];
  for (const evidenceId of candidateIds) {
    if (!evidenceId) continue;
    const [row] = await db.select().from(evidenceTable).where(eq(evidenceTable.evidenceId, evidenceId)).limit(1);
    if (!row) continue;
    if (row.deleted === true) continue;
    if (row.reportId !== null && row.reportId !== undefined) continue; // đã liên kết
    const expiresAt = toJsDate(row.expiresUnlinkedAt);
    if (expiresAt && expiresAt.getTime() < now.getTime()) continue; // đã hết hạn (mồ côi quá 2 giờ)

    await db.update(evidenceTable).set({ reportId: params.reportId, linkedAt: now }).where(eq(evidenceTable.evidenceId, evidenceId));
    linked.push(evidenceId);
  }
  return linked;
}

/**
 * purgeOrphanEvidence — quét evidence chưa liên kết (report_id NULL), chưa
 * xoá, đã quá hạn expires_unlinked_at -> xoá object Storage thật + đánh dấu
 * deleted: true. KHÔNG BAO GIỜ đụng tới evidence đã liên kết dù đã quá hạn
 * TTL orphan (TTL chỉ áp cho file mồ côi).
 */
export async function purgeOrphanEvidence(db: Db, bucket: EvidenceBucket, opts?: { now?: Date }): Promise<number> {
  const now = opts?.now || new Date();
  const rows = await db.select().from(evidenceTable).where(isNull(evidenceTable.reportId));
  let purged = 0;
  for (const row of rows) {
    if (row.deleted === true) continue;
    const expiresAt = toJsDate(row.expiresUnlinkedAt);
    if (!expiresAt || expiresAt.getTime() > now.getTime()) continue;

    try {
      await bucket.file(row.storagePath).delete();
    } catch (e) {
      console.warn('[evidence.purgeOrphanEvidence] không xoá được object Storage (vẫn đánh dấu deleted để không xử lý lại):', row.storagePath, e instanceof Error ? e.message : e);
    }
    await db.update(evidenceTable).set({ deleted: true }).where(eq(evidenceTable.evidenceId, row.evidenceId));
    purged += 1;
  }
  return purged;
}

/**
 * getSignedDownloadUrl — URL ký hết hạn sau 5 phút, ép tải xuống
 * (Content-Disposition: attachment), KHÔNG render inline.
 */
export async function getSignedDownloadUrl(bucket: EvidenceBucket, storagePath: string, opts?: { now?: Date }): Promise<string> {
  const nowMs = opts?.now ? opts.now.getTime() : Date.now();
  const [url] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: nowMs + 5 * 60 * 1000,
    responseDisposition: 'attachment'
  });
  return url;
}

export interface EvidenceIncidentView {
  campus_id?: string | null;
  confidentiality?: string;
  commander_per_id?: string | null;
  assigned_task_per_ids?: string[];
}

/**
 * canViewEvidence — quyền xem/tải minh chứng dùng chung cho tầng route
 * (field `can_view_evidence`). Hồ sơ bị "redacted" (trần bí mật thấp hơn
 * mức hồ sơ) KHÔNG được coi là đủ quyền xem minh chứng, dù
 * checkAuthorization trả allowed:true cho bản ghi rút gọn.
 */
export function canViewEvidence(actor: Actor, resourceIncident?: EvidenceIncidentView | null): boolean {
  const incident = resourceIncident || {};
  const decision = checkAuthorization({
    actor,
    action: 'incident.view_evidence',
    resource: {
      campusId: incident.campus_id,
      confidentiality: incident.confidentiality,
      commanderPerId: incident.commander_per_id ?? undefined,
      assignedTaskPerIds: incident.assigned_task_per_ids || []
    }
  });
  return decision.allowed && decision.conditions.indexOf('redacted') === -1;
}
