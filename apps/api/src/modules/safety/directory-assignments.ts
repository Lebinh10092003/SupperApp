/**
 * directory-assignments.ts — 4 hàm CRUD dữ liệu nền tảng nhỏ, port 1-1 từ
 * `index.js`: upsertHomeroomAssignment (lớp -> GVCN), upsertGradeSupervisorAssignment
 * (khối -> giáo viên phụ trách khối), upsertPersonDirectoryEntry/getPersonDirectoryEntry
 * (danh bạ liên hệ people_directory). Bảng đích đã có sẵn từ H2
 * (identity.schema.ts) — KHÔNG cần migration mới.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/index.js
 * (dòng 1698-1737, 2053-2078).
 */

import { eq } from 'drizzle-orm';
import { checkAuthorization, type Actor } from './authz.js';
import { writeAuditLog, buildAuditRecord } from './audit.js';
import { AppError, type Db } from './shared.js';
import { homeroomAssignments, gradeSupervisorAssignments, peopleDirectory } from '../identity/identity.schema.js';

/** `requireAdminUserManagement` gốc — chỉ Hiệu trưởng/Phó Hiệu trưởng được đọc/sửa danh bạ liên hệ. */
function requireAdminUserManagement(actor: Actor): void {
  const allowed = (actor.roles ?? []).some((r) => r.roleId === 'R.PRINCIPAL' || r.roleId === 'R.VICE_PRINCIPAL');
  if (!allowed) throw new AppError('forbidden', 'Chỉ Hiệu trưởng/Phó Hiệu trưởng được quản lý tài khoản người dùng.');
}

export interface UpsertHomeroomAssignmentInput {
  actor: Actor;
  className: string;
  perId: string;
  name?: string | null;
}

export async function upsertHomeroomAssignment(
  db: Db,
  input: UpsertHomeroomAssignmentInput,
  opts?: { approvedBy?: string; now?: Date }
): Promise<{ ok: true }> {
  const { actor, className, perId, name } = input;
  if (!className || !perId) throw new AppError('invalid_input', 'Thiếu tên lớp hoặc perId giáo viên chủ nhiệm.');
  const decision = checkAuthorization({ actor, action: 'catalog.edit', resource: {} });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason ?? 'Không có quyền.');
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của Hiệu trưởng trước khi thực hiện.');
  }

  await db
    .insert(homeroomAssignments)
    .values({ className: String(className), perId, name: name ?? null })
    .onConflictDoUpdate({ target: homeroomAssignments.className, set: { perId, name: name ?? null } });

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: actor.perId!,
      action: 'config.homeroom_assignment_edited',
      objectId: String(className),
      after: { perId, name: name ?? null },
      now: opts?.now ?? new Date()
    })
  );
  return { ok: true };
}

export interface UpsertGradeSupervisorAssignmentInput {
  actor: Actor;
  grade: string;
  perId: string;
  name?: string | null;
}

export async function upsertGradeSupervisorAssignment(
  db: Db,
  input: UpsertGradeSupervisorAssignmentInput,
  opts?: { approvedBy?: string; now?: Date }
): Promise<{ ok: true }> {
  const { actor, grade, perId, name } = input;
  if (!grade || !perId) throw new AppError('invalid_input', 'Thiếu khối hoặc perId giáo viên phụ trách khối.');
  const decision = checkAuthorization({ actor, action: 'catalog.edit', resource: {} });
  if (!decision.allowed) throw new AppError('forbidden', decision.reason ?? 'Không có quyền.');
  if (decision.conditions.includes('require_approval') && !opts?.approvedBy) {
    throw new AppError('approval_required', 'Hành động cần phê duyệt của Hiệu trưởng trước khi thực hiện.');
  }

  await db
    .insert(gradeSupervisorAssignments)
    .values({ grade: String(grade), perId, name: name ?? null })
    .onConflictDoUpdate({ target: gradeSupervisorAssignments.grade, set: { perId, name: name ?? null } });

  await writeAuditLog(
    db,
    buildAuditRecord({
      actorPerId: actor.perId!,
      action: 'config.grade_supervisor_assignment_edited',
      objectId: String(grade),
      after: { perId, name: name ?? null },
      now: opts?.now ?? new Date()
    })
  );
  return { ok: true };
}

export interface UpsertPersonDirectoryEntryInput {
  actor: Actor;
  perId: string;
  email?: string | null;
}

/** Gốc KHÔNG ghi audit log cho 2 hàm danh bạ này — giữ nguyên, không tự thêm. */
export async function upsertPersonDirectoryEntry(db: Db, input: UpsertPersonDirectoryEntryInput): Promise<{ ok: true }> {
  requireAdminUserManagement(input.actor);
  if (!input.perId) throw new AppError('invalid_input', 'Thiếu perId.');
  await db
    .insert(peopleDirectory)
    .values({ perId: input.perId, email: input.email ?? null })
    .onConflictDoUpdate({ target: peopleDirectory.perId, set: { email: input.email ?? null } });
  return { ok: true };
}

export interface GetPersonDirectoryEntryInput {
  actor: Actor;
  perId: string;
}

export async function getPersonDirectoryEntry(db: Db, input: GetPersonDirectoryEntryInput): Promise<{ email: string | null }> {
  requireAdminUserManagement(input.actor);
  if (!input.perId) throw new AppError('invalid_input', 'Thiếu perId.');
  const [row] = await db.select().from(peopleDirectory).where(eq(peopleDirectory.perId, input.perId)).limit(1);
  return { email: row?.email ?? null };
}
