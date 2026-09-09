/**
 * ids.ts — Cấp phát mã định danh (S3), port từ `ids.js` (project An toàn,
 * Firebase) — GIỮ NGUYÊN quy tắc bắt buộc từ tài liệu gốc:
 *  - Mã do "dịch vụ trung tâm" cấp, bất biến, KHÔNG tái sử dụng kể cả khi
 *    bản ghi bị hủy.
 *  - Mã công khai (GV) và mã minh chứng (MC) NGẪU NHIÊN, không đoán được,
 *    KHÔNG dùng dạng tuần tự như mã nội bộ.
 *  - Mã công khai và mã nội bộ là hai không gian mã TÁCH BIỆT.
 *
 * ĐÃ ĐỔI so với bản gốc — BỎ HẲN cơ chế chia 20 mảnh (sharded counter):
 * lý do NUM_SHARDS=20 ở bản Firestore là vá lỗi nghẽn ghi vì Firestore chỉ
 * chịu được ~1 ghi/giây BỀN VỮNG cho 1 document. Postgres không có giới
 * hạn tương đương — 1 dòng UPSERT nguyên tử (`INSERT ... ON CONFLICT ...
 * DO UPDATE ... RETURNING`) xử lý được hàng trăm/giây trên ĐÚNG 1 dòng mà
 * không cần chia mảnh. Bỏ sharding còn LẤY LẠI được tính chất bản Firestore
 * đã phải đánh đổi: mã tuần tự lại đúng thứ tự thời gian thật trong cùng 1
 * kỳ (không còn 2 tin báo cách nhau vài giây rơi vào 2 "mảnh" khác số).
 * Vẫn giữ đúng 2 yêu cầu bắt buộc: DUY NHẤT tuyệt đối và KHÔNG BAO GIỜ tái
 * sử dụng (giá trị bộ đếm chỉ tăng).
 *
 * `db` truyền vào (dependency injection) — module không tự tạo kết nối.
 */

import crypto from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { ID_PREFIX } from './catalog.js';
import { toVnParts } from './vntime.js';
import { idCounters, publicCodes } from './ids.schema.js';

const RANDOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm (I,O,0,1)

export function randomToken(length: number): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += RANDOM_ALPHABET[(bytes[i] ?? 0) % RANDOM_ALPHABET.length];
  }
  return out;
}

export function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Kỳ tính theo NGÀY VIỆT NAM (không phụ thuộc múi giờ máy chủ) — SC/TB/NV đánh số lại theo tháng. */
export function yymm(date?: Date): string {
  const p = toVnParts(date ?? new Date());
  return pad(p.year % 100, 2) + pad(p.month + 1, 2);
}

export const SEQUENTIAL_SPEC: Record<string, { width: number }> = {
  [ID_PREFIX.REPORT]: { width: 5 }, // TB.{YYMM}.{5 số}
  [ID_PREFIX.INCIDENT]: { width: 4 }, // SC.{YYMM}.{4 số}
  [ID_PREFIX.TASK]: { width: 5 } // NV.{YYMM}.{5 số}
};

export const RANDOM_SPEC = {
  [ID_PREFIX.EVIDENCE]: { length: 16 }, // MC.{16 ký tự}
  [ID_PREFIX.PUBLIC_CODE]: { groups: [4, 4] } // GV-{4}-{4}
};

/**
 * Cấp mã tuần tự bằng UPSERT nguyên tử — an toàn dưới tải cao mà không cần
 * chia mảnh (xem giải thích đầu file). `opts.now` chỉ để test (cố định thời
 * điểm thay vì `new Date()` thật).
 */
export async function allocateSequentialId(
  db: NodePgDatabase<Record<string, never>>,
  prefix: string,
  opts?: { now?: Date; period?: string }
): Promise<string> {
  const spec = SEQUENTIAL_SPEC[prefix];
  if (!spec) throw new Error('Loại mã không dùng bộ đếm tuần tự: ' + prefix);
  const period = opts?.period ?? yymm(opts?.now);

  const [row] = await db
    .insert(idCounters)
    .values({ prefix, period, value: 1, updatedAt: opts?.now ?? new Date() })
    .onConflictDoUpdate({
      target: [idCounters.prefix, idCounters.period],
      set: { value: sql`${idCounters.value} + 1`, updatedAt: opts?.now ?? new Date() }
    })
    .returning({ value: idCounters.value });

  if (!row) throw new Error('Không cấp được mã tuần tự (UPSERT không trả về dòng nào) cho ' + prefix + '.' + period);
  const maxValue = 10 ** spec.width - 1;
  if (row.value > maxValue) {
    throw new Error(`id_counters: ${prefix}.${period} đã đạt giới hạn ${maxValue} — cần tăng độ rộng số (width).`);
  }
  return prefix + '.' + period + '.' + pad(row.value, spec.width);
}

/** Cấp mã ngẫu nhiên (MC minh chứng), không tuần tự, không đoán được. */
export function allocateRandomEvidenceId(): string {
  return ID_PREFIX.EVIDENCE + '.' + randomToken(RANDOM_SPEC[ID_PREFIX.EVIDENCE].length);
}

/**
 * Cấp mã tiếp nhận công khai GV-XXXX-XXXX. Kiểm tra trùng trước khi trả về
 * (xác suất trùng rất thấp nhưng vẫn phải kiểm tra — không gian mã người
 * ngoài dùng để tra cứu).
 */
export async function allocatePublicCode(
  db: NodePgDatabase<Record<string, never>> | null,
  opts?: { maxTries?: number }
): Promise<string> {
  const maxTries = opts?.maxTries ?? 5;
  for (let i = 0; i < maxTries; i++) {
    const groups = RANDOM_SPEC[ID_PREFIX.PUBLIC_CODE].groups.map((g) => randomToken(g));
    const code = ID_PREFIX.PUBLIC_CODE + '-' + groups.join('-');
    if (!db) return code; // cho phép gọi không cần db khi test thuần logic sinh mã
    const [existing] = await db.select().from(publicCodes).where(eq(publicCodes.code, code)).limit(1);
    if (!existing) return code;
  }
  throw new Error(`Không cấp được mã tiếp nhận công khai sau ${maxTries} lần thử (trùng liên tiếp) — kiểm tra lại nguồn ngẫu nhiên.`);
}

export function allocatePersonId(seqNumber: number): string {
  return ID_PREFIX.PERSON + '.' + pad(seqNumber, 8);
}
