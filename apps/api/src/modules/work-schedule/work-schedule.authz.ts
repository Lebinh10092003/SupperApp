/**
 * work-schedule.authz.ts — luật phân quyền RIÊNG cho module Lịch công tác,
 * port 1-1 từ `authzLichCongTac.js` gốc (xác nhận trực tiếp với Mr Tiến
 * 27/08/2026, xem `TICH_HOP_MODULE_LICH_CONG_TAC.md` ở project nguồn).
 * Tách khỏi authz của module Cảnh báo an toàn — module này có luật riêng.
 *
 * 2026-10-05 (huong_dan_lich_cong_tac_giao_viec.md §4): lịch TOÀN TRƯỜNG
 * CHỈ CẦN 1 BƯỚC duyệt (Hiệu trưởng HOẶC Hiệu phó Điểm trường chính) —
 * thay cho bản trước đó (Mr Tiến, 2026-08-27) yêu cầu tuần tự Hiệu phó rồi
 * Hiệu trưởng. Giữ nguyên văn trả lời gốc của Mr Tiến để đối chiếu lịch sử:
 *   "Quyền duyệt theo vai trò và campus. Hiệu trưởng là quyền cao nhất ở
 *   mọi campus, có quyền tự chuyển trạng thái của mình và mọi người. Hiệu
 *   phó các campus sẽ có quyền trong campus do mình phụ trách, có quyền
 *   chuyển trạng thái của mình và mọi người trong campus. Các tổ trưởng sẽ
 *   có quyền được duyệt nhân viên trong tổ (cùng campus)."
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
    // An toàn mặc định TỪ CHỐI khi thiếu dữ liệu: nếu route yêu cầu khớp
    // campusId/domain mà assignment không có giá trị đó (null), coi là
    // KHÔNG khớp — tránh over-grant khi assignment bị thiếu dữ liệu gán
    // (từng gặp lỗi cùng dạng ở inDomainScope() của module An toàn).
    if (campusId && a.campusId !== campusId) return false;
    if (domain && a.domain !== domain) return false;
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

// Điểm trường chính — khớp VALID_CAMPUS_IDS[0] (work-schedule.schema.ts),
// lặp lại hằng số chuỗi ở đây (không import để tránh vòng phụ thuộc) vì
// spec §4 chốt rõ "Hiệu phó Điểm trường chính", không phải hiệu phó CAMPUS
// của chính sự kiện đó.
const MAIN_CAMPUS_ID = 'MAIN_CAMPUS';

/**
 * Duyệt sự kiện TOÀN TRƯỜNG (2026-10-05, theo
 * huong_dan_lich_cong_tac_giao_viec.md §4 — thay cho bản 2 bước tuần tự
 * trước đó): CHỈ 1 BƯỚC — Hiệu trưởng HOẶC Hiệu phó Điểm trường chính,
 * bất kỳ ai trong 2 vai trò đó duyệt là xong ngay (PUBLISHED), không cần
 * người còn lại duyệt thêm.
 */
export function checkSchoolWideApprovalStep(assignments: ActorAssignment[]): SchoolWideApprovalStep {
  if (hasRole(assignments, 'R.PRINCIPAL')) return { allowed: true, role: 'R.PRINCIPAL', finalStep: true };
  if (hasRole(assignments, 'R.VICE_PRINCIPAL', MAIN_CAMPUS_ID)) return { allowed: true, role: 'R.VICE_PRINCIPAL', finalStep: true };
  return { allowed: false, reason: 'Lịch toàn trường chỉ Hiệu trưởng hoặc Hiệu phó Điểm trường chính mới được duyệt.' };
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
    const step = checkSchoolWideApprovalStep(assignments);
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
 * Lịch TOÀN TRƯỜNG (scope=SCHOOL_WIDE) — 2026-09-29 (Sin: "lịch toàn trường
 * thì ko thể edit trừ tk có thẩm quyền kiêủ hiệu trưởng hiệu phó, người
 * khác chỉ xem ko cho edit") — chỉ Hiệu trưởng/Phó Hiệu trưởng (bất kỳ cơ
 * sở nào) được TẠO MỚI hoặc SỬA 1 sự kiện có scope=SCHOOL_WIDE. Dùng ở
 * route (createEvent/updateRevisionEvent) TRƯỚC khi gọi service, không
 * phải luật duyệt (module đã bỏ hẳn bước duyệt, xem createEvent).
 */
export function isLeadership(assignments: ActorAssignment[]): boolean {
  return hasRole(assignments, 'R.PRINCIPAL') || assignments.some((a) => a.roleId === 'R.VICE_PRINCIPAL');
}

/**
 * V3: quyền quản lý lịch thay cho luồng phê duyệt cũ. Các vai trò này có
 * thể tạo lịch toàn trường và tạo/chỉnh lịch thay người khác. Quản trị hệ
 * thống không mặc nhiên có quyền nghiệp vụ; Văn phòng là vai trò vận hành
 * lịch được giao quyền rõ ràng bên cạnh Ban giám hiệu.
 */
export function canManageSchoolCalendar(assignments: ActorAssignment[]): boolean {
  return isLeadership(assignments) || hasRole(assignments, 'R.OFFICE_ADMIN');
}

export function canCreateScheduleForOthers(assignments: ActorAssignment[]): boolean {
  return canManageSchoolCalendar(assignments);
}
