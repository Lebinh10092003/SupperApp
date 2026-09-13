import { eq, and, or, sql, ne, lte } from 'drizzle-orm';
import { db } from '../../core/db/client.js';
import { events } from './events.schema.js';

const LEASE_MS = 300_000;

/**
 * claimEvent — giành quyền xử lý 1 event đúng 1 lần. Dùng
 * INSERT ... ON CONFLICT DO UPDATE ... WHERE (thay vì transaction 2 round-
 * trip như bản Firestore cũ) — Postgres CHỈ áp dụng UPDATE khi WHERE đúng,
 * nếu không RETURNING trả về rỗng, nên atomic trong đúng 1 câu lệnh.
 * Điều kiện cho claim: chưa DONE, VÀ (không phải đang PROCESSING hoặc lease
 * đã hết hạn).
 */
export async function claimEvent(id: string, source: string): Promise<boolean> {
  const leaseUntil = new Date(Date.now() + LEASE_MS);
  const claimed = await db
    .insert(events)
    .values({ eventId: id, source, status: 'PROCESSING', leaseUntil, attempts: 1 })
    .onConflictDoUpdate({
      target: events.eventId,
      set: {
        status: 'PROCESSING',
        leaseUntil,
        attempts: sql`${events.attempts} + 1`,
        updatedAt: new Date()
      },
      where: and(
        ne(events.status, 'DONE'),
        or(ne(events.status, 'PROCESSING'), lte(events.leaseUntil, sql`now()`))
      )
    })
    .returning({ eventId: events.eventId });
  return claimed.length > 0;
}

export async function finishEvent(id: string, status: 'DONE' | 'ERROR', error?: unknown): Promise<void> {
  await db
    .update(events)
    .set({
      status,
      error: error instanceof Error ? error.message : null,
      leaseUntil: null,
      updatedAt: new Date()
    })
    .where(eq(events.eventId, id));
}
