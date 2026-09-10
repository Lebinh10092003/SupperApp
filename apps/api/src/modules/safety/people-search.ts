/**
 * people-search.ts — Tìm người theo tên (thay việc gõ tay `perId` ở cổng
 * nội bộ: người nhận cảnh báo P0, `approvedBy`, `commanderPerId`, gán
 * GVCN), port 1-1 từ `peopleSearch.js`. Tên người CHỈ có ở `accounts`
 * (module identity, `displayName`/`perId`/`email`) — `people_directory`
 * KHÔNG có tên nên không dùng cho việc này.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/peopleSearch.js
 */

import { inArray } from 'drizzle-orm';
import { accounts } from '../identity/identity.schema.js';
import { normalizeForMatch } from './text-match.js';
import type { Db } from './shared.js';

const MIN_QUERY_LEN = 2;
const MAX_RESULTS = 10;

export interface PersonResult {
  perId: string;
  name: string;
}

/**
 * searchPeopleByName — quét `accounts`, lọc theo `displayName` đã chuẩn
 * hoá (không dấu/không phân biệt hoa-thường) chứa `query` đã chuẩn hoá
 * tương tự (so khớp substring).
 *
 * CHỈ trả về `{ perId, name }` cho mỗi người — TUYỆT ĐỐI không trả
 * `email`/`uid`/field nào khác (yêu cầu bảo mật đã chốt, không phải tuỳ
 * chọn).
 */
export async function searchPeopleByName(db: Db, query: string | null | undefined): Promise<PersonResult[]> {
  const raw = String(query || '').trim();
  if (raw.length < MIN_QUERY_LEN) return [];

  const normQuery = normalizeForMatch(raw);
  if (!normQuery) return [];

  const rows = await db.select().from(accounts);
  const out: PersonResult[] = [];
  for (const row of rows) {
    if (out.length >= MAX_RESULTS) break;
    const name = row.displayName;
    if (!name) continue;
    if (!normalizeForMatch(name).includes(normQuery)) continue;
    if (!row.perId) continue;
    out.push({ perId: row.perId, name });
  }

  return out.slice(0, MAX_RESULTS);
}

/**
 * getDisplayNamesByPerIds — tra cứu tên hiển thị theo `perId` cho 1 danh
 * sách người (VD JOIN `commander_per_id` -> tên chỉ huy trong
 * `listIncidents`/`getIncident`, thay vì hiển thị mã thô `PER_xxx`).
 *
 * Không tìm thấy account tương ứng -> KHÔNG có key đó trong map trả về
 * (nơi gọi tự coi thiếu key là `null`) — không throw, vì tên chỉ huy là
 * dữ liệu bổ sung cho dễ đọc, thiếu không được phép chặn hiển thị.
 *
 * Postgres không giới hạn `IN` như Firestore (không cần chia batch <=30 —
 * giữ nguyên chia batch chỉ để khớp hành vi/kết quả 1-1 với bản gốc, xem
 * README `core/db/` không có giới hạn tương tự) — ở đây chỉ cần 1 truy
 * vấn `inArray` duy nhất.
 */
export async function getDisplayNamesByPerIds(db: Db, perIds: Array<string | null | undefined> | undefined): Promise<Record<string, string | null>> {
  const ids = Array.from(new Set((perIds || []).filter((v): v is string => Boolean(v))));
  const map: Record<string, string | null> = {};
  if (ids.length === 0) return map;

  const rows = await db.select().from(accounts).where(inArray(accounts.perId, ids));
  for (const row of rows) {
    if (row.perId) map[row.perId] = row.displayName || null;
  }
  return map;
}
