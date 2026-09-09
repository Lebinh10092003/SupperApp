/**
 * push-notify.ts — Đăng ký/tra cứu token thông báo đẩy trình duyệt, port
 * 1-1 từ `pushNotify.js`. Kênh "push" là kênh THẬT MIỄN PHÍ duy nhất hiện
 * có đánh thức được màn hình khi app đang đóng.
 *
 * 1 người có thể đăng ký NHIỀU token (nhiều thiết bị) — dùng token làm
 * khoá để lần đăng ký sau trên CÙNG thiết bị tự ghi đè, không tạo bản
 * trùng.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '../../core/http.js';
import { pushTokens } from './dispatch.schema.js';

export async function registerPushToken(
  db: NodePgDatabase<Record<string, never>>,
  input: { perId: string; token: string; userAgent?: string | null },
  opts?: { now?: Date }
): Promise<{ ok: true }> {
  if (!input.perId) throw new HttpError(400, 'Thiếu perId.', 'invalid_input');
  if (!input.token) throw new HttpError(400, 'Thiếu token.', 'invalid_input');
  await db
    .insert(pushTokens)
    .values({ token: input.token, perId: input.perId, userAgent: input.userAgent ?? null, updatedAt: opts?.now ?? new Date() })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { perId: input.perId, userAgent: input.userAgent ?? null, updatedAt: opts?.now ?? new Date() }
    });
  return { ok: true };
}

export async function unregisterPushToken(db: NodePgDatabase<Record<string, never>>, input: { token: string }): Promise<{ ok: true }> {
  if (!input.token) throw new HttpError(400, 'Thiếu token.', 'invalid_input');
  await db.delete(pushTokens).where(eq(pushTokens.token, input.token));
  return { ok: true };
}

/** Tra TOÀN BỘ token đang có của một danh sách perId — map perId -> [token, ...] (rỗng nếu chưa từng bật). */
export async function resolvePushTokens(db: NodePgDatabase<Record<string, never>>, perIds: string[]): Promise<Record<string, string[]>> {
  const uniquePerIds = Array.from(new Set(perIds ?? []));
  const out: Record<string, string[]> = {};
  for (const perId of uniquePerIds) {
    const rows = await db.select({ token: pushTokens.token }).from(pushTokens).where(eq(pushTokens.perId, perId));
    out[perId] = rows.map((r) => r.token);
  }
  return out;
}

/** dispatch.ts gọi khi adapter báo token đã hết hạn/bị thu hồi — dọn ngay để lần gửi sau không phí công thử lại token chết. */
export async function removeInvalidToken(db: NodePgDatabase<Record<string, never>>, token?: string | null): Promise<void> {
  if (!token) return;
  await db.delete(pushTokens).where(eq(pushTokens.token, token));
}
