/**
 * work-schedule.authz.ts — luật phân quyền RIÊNG cho module Lịch công tác,
 * port 1-1 từ `authzLichCongTac.js` gốc (xác nhận trực tiếp với Mr Tiến
 * 27/08/2026, xem `TICH_HOP_MODULE_LICH_CONG_TAC.md` ở project nguồn).
 * Tách khỏi authz của module Cảnh báo an toàn — module này có luật riêng,
 * đơn giản hơn nhưng có 1 điểm đặc biệt: lịch TOÀN TRƯỜNG cần duyệt TUẦN
 * TỰ 2 bước, không phải "ai duyệt cũng xong".
 *
 * Nguyên văn trả lời của Mr Tiến (giữ lại để đối chiếu khi có tranh cãi):
 *   "Quyền duyệt theo vai trò và campus. Hiệu trưởng là quyền cao nhất ở
 *   mọi campus, có quyền tự chuyển trạng thái của mình và mọi người. Hiệu
 *   phó các campus sẽ có quyền trong campus do mình phụ trách, có quyền
 *   chuyển trạng thái của mình và mọi người trong campus. Các tổ trưởng sẽ
 *   có quyền được duyệt nhân viên trong tổ (cùng campus). Các lịch làm
 *   việc liên quan đến toàn trường sẽ phải đi qua Hiệu phó campus đó rồi
 *   đến Hiệu trưởng."
 *   "Luồng giao việc do người giao xác nhận nghiệm thu."
 *
 * GIẢ ĐỊNH CHƯA KIỂM CHỨNG (giữ nguyên từ bản gốc, cần Sin/Mr Tiến xác
 * nhận khi có dữ liệu thật): "Tổ trưởng duyệt nhân viên TRONG TỔ" được
 * hiện thực bằng cách so khớp trường `domain` sẵn có trong `assignments`
 * (bảng identity dùng chung, Hestia port) — field này hiện dùng cho "lĩnh
 * vực" (VD an ninh/y tế) ở module An toàn, CHƯA xác nhận có được dùng để
 * biểu diễn "tổ chuyên môn" (VD Tổ Toán, Tổ Văn) cho module này hay không.
 */

import type { EventScope } from './work-schedule.schema.js';

export const SCOPE_CAMPUS: EventScope = 'CAMPUS';
// Giá trị MỚI, tự đặt ở bản gốc (schema Drizzle/D1 gốc chỉ có "CAMPUS" mặc
// định, chưa định nghĩa giá trị nào cho lịch toàn trường) — cần Mr Tiến
// xác nhận đặt tên này có khớp ý anh không trước khi coi là chính thức.
export const SCOPE_SCHOOL_WIDE: EventScope = 'SCHOOL_WIDE';

export interface ActorAssignment {
  roleId: string;
  campusId: string | null;
  domain: string | null;
}

export interface EventForApproval {
  campusId: string;
  scope: string;
  departmentDomain: string | null;
  approvals: ApprovalRecord[];
}

export interface ApprovalRecord {
  role: string;
  perId: string;
  at?: string | Date;
}

function hasRole(assignments: ActorAssignment[], roleId: string, campusId?: string | null, domain?: string | null): boolean {
  return assignments.some((a) => {
    if (a.roleId !== roleId) return false;
    if (campusId && a.campusId && a.campusId !== campusId) return false;
    if (domain && a.domain && a.domain !== domain) return false;
    return true;
  });
}

/**
 * Kiểm tra actor có quyền duyệt bước ĐẦU (và DUY NHẤT) cho 1 sự kiện
 * scope=CAMPUS hay không (tổ trưởng cùng tổ, hoặc hiệu phó cùng campus,
 * hoặc hiệu trưởng — bất kỳ 1 trong 3 là đủ, không cần tuần tự).
 */
