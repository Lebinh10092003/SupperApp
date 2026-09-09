/**
 * people-search.ts — Tìm người theo tên (thay việc gõ tay `perId` ở cổng
 * nội bộ: người nhận cảnh báo P0, `approvedBy`, `commanderPerId`, gán
 * GVCN), port 1-1 từ `peopleSearch.js`. Tên người CHỈ có ở `accounts`
 * (`displayName`, `perId`) — `people_directory` KHÔNG có tên (chỉ
 * email/phone) nên không dùng cho việc này.
 *
 * Bản gốc Firestore phải tự chia batch <=30 phần tử cho `where('per_id',
 * 'in', values)` — Postgres `IN` không có giới hạn đó, dùng thẳng `inArray`
 * 1 lần (giống cách escalation-recipients.ts đã đơn giản hoá).
 */

import { inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts } from '../identity/identity.schema.js';
import { normalizeForMatch } from './zoneStats.js';

export const MIN_QUERY_LEN = 2;
export const MAX_RESULTS = 10;

/**
 * searchPeopleByName — lọc `accounts.displayName` đã chuẩn hoá (không dấu/
 * không phân biệt hoa-thường) chứa `query` đã chuẩn hoá tương tự. CHỈ trả
 * `{ perId, name }` — TUYỆT ĐỐI không trả email/uid (yêu cầu bảo mật đã
 * chốt, không phải tuỳ chọn).
 */
export async function searchPeopleByName(db: NodePgDatabase<Record<string, never>>, query: string): Promise<Array<{ perId: string; name: string }>> {
  const raw = String(query || '').trim();
  if (raw.length < MIN_QUERY_LEN) return [];
  const normQuery = normalizeForMatch(raw);
  if (!normQuery) return [];

  const rows = await db.select({ perId: accounts.perId, displayName: accounts.displayName }).from(accounts);
  const out: Array<{ perId: string; name: string }> = [];
  for (const row of rows) {
    if (out.length >= MAX_RESULTS) break;
    if (!row.displayName) continue;
    if (!normalizeForMatch(row.displayName).includes(normQuery)) continue;
    if (!row.perId) continue;
    out.push({ perId: row.perId, name: row.displayName });
  }
  return out.slice(0, MAX_RESULTS);
}

/**
 * getDisplayNamesByPerIds — tra tên hiển thị theo `perId` cho nhiều người
 * (VD JOIN `commanderPerId` -> tên trong `listIncidents`/`getIncident`,
 * thay vì hiện mã thô). Không tìm thấy account -> KHÔNG có key đó trong map
 * trả về (không throw) — tên chỉ huy là dữ liệu bổ sung cho dễ đọc, thiếu
 * không được phép chặn hiển thị danh sách.
 */
export async function getDisplayNamesByPerIds(db: NodePgDatabase<Record<string, never>>, perIds: Array<string | null | undefined>): Promise<Record<string, string | null>> {
  const ids = Array.from(new Set((perIds || []).filter((v): v is string => !!v)));
  const map: Record<string, string | null> = {};
  if (ids.length === 0) return map;
  const rows = await db.select({ perId: accounts.perId, displayName: accounts.displayName }).from(accounts).where(inArray(accounts.perId, ids));
  for (const row of rows) {
    if (row.perId) map[row.perId] = row.displayName ?? null;
  }
  return map;
}
