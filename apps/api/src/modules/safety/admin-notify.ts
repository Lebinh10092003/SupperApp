/**
 * admin-notify.ts — "chuông thông báo" trong cổng nội bộ, port 1-1 từ
 * `adminNotify.js`. KHÁC với notify.ts/dispatch.ts (S7 — cảnh báo khẩn cấp
 * ra kênh ngoài email/SMS/gọi thoại, có bậc thang/chuyển cấp): module này
 * CHỈ hiển thị TRONG ứng dụng, không có kênh/bậc thang/chuyển cấp — chỉ
 * ghi + đọc + đánh dấu đã đọc.
 */

import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { adminNotifications } from './admin-notify.schema.js';

export interface PushAdminNotificationsInput {
  recipients: Array<string | null | undefined>;
  title: string;
  message: string;
  eventType?: string | null;
  objectId?: string | null;
  actorPerId?: string | null;
  meta?: unknown;
}

/** Ghi 1 bản ghi độc lập cho MỖI người nhận — luôn ghi actorPerId để truy vết được ai vừa làm hành động gây ra thông báo này. */
export async function pushAdminNotifications(
  db: NodePgDatabase<Record<string, never>>,
  input: PushAdminNotificationsInput,
  opts?: { now?: Date }
) {
  const now = opts?.now ?? new Date();
  if (!input.title || !input.message) {
    throw new Error('adminNotify.pushAdminNotifications: thiếu title hoặc message.');
  }
  const uniqueRecipients = Array.from(new Set((input.recipients || []).filter((v): v is string => !!v)));
  const created: (typeof adminNotifications.$inferSelect)[] = [];
  for (const perId of uniqueRecipients) {
    const [row] = await db
      .insert(adminNotifications)
      .values({
        recipientPerId: perId,
        title: input.title,
        message: input.message,
        eventType: input.eventType ?? null,
        objectId: input.objectId ?? null,
        actorPerId: input.actorPerId ?? null,
        meta: input.meta ?? null,
        read: false,
        createdAt: now
      })
      .returning();
    if (row) created.push(row);
  }
  return created;
}

/** Đánh dấu 1 thông báo đã đọc — CHỈ chính người nhận mới đánh dấu được (kiểm tra ở tầng route). */
export async function markNotificationRead(
  db: NodePgDatabase<Record<string, never>>,
  input: { notificationId: string },
  opts?: { now?: Date }
) {
  const now = opts?.now ?? new Date();
  await db.update(adminNotifications).set({ read: true, readAt: now }).where(eq(adminNotifications.notificationId, input.notificationId));
  return { ok: true as const, notificationId: input.notificationId };
}