export function canApproveCampusEvent(assignments: ActorAssignment[], event: EventForApproval): boolean {
  if (hasRole(assignments, 'R.PRINCIPAL')) return true;
  if (hasRole(assignments, 'R.VICE_PRINCIPAL', event.campusId)) return true;
  if (hasRole(assignments, 'R.DEPT_HEAD', event.campusId, event.departmentDomain)) return true;
  return false;
}

export interface SchoolWideApprovalStep {
  allowed: boolean;
  reason?: string;
  role?: 'R.PRINCIPAL' | 'R.VICE_PRINCIPAL';
  finalStep?: boolean;
}

/**
 * Duyệt sự kiện TOÀN TRƯỜNG — bắt buộc tuần tự: Hiệu phó campus đó duyệt
 * TRƯỚC (ghi vào event.approvals), rồi mới tới Hiệu trưởng duyệt SAU thì
 * mới coi là hoàn tất (PUBLISHED). Hiệu trưởng duyệt trước khi có chữ ký
 * Hiệu phó vẫn ĐƯỢC (quyền cao nhất, không phụ thuộc thứ tự), nhưng Hiệu
 * phó bấm 2 lần thì lần 2 bị từ chối rõ lý do.
 */
export function checkSchoolWideApprovalStep(
  assignments: ActorAssignment[],
  event: EventForApproval
): SchoolWideApprovalStep {
  const approvals = event.approvals || [];
  const vpApproved = approvals.some((a) => a.role === 'R.VICE_PRINCIPAL');
  const isPrincipal = hasRole(assignments, 'R.PRINCIPAL');
  const isVicePrincipalHere = hasRole(assignments, 'R.VICE_PRINCIPAL', event.campusId);

  if (isPrincipal) {
    return { allowed: true, role: 'R.PRINCIPAL', finalStep: true };
  }
  if (isVicePrincipalHere) {
    if (vpApproved) {
      return { allowed: false, reason: 'Hiệu phó cơ sở này đã duyệt bước này rồi, đang chờ Hiệu trưởng.' };
    }
    return { allowed: true, role: 'R.VICE_PRINCIPAL', finalStep: false };
  }
  return { allowed: false, reason: 'Lịch toàn trường chỉ Hiệu phó cơ sở liên quan hoặc Hiệu trưởng mới được duyệt.' };
}

export interface EventApprovalDecision {
  allowed: boolean;
  reason?: string;
  becomesPublished?: boolean;
  approvalRecord?: { role: string; perId: string } | null;
}

/**
 * Điểm vào duy nhất tầng gọi (route handler) nên dùng khi actor bấm
 * "Duyệt" 1 sự kiện đang PENDING_APPROVAL.
 */
export function evaluateEventApproval(
  assignments: ActorAssignment[],
  event: EventForApproval,
  actorPerId: string
): EventApprovalDecision {
  if (event.scope === SCOPE_SCHOOL_WIDE) {
    const step = checkSchoolWideApprovalStep(assignments, event);
    if (!step.allowed) return { allowed: false, reason: step.reason };
    return {
      allowed: true,
      becomesPublished: !!step.finalStep,
      approvalRecord: { role: step.role!, perId: actorPerId }
    };
  }
  if (!canApproveCampusEvent(assignments, event)) {
    return {
      allowed: false,
      reason: 'Bạn không có quyền duyệt sự kiện này (cần Tổ trưởng cùng tổ, Hiệu phó cùng cơ sở, hoặc Hiệu trưởng).'
    };
  }
  return { allowed: true, becomesPublished: true, approvalRecord: null };
}

/**
 * Nghiệm thu/trả lại 1 công việc: CHỈ người đã giao việc đó
 * (task.createdByPerId) mới được xác nhận COMPLETED/RETURNED — theo QUAN
 * HỆ với đúng task đó, không phải theo vai trò cố định.
 */
export function canAcceptOrReturnTask(task: { createdByPerId: string }, actorPerId: string): boolean {
  return task.createdByPerId === actorPerId;
}
