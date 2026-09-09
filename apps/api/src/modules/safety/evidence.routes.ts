/**
 * evidence.routes.ts — CỔNG CÔNG KHAI (KHÔNG yêu cầu đăng nhập, giống
 * `submitReport` — người báo tin có thể ẩn danh), port từ
 * `exports.uploadEvidence` (`index.js`). 1 file/request — client tự gọi
 * lặp lại cho từng file (luồng 2 bước đã chốt: (1) upload từng file lấy
 * evidenceId, (2) truyền evidenceIds vào submitReport để liên kết).
 *
 * Parse multipart/form-data bằng `busboy`, KHÔNG bao giờ tin Content-Type/
 * tên file client khai — `evidence.validateAndStoreEvidence` tự kiểm tra
 * lại bằng magic bytes trước khi ghi Storage thật.
 *
 * KHÁC bản gốc 1 chỗ, THEO Ý — bản gốc Firestore chạy quét mã độc BẤT ĐỒNG
 * BỘ qua Cloud Storage trigger (`onObjectFinalized`) riêng, để không giữ
 * request chờ ClamAV nạp lại DB mỗi lần. Trigger kiểu đó không có tương
 * đương trong Express (không phải serverless function nền tảng), và chưa
 * ai được giao xây dựng cơ chế hàng đợi/worker thay thế — nên ở đây gọi
 * `validateAndStoreEvidence` KHÔNG truyền `deferScan`, để quét chạy ĐỒNG
 * BỘ ngay trong request (giữ đúng hành vi AN TOÀN — file vẫn ở
 * `pending_scan` cho tới khi quét xong — chỉ khác THỜI ĐIỂM người dùng
 * phải chờ, không đổi gì về logic an toàn). Nếu sau này cần tách quét ra
 * nền cho nhanh, phải xây cơ chế hàng đợi riêng trước khi đổi `deferScan`.
 */

import { Router } from 'express';
import type { Request } from 'express';
import Busboy from 'busboy';
import { EVIDENCE_LIMITS } from './catalog.js';
import { validateAndStoreEvidence, type EvidenceBucket } from './evidence.js';
import { db } from '../../core/db/client.js';
import { getEvidenceBucket } from '../../core/firebase.js';

export const evidenceRouter = Router();

const MAX_BYTES_ACROSS_TYPES = Math.max(
  EVIDENCE_LIMITS.MAX_SIZE_BYTES.image,
  EVIDENCE_LIMITS.MAX_SIZE_BYTES.audio,
  EVIDENCE_LIMITS.MAX_SIZE_BYTES.video
);

/**
 * Đọc đúng 1 file từ multipart request — port logic busboy 1-1 từ bản gốc
 * (buffer trong bộ nhớ, không ghi tạm ra đĩa). Export để test trực tiếp
 * bằng HTTP request thật KHÔNG cần bucket Storage thật (phần
 * `validateAndStoreEvidence` phía sau đã có test riêng ở `evidence.test.ts`).
 */
export function readSingleFile(req: Request): Promise<{ rejected: true; reason: string } | { rejected: false; buffer: Buffer; mimeType?: string; filename?: string }> {
  return new Promise((resolve) => {
    let busboy: ReturnType<typeof Busboy>;
    try {
      busboy = Busboy({ headers: req.headers, limits: { files: 1, fileSize: MAX_BYTES_ACROSS_TYPES } });
    } catch {
      resolve({ rejected: true, reason: 'invalid_multipart_request' });
      return;
    }

    let handled = false;
    let fileInfo: { filename?: string; mimeType?: string } | null = null;
    let truncated = false;
    const chunks: Buffer[] = [];

    function finish(result: { rejected: true; reason: string } | { rejected: false; buffer: Buffer; mimeType?: string; filename?: string }) {
      if (handled) return;
      handled = true;
      resolve(result);
    }

    busboy.on('file', (_fieldname, file, info) => {
      fileInfo = info;
      file.on('data', (data: Buffer) => chunks.push(data));
      file.on('limit', () => {
        truncated = true;
      });
    });

    busboy.on('error', () => {
      finish({ rejected: true, reason: 'invalid_input' });
    });

    busboy.on('finish', () => {
      if (handled) return;
      if (!fileInfo) {
        finish({ rejected: true, reason: 'no_file' });
        return;
      }
      if (truncated) {
        // Vượt ngưỡng lớn nhất trong 3 loại — chắc chắn vượt luôn ngưỡng
        // đúng loại của nó, từ chối ngay không cần đọc/validate thêm.
        finish({ rejected: true, reason: 'file_too_large' });
        return;
      }
      finish({ rejected: false, buffer: Buffer.concat(chunks), mimeType: fileInfo.mimeType, filename: fileInfo.filename });
    });

    req.pipe(busboy);
  });
}

// Port từ `exports.uploadEvidence`. Bản gốc chặn bằng Firebase App Check
// HOẶC Auth token — không có tương đương App Check ở đây, mở public hoàn
// toàn (khớp đúng ý nghĩa "cổng công khai, người báo tin có thể ẩn danh").
evidenceRouter.post('/evidence/upload', async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }
  const read = await readSingleFile(req);
  if (read.rejected) {
    res.status(read.reason === 'invalid_multipart_request' || read.reason === 'invalid_input' ? 400 : 200).json({ rejected: true, reason: read.reason });
    return;
  }
  try {
    const bucket: EvidenceBucket = getEvidenceBucket();
    const result = await validateAndStoreEvidence(
      db,
      bucket,
      { buffer: read.buffer, declaredMimeType: read.mimeType, declaredFilename: read.filename },
      { now: new Date() }
    );
    res.status(200).json(result);
  } catch (e) {
    console.error('uploadEvidence lỗi:', e);
    res.status(500).json({ error: 'internal', message: 'Có lỗi hệ thống, thử lại sau.' });
  }
});
