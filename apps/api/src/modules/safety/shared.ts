/**
 * shared.ts — tiện ích dùng CHUNG cho cả 2 cụm hàm của `safety.js` (Luồng
 * 2-3 report/incident + state machine hồ sơ đã tạo). Port 1-1 từ phần đầu
 * `safety.js` (AppError, toJsDate, parseOptionalDate, withIdempotency,
 * admin_arrayUnion).
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { idempotencyKeys } from './idempotency.schema.js';

export type Db = NodePgDatabase<Record<string, never>>;

export class AppError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Đọc lại timestamp — giữ tương thích input dạng Firestore Timestamp `{ toDate() }` nếu có nơi nào còn truyền kiểu đó. */
export function toJsDate(v: Date | { toDate: () => Date } | string | number): Date {
  if (v instanceof Date) return v;
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate: () => Date }).toDate();
  return new Date(v as string | number);
}

/** Parse mốc thời gian tuỳ chọn — null nếu không truyền, throw invalid_input nếu có truyền nhưng không hợp lệ. */
export function parseOptionalDate(value: unknown, fieldName: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value as string);
  if (Number.isNaN(d.getTime())) {
    throw new AppError('invalid_input', `Giá trị ${fieldName} không hợp lệ.`);
  }
  return d;
}

/**
 * Chống gửi lặp (mục VII.1) — khoá tối thiểu 24 giờ, lời gọi lặp trả đúng
 * kết quả lần đầu, KHÔNG tạo bản ghi thứ hai.
 */
export async function withIdempotency<T>(db: Db, idempotencyKey: string | undefined | null, fn: () => Promise<T>): Promise<T> {
  if (!idempotencyKey) {
    // Không có khóa vẫn cho chạy (VD gọi nội bộ/test), nơi gọi HTTP thật
    // luôn phải truyền X-Idempotency-Key.
    return fn();
  }
  const [existing] = await db.select().from(idempotencyKeys).where(eq(idempotencyKeys.key, idempotencyKey)).limit(1);
  if (existing) {
    return existing.result as T;
  }
  const result = await fn();
  await db.insert(idempotencyKeys).values({ key: idempotencyKey, result: result as object }).onConflictDoNothing();
  return result;
}

/** Thêm 1 giá trị vào mảng nếu chưa có — giữ nguyên thứ tự, không tạo bản sao. */
export function adminArrayUnion<T>(existing: T[] | null | undefined, value: T): T[] {
  const arr = Array.isArray(existing) ? [...existing] : [];
  if (!arr.includes(value)) arr.push(value);
  return arr;
}
