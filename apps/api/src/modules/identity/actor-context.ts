import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { HttpError } from '../../core/http.js';
import { accounts, assignments, dutyShifts, delegations } from './identity.schema.js';

export interface ActorRole {
  roleId: string;
  campusId: string | null;
  domain: string | null;
  ceiling?: string;
}

export interface ActorContext {
  perId: string;
  session: { valid: true; revoked: false };
  roles: ActorRole[];
  onDutyNow: boolean;
  activeDelegations: Array<{ campusId: string | null }>;
}

/**
 * Port 1-1 từ `loadActorContext` (project An toàn, `index.js:388-436`,
 * Firestore). Giữ NGUYÊN logic gốc — chỉ đổi nguồn đọc từ Firestore sang
 * Postgres. Dùng chung cho MỌI module cần biết "actor hiện tại là ai, vai
 * trò gì, có đang trực ca/được uỷ quyền không" (An toàn, Lịch công tác).
 *
 * GIỮ NGUYÊN cách lọc của bản gốc: tải hết `assignments`/`duty_shifts`/
 * `delegations` theo `perId` rồi lọc còn-hiệu-lực bằng JS (không đẩy điều
 * kiện ngày xuống `WHERE` SQL) — để hành vi khớp 1-1, dễ đối chiếu khi
 * review. Có thể tối ưu đẩy xuống SQL sau khi có dữ liệu thật để đo hiệu
 * năng, không tối ưu sớm khi chưa cần (đã ghi trong README cùng thư mục).
 */
export async function loadActorContext(
  db: NodePgDatabase<Record<string, never>>,
  uid: string,
  now: Date = new Date()
): Promise<ActorContext> {
  const [account] = await db.select().from(accounts).where(eq(accounts.uid, uid)).limit(1);
  if (!account) {
    throw new HttpError(
      412,
      'Tài khoản Workspace này chưa được đăng ký trong hệ thống (chưa có bản ghi Account/Assignment) — liên hệ quản trị hệ thống.',
      'ACCOUNT_NOT_REGISTERED'
    );
  }
  const perId = account.perId;

  const assignmentRows = await db.select().from(assignments).where(eq(assignments.perId, perId));
  const roles: ActorRole[] = assignmentRows
    .filter((a) => {
      const fromOk = !a.fromDate || a.fromDate.getTime() <= now.getTime();
      const toOk = !a.toDate || a.toDate.getTime() >= now.getTime();
      return fromOk && toOk;
    })
    .map((a) => ({
      roleId: a.roleId,
      campusId: a.campusId ?? null,
      domain: a.domain ?? null,
      ceiling: a.ceiling ?? undefined
    }));

  const dutyRows = await db.select().from(dutyShifts).where(eq(dutyShifts.perId, perId));
  const onDutyNow = dutyRows.some((s) => s.fromAt.getTime() <= now.getTime() && now.getTime() <= s.toAt.getTime());

  const delegationRows = await db.select().from(delegations).where(eq(delegations.toPerId, perId));
  const activeDelegations = delegationRows
    .filter((d) => d.fromAt.getTime() <= now.getTime() && now.getTime() <= d.toAt.getTime())
    .map((d) => ({ campusId: d.campusId ?? null }));

  return { perId, session: { valid: true, revoked: false }, roles, onDutyNow, activeDelegations };
}
