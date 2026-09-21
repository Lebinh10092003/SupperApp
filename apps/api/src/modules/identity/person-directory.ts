/**
 * person-directory.ts — tra cứu HÀNG LOẠT "tên + chức vụ" theo `perId`,
 * dùng chung giữa module An toàn và Lịch công tác để KHÔNG BAO GIỜ hiện
 * thẳng mã `PER_xxx` khó hình dung lên UI (Sin yêu cầu 2026-09-21, sau khi
 * thấy "Chủ trì: PER_ZBLM4U1YOBBM" ở modal chi tiết lịch công tác).
 *
 * Vai trò lấy từ `assignments` (1 người có thể có NHIỀU vai trò/nhiều cơ
 * sở) — chỉ lấy vai trò còn hiệu lực tại thời điểm gọi (giống
 * `loadActorContext`), rồi nối nhãn tiếng Việt bằng "/" nếu có nhiều vai
 * trò khác nhau. Không tìm thấy account -> trả `name: null` (nơi gọi tự
 * fallback về mã thô, không throw — tên chỉ là dữ liệu hiển thị phụ trợ).
 */

import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts, assignments } from './identity.schema.js';
import { ROLE_LABEL, type RoleId } from './roles.js';

type Db = NodePgDatabase<Record<string, never>>;

export interface PersonSummary {
  perId: string;
  name: string | null;
  roleLabel: string | null;
}

/** "Tên (Chức vụ)" / "Tên" (không có vai trò nào đang hiệu lực) / mã thô (không có account). */
export function formatPersonLabel(perId: string, summary?: PersonSummary | null): string {
  if (!summary || !summary.name) return perId;
  return summary.roleLabel ? `${summary.name} (${summary.roleLabel})` : summary.name;
}

export async function getPersonSummariesByPerIds(
  db: Db,
  perIds: Array<string | null | undefined> | undefined,
  now: Date = new Date()
): Promise<Record<string, PersonSummary>> {
  const ids = Array.from(new Set((perIds || []).filter((v): v is string => Boolean(v))));
  const map: Record<string, PersonSummary> = {};
  if (ids.length === 0) return map;

  const accountRows = await db.select().from(accounts).where(inArray(accounts.perId, ids));
  const assignmentRows = await db.select().from(assignments).where(inArray(assignments.perId, ids));

  const rolesByPerId = new Map<string, Set<string>>();
  for (const a of assignmentRows) {
    const fromOk = !a.fromDate || a.fromDate.getTime() <= now.getTime();
    const toOk = !a.toDate || a.toDate.getTime() >= now.getTime();
    if (!fromOk || !toOk) continue;
    const set = rolesByPerId.get(a.perId) ?? new Set<string>();
    set.add(ROLE_LABEL[a.roleId as RoleId] ?? a.roleId);
    rolesByPerId.set(a.perId, set);
  }

  for (const acc of accountRows) {
    if (!acc.perId) continue;
    const roleSet = rolesByPerId.get(acc.perId);
    map[acc.perId] = {
      perId: acc.perId,
      name: acc.displayName || null,
      roleLabel: roleSet && roleSet.size > 0 ? Array.from(roleSet).join('/') : null
    };
  }
  return map;
}

/** Tiện ích cho route: trả thẳng map `perId -> "Tên (Chức vụ)"` đã format sẵn. */
export async function getPersonLabelsByPerIds(
  db: Db,
  perIds: Array<string | null | undefined> | undefined,
  now: Date = new Date()
): Promise<Record<string, string>> {
  const summaries = await getPersonSummariesByPerIds(db, perIds, now);
  const out: Record<string, string> = {};
  for (const id of Object.keys(summaries)) out[id] = formatPersonLabel(id, summaries[id]);
  return out;
}
