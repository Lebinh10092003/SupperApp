/**
 * escalation-recipients.ts — Tra cứu diện nhận thông báo leadership + trực
 * ban đúng cơ sở cho cảnh báo P0/P1, port 1-1 từ `escalationRecipients.js`.
 * SERVER tự truy vấn `assignments`/`duty_shifts` (module identity) — client
 * KHÔNG được tự khai danh sách người nhận cảnh báo khẩn cấp.
 *
 * ĐÃ BỎ so với bản gốc: `chunk30()` — giới hạn 30 phần tử của toán tử
 * Firestore `in`, không tồn tại ở SQL `IN` (Postgres không giới hạn số
 * phần tử theo cách đó) — dùng thẳng `inArray` 1 lần, đơn giản hơn.
 */

import { and, eq, inArray, isNull, lte, gte, or } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { assignments, dutyShifts } from '../identity/identity.schema.js';
import { ROLE } from './catalog.js';

/**
 * Hiệu trưởng (toàn trường, không lọc campus_id) + Phó Hiệu trưởng đúng
 * campusId — cả hai chỉ tính assignment còn hiệu lực tại `now`.
 */
export async function findLeadershipForCampus(
  db: NodePgDatabase<Record<string, never>>,
  campusId: string,
  opts?: { now?: Date }
): Promise<string[]> {
  const now = opts?.now ?? new Date();

  const activeAt = (col: typeof assignments.fromDate) => or(isNull(col), lte(col, now));
  const activeAtEnd = (col: typeof assignments.toDate) => or(isNull(col), gte(col, now));

  const [principalRows, viceRows] = await Promise.all([
    db.select({ perId: assignments.perId }).from(assignments).where(
      and(eq(assignments.roleId, ROLE.PRINCIPAL), activeAt(assignments.fromDate), activeAtEnd(assignments.toDate))
    ),
    db.select({ perId: assignments.perId }).from(assignments).where(
      and(eq(assignments.roleId, ROLE.VICE_PRINCIPAL), eq(assignments.campusId, campusId), activeAt(assignments.fromDate), activeAtEnd(assignments.toDate))
    )
  ]);

  return Array.from(new Set([...principalRows, ...viceRows].map((r) => r.perId)));
}

/**
 * Trực ban đúng cơ sở VÀ đang trong ca hiện tại. `duty_shifts` KHÔNG có
 * campus_id — phải tra `assignments` trước để có danh sách perId đúng cơ
 * sở, rồi mới lọc theo ca trực còn hiệu lực.
 */
export async function findOnDutyOfficersForCampus(
  db: NodePgDatabase<Record<string, never>>,
  campusId: string,
  opts?: { now?: Date }
): Promise<string[]> {
  const now = opts?.now ?? new Date();

  const assignRows = await db.select({ perId: assignments.perId }).from(assignments).where(
    and(
      eq(assignments.roleId, ROLE.DUTY_OFFICER),
      eq(assignments.campusId, campusId),
      or(isNull(assignments.fromDate), lte(assignments.fromDate, now)),
      or(isNull(assignments.toDate), gte(assignments.toDate, now))
    )
  );
  const uniqueCandidates = Array.from(new Set(assignRows.map((r) => r.perId)));
  if (uniqueCandidates.length === 0) return [];

  const shiftRows = await db.select().from(dutyShifts).where(
    and(inArray(dutyShifts.perId, uniqueCandidates), lte(dutyShifts.fromAt, now), gte(dutyShifts.toAt, now))
  );

  return Array.from(new Set(shiftRows.map((s) => s.perId)));
}

export interface EscalationRecipients {
  leadershipPerIds: string[];
  onDutyPerIds: string[];
}

/** Gộp cả hai diện (leadership + trực ban) cho 1 cơ sở. */
export async function getEscalationRecipients(
  db: NodePgDatabase<Record<string, never>>,
  input: { campusId: string },
  opts?: { now?: Date }
): Promise<EscalationRecipients> {
  const [leadershipPerIds, onDutyPerIds] = await Promise.all([
    findLeadershipForCampus(db, input.campusId, opts),
    findOnDutyOfficersForCampus(db, input.campusId, opts)
  ]);
  return { leadershipPerIds, onDutyPerIds };
}
