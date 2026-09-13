/**
 * localEvidenceStorage.ts — kho minh chứng lưu vào ĐĨA CỤC BỘ, thay thế
 * Google Cloud Storage khi project chưa gắn billing thật (xem
 * `EVIDENCE_STORAGE_BUCKET` rỗng trong `.env` — `getEvidenceBucket()` ở
 * `firebase.ts` tự chọn module này). Cài đúng interface tối giản
 * `EvidenceBucket`/`EvidenceFile` (`evidence.ts`) bằng duck-typing —
 * `evidence.ts` KHÔNG cần biết/đổi gì để dùng module này, đúng tinh thần
 * dependency injection đã có sẵn trong code.
 *
 * "URL ký" ở đây KHÔNG phải chữ ký GCS thật — tự ký bằng HMAC-SHA256
 * (khoá `EVIDENCE_SIGN_SECRET`) gắn hạn dùng vào query string, route
 * `GET /api/safety/evidence-file/*` verify lại chữ ký + hạn trước khi
 * stream file từ đĩa. Cùng mức an toàn về nguyên tắc (link tạm thời, hết
 * hạn, không đoán được nếu không có secret) — chỉ khác cơ chế thực thi.
 *
 * LƯU Ý deploy: đĩa cục bộ KHÔNG bền vững nếu chạy trên nền tảng có
 * filesystem tạm thời (VD Cloud Run mặc định) — chỉ dùng tạm cho tới khi
 * project gắn billing thật rồi chuyển `EVIDENCE_STORAGE_BUCKET` sang GCS.
 * Nếu deploy lên VM/máy có đĩa bền vững thì dùng lâu dài được, chỉ cần nhớ
 * backup thư mục `EVIDENCE_LOCAL_DIR`.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import type { EvidenceBucket, EvidenceFile } from '../modules/safety/evidence.js';

const STORAGE_DIR = path.resolve(process.cwd(), 'evidence-storage');

function sign(storagePath: string, expiresAt: number): string {
  return crypto.createHmac('sha256', env.EVIDENCE_SIGN_SECRET).update(`${storagePath}:${expiresAt}`).digest('hex');
}

export function verifyEvidenceToken(storagePath: string, expiresAt: number, token: string): boolean {
  if (Date.now() > expiresAt) return false;
  const expected = sign(storagePath, expiresAt);
  // So sánh độ dài cố định — chống timing attack, cùng chuẩn dùng ở
  // authz.ts/webhook verify khác trong dự án.
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function resolveSafePath(storagePath: string): string {
  const full = path.resolve(STORAGE_DIR, storagePath);
  if (!full.startsWith(STORAGE_DIR + path.sep)) {
    throw new Error('storagePath không hợp lệ (path traversal).');
  }
  return full;
}

class LocalEvidenceFile implements EvidenceFile {
  constructor(private readonly storagePath: string) {}

  async save(buffer: Buffer, _opts: { contentType: string; resumable: boolean }): Promise<unknown> {
    const full = resolveSafePath(this.storagePath);
    await fs.promises.mkdir(path.dirname(full), { recursive: true });
    await fs.promises.writeFile(full, buffer);
    return undefined;
  }

  async delete(): Promise<unknown> {
    const full = resolveSafePath(this.storagePath);
    await fs.promises.unlink(full).catch(() => {});
    return undefined;
  }

  async getSignedUrl(opts: { action: 'read'; expires: number; responseDisposition: string }): Promise<[string]> {
    const expiresAt = opts.expires;
    const token = sign(this.storagePath, expiresAt);
    const base = env.API_BASE_URL.replace(/\/+$/, '');
    const qs = new URLSearchParams({ path: this.storagePath, expires: String(expiresAt), token }).toString();
    return [`${base}/api/safety/evidence-file?${qs}`];
  }
}

export function getLocalEvidenceBucket(): EvidenceBucket {
  return {
    file(storagePath: string) {
      return new LocalEvidenceFile(storagePath);
    }
  };
}

export function readEvidenceFileFromDisk(storagePath: string): Buffer {
  return fs.readFileSync(resolveSafePath(storagePath));
}

export function evidenceFileExistsOnDisk(storagePath: string): boolean {
  try {
    return fs.statSync(resolveSafePath(storagePath)).isFile();
  } catch {
    return false;
  }
}
