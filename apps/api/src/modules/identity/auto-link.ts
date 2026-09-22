import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { accounts, assignments, peopleDirectory } from './identity.schema.js';

/**
 * Tự động link tài khoản An toàn (bảng `accounts`, khoá theo Firebase uid)
 * ngay lần đăng nhập THẬT đầu tiên của một người ĐÃ được admin gán sẵn vai
 * trò trước (qua `people_directory` + `assignments`, khoá theo `perId`,
 * không cần biết uid trước — xem admin.routes.ts route
 * `/safety-users/by-per-id/:perId`).
 *
 * Trước đây: `accounts` chỉ được tạo thủ công bởi admin qua route
 * `/safety-users` (cần đặt mật khẩu, không hợp với tài khoản Google
 * Workspace có sẵn) — 246/249 người trong danh sách trường KHÔNG có cách
 * nào để hệ thống biết uid Firebase thật của họ cho tới khi họ tự đăng
 * nhập, dù admin đã gán vai trò từ trước (lưu ở `assignments` theo
 * `perId`). Hàm này lấp đúng khoảng trống đó — gọi 1 lần mỗi request đã
 * xác thực (từ `auth/middleware.ts`), best-effort, KHÔNG chặn request nếu
 * lỗi.
 *
 * Cố ý CHỈ tạo `accounts` khi đã có sẵn ÍT NHẤT 1 dòng `assignments` thật
 * cho đúng `perId` đó — tránh tạo account "rỗng" vô nghĩa cho người chưa
 * từng được admin gán vai trò gì (vd người chỉ có trong access_allowlist
 * với vai trò app-level TEACHER mặc định nhưng chưa có vai trò An toàn cụ
 * thể nào).
 */
export async function ensureSafetyAccountLinked(
  db: NodePgDatabase<Record<string, never>>,
  uid: string,
  email: string,
  displayNameFallback?: string
): Promise<void> {
  const lowerEmail = email.toLowerCase();
  const [existingByUid] = await db.select({ uid: accounts.uid }).from(accounts).where(eq(accounts.uid, uid)).limit(1);
  if (existingByUid) return; // đã link từ trước — đường thoát nhanh, chỉ 1 lookup theo PK

  const [dir] = await db.select().from(peopleDirectory).where(eq(peopleDirectory.email, lowerEmail)).limit(1);
  if (!dir) return; // không nằm trong danh sách trường đã biết trước — không tự tạo mới

  const [existingByPerId] = await db.select({ uid: accounts.uid }).from(accounts).where(eq(accounts.perId, dir.perId)).limit(1);
  if (existingByPerId) return; // perId này đã link với 1 uid KHÁC (hiếm, vd đổi email) — không ghi đè, cần admin xử lý tay

  const [hasAssignment] = await db.select({ id: assignments.id }).from(assignments).where(eq(assignments.perId, dir.perId)).limit(1);
  if (!hasAssignment) return; // chưa được gán vai trò An toàn nào — chưa cần account

  await db
    .insert(accounts)
    .values({ uid, perId: dir.perId, displayName: dir.displayName || displayNameFallback || lowerEmail, email: lowerEmail })
    .onConflictDoNothing();
}
