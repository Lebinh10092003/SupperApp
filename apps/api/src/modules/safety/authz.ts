/**
 * authz.ts — S5 "Phân quyền và ngữ cảnh truy cập", port 1-1 từ `authz.js`
 * (project An toàn, Firebase). Cài đúng 8 bước đánh giá quyền — BỚT 1 bước
 * so với bản gốc: Sin chốt 2026-09-22 bỏ HOÀN TOÀN cơ chế C1-C4 (cả rút
 * gọn nội dung theo trần bí mật lẫn ranh giới xem theo vai trò), lý do:
 * giữ lại sẽ đóng băng thao tác thật (VD chỉ Hiệu trưởng mới đủ trần C4
 * để tiếp nhận ca xâm hại/tự hại, trong khi Tư vấn tâm lý/Y tế mới là
 * người nên xử lý). Bước "Mức bí mật" cũ (bước 6) đã bị XOÁ HẲN — số thứ
 * tự các bước còn lại giữ nguyên tên gọi trong comment để dễ đối chiếu với
 * lịch sử, không dồn lại số.
 *
 * Module THUẦN LOGIC (không tự query DB) — nơi gọi (route layer) chịu
 * trách nhiệm nạp `actor` (qua `loadActorContext` ở modules/identity) rồi
 * truyền vào đây.
 *
 * QUAN TRỌNG: đảo thứ tự các bước còn lại là tạo lỗ hổng — KHÔNG tự ý sắp xếp lại.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/authz.js
 */

import { ROLE, type RoleId } from './catalog.js';

/** Danh sách cấm tuyệt đối — không vai trò nào được bỏ qua, bất kể điều kiện khác. */
export const ABSOLUTE_FORBIDDEN_ACTIONS = new Set([
  'audit.delete',
  'audit.modify',
  'conflict.override_hard',
  'ai.auto_approve',
  'ai.auto_close',
  'ai.auto_lower_priority'
]);

type GrantLevel = 'X' | 'XR' | 'D';

/** Ma trận quyền tối thiểu — 'X' cho phép, 'XR' cho phép + bắt buộc lý do, 'D' cho phép nhưng cần phê duyệt cấp trên. */
export const PERMISSION_MATRIX: Record<string, Partial<Record<RoleId, GrantLevel>>> = {
  // Xem hồ sơ — Sin chốt 2026-09-22 bỏ hẳn 3 mức view_c1_c2/c3/c4, gộp
  // thành 1 action duy nhất cấp cho mọi vai trò nghiệp vụ an toàn (không
  // còn ranh giới theo mức bí mật — chỉ còn ranh giới theo cơ sở/lĩnh vực
  // ở bước 4/5 như mọi action khác).
  'incident.view': {
    [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X', [ROLE.DEPT_HEAD]: 'X',
    [ROLE.TEACHER]: 'X', [ROLE.HOMEROOM]: 'X', [ROLE.HEALTH]: 'X', [ROLE.COUNSELOR]: 'X',
    [ROLE.SECURITY]: 'X', [ROLE.FACILITY]: 'X'
  },
  // Xem/tải minh chứng (S8): dùng thẳng action `incident.view` ở trên (xem
  // `evidence.ts::canViewEvidence`) — ai mở được hồ sơ thì xem được minh
  // chứng của đúng hồ sơ đó.
  // Chuyển trạng thái thông thường — KHÔNG áp cho đóng P0/P1 hay mở lại (đi
  // qua action riêng vì yêu cầu phê duyệt khác nhau). Sin chốt 2026-09-22:
  // "người không tiếp nhận sự vụ không đổi trạng thái được" — đường VAI TRÒ
  // ở đây CHỈ còn cấp cao (Tổ trưởng/Phó HT/Hiệu trưởng, được sửa MỌI hồ sơ
  // không cần đang tham gia); người KHÔNG cấp cao chỉ còn đường quan hệ
  // (bước 7, `relationalGrant`) — tức phải đang là chỉ huy/người tham gia
  // ĐÚNG hồ sơ đó mới được (xem `transitionIncidentStatus`/
  // `updateIncidentClassification` truyền resource.commanderPerId/
  // assignedTaskPerIds cho checkAuthorization).
  'incident.manage': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'X' },
  // Đổi mức ưu tiên — THU HẸP HƠN "incident.manage": chỉ chỉ huy hồ sơ
  // (KHÔNG phải participant thường) hoặc cấp cao mới đổi được (Sin: "chỉ có
  // chỉ huy hoặc người uỷ quyền sự vụ có thể chọn mức ưu tiên"). Đạt được
  // bằng cách `changeIncidentPriority` CHỈ truyền `resource.commanderPerId`
  // (không truyền `assignedTaskPerIds`) cho checkAuthorization — participant
  // thường không khớp `relationalGrant` nữa.
  'incident.raise_priority': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'X' },
  'incident.lower_priority': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'D', [ROLE.DEPT_HEAD]: 'D' },
  // Tổ trưởng được bàn giao thêm 2026-09-22 (Sin chốt) — chỉ giao được cho
  // cấp dưới, ràng buộc đó nằm ở HANDOFF_TARGET_ROLES_BY_ACTOR_ROLE
  // (catalog.ts), kiểm tra trong assignCommander (incident-lifecycle.ts),
  // KHÔNG nằm trong ma trận này (ma trận chỉ trả lời "vai trò có được làm
  // hành động không", không biết gì về "đối tượng nhận là ai").
  'incident.assign_commander': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'XR' },
  // Sửa tay lớp/khu vực gợi ý cho 1 hồ sơ ĐÃ TẠO. R.DUTY_OFFICER CỐ TÌNH
  // không xuất hiện -> không có quyền hành động này. `reason` bắt buộc ở
  // tầng hàm gọi (updateIncidentClassification) là ĐIỀU KIỆN RIÊNG áp dụng
  // bất kể vai trò — không trùng với cờ XR ở đây (không kiểm tra 2 lần).
  'incident.correct_classification': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'XR' },
  'incident.activate_p0': {
    [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X',
    [ROLE.DEPT_HEAD]: 'X', [ROLE.OFFICE_ADMIN]: 'X', [ROLE.TEACHER]: 'X'
  },
  // Đóng P2/P3 — cùng nguyên tắc "incident.manage" ở trên: đường vai trò chỉ
  // còn cấp cao, Trực ban/participant thường đóng được ĐÚNG hồ sơ mình đang
  // tham gia qua đường quan hệ (relationalGrant), không còn đóng tràn.
  'incident.close_p2_p3': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'X' },
  'incident.close_p0_p1': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'D' },
  'incident.reopen': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'D' },
  // Duyệt/từ chối yêu cầu huỷ tiếp nhận (bổ sung 2026-09-22) — CHỈ cấp trên
  // (Tổ trưởng/Phó HT/Hiệu trưởng) mới quyết định được, người yêu cầu (chỉ
  // huy hiện tại) không tự duyệt cho chính mình.
  'incident.approve_cancel_acknowledgment': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'X' },
  'incident.export': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'D', [ROLE.OFFICE_ADMIN]: 'D' },
  'conflict.override_soft': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'XR', [ROLE.DEPT_HEAD]: 'D', [ROLE.OFFICE_ADMIN]: 'D' },
  'catalog.edit': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'D', [ROLE.OFFICE_ADMIN]: 'X', [ROLE.SYS_ADMIN]: 'D' },
  'authz_matrix.edit': { [ROLE.PRINCIPAL]: 'X', [ROLE.SYS_ADMIN]: 'D' },
  'audit.read': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.SYS_ADMIN]: 'X', [ROLE.AUDITOR]: 'X' },
  // Thống kê/dashboard BGH — phạm vi campus của Phó HT tự lọc ở tầng route,
  // KHÔNG dựa vào resource.campusId vì đây là hành động tổng hợp.
  'incident.view_stats': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X' },
  'incident.view_trend_alerts': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X' },
  // So sánh 3 cơ sở cùng lúc — CHỈ Hiệu trưởng (Phó HT chỉ phụ trách 1 cơ sở).
  'incident.view_campus_comparison': { [ROLE.PRINCIPAL]: 'X' },
  'incident.view_class_stats': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'XR', [ROLE.DEPT_HEAD]: 'XR' },
  'notify.run_escalation_check': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X' }
};

/** Vai trò có phạm vi "toàn trường" mặc định — bỏ qua bước 4 (tổ chức) + bước 5 (lĩnh vực). */
export const WHOLE_SCHOOL_ROLES = new Set<RoleId>([ROLE.PRINCIPAL]);

export interface ActorRole {
  roleId: RoleId | string;
  campusId?: string | null;
  domain?: string | null;
  ceiling?: string;
}

export interface Actor {
  perId?: string;
  session?: { valid: boolean; revoked: boolean };
  roles?: ActorRole[];
  onDutyNow?: boolean;
  activeDelegations?: Array<{ campusId?: string | null }>;
}

export interface Resource {
  campusId?: string | null;
  domain?: string | null;
  assignedTaskPerIds?: string[];
  commanderPerId?: string;
}

export interface AuthzDecision {
  allowed: boolean;
  reason: string | null;
  conditions: Array<'require_reason' | 'require_approval'>;
}

function decide(allowed: boolean, reason?: string | null, extra?: Partial<AuthzDecision>): AuthzDecision {
  return { allowed: !!allowed, reason: reason ?? null, conditions: [], ...extra };
}

export function inOrgScope(actor: Actor, resource: Resource): boolean {
  return (actor.roles ?? []).some((r) => {
    if (WHOLE_SCHOOL_ROLES.has(r.roleId as RoleId)) return true;
    if (!r.campusId) return false; // vai trò chưa gán phạm vi cơ sở cụ thể
    return r.campusId === resource.campusId;
  });
}

export function inDomainScope(actor: Actor, resource: Resource): boolean {
  if (!resource.domain) return true; // đối tượng không gắn lĩnh vực cụ thể
  return (actor.roles ?? []).some((r) => {
    if (WHOLE_SCHOOL_ROLES.has(r.roleId as RoleId)) return true;
    if (!r.domain) return true; // vai trò không giới hạn lĩnh vực (VD Trực ban)
    return r.domain === resource.domain;
  });
}

/**
 * Bước 7 — quyền tạm thời theo quan hệ/thời gian (đang trực ca / đang được
 * ủy quyền / được giao nhiệm vụ trên đúng hồ sơ / là chỉ huy hồ sơ đó).
 */
// Khớp mọi action xem hồ sơ (VD "incident.view") — dùng regex khớp "view"
// ngay sau dấu chấm hoặc ở đầu chuỗi.
const VIEW_ACTION_RE = /(^|\.)view($|_)/;

export interface RelationalGrant {
  granted: boolean;
  reason?: string;
}

export function relationalGrant(actor: Actor, action: string, resource: Resource): RelationalGrant {
  if (actor.onDutyNow && (action === 'incident.activate_p0' || VIEW_ACTION_RE.test(action))) {
    return { granted: true, reason: 'Đang trong ca trực tại cơ sở.' };
  }
  if (actor.activeDelegations?.some((d) => !resource.campusId || d.campusId === resource.campusId)) {
    return { granted: true, reason: 'Đang được ủy quyền còn hiệu lực.' };
  }
  if (resource.assignedTaskPerIds?.includes(actor.perId ?? '')) {
    return { granted: true, reason: 'Được giao nhiệm vụ trong hồ sơ này.' };
  }
  if (resource.commanderPerId && resource.commanderPerId === actor.perId) {
    return { granted: true, reason: 'Là người chỉ huy vụ việc (R.INCIDENT_CMD theo vụ việc).' };
  }
  return { granted: false };
}

function rankLevel(lvl?: GrantLevel): number {
  // XR và X cùng "được phép trực tiếp", D cần phê duyệt riêng.
  return lvl === 'X' ? 1 : lvl === 'XR' ? 2 : lvl === 'D' ? 1 : 0;
}

/**
 * Đánh giá quyền theo đúng 9 bước. KHÔNG đảo thứ tự — xem cảnh báo đầu file.
 */
export function checkAuthorization(input: { actor: Actor; action: string; resource?: Resource }): AuthzDecision {
  const actor = input.actor;
  const action = input.action;
  const resource = input.resource ?? {};

  // Bước 1 — Phiên hợp lệ
  if (!actor?.session || actor.session.valid !== true || actor.session.revoked) {
    return decide(false, 'Phiên đăng nhập không hợp lệ hoặc đã bị thu hồi.');
  }

  // Bước 2 — Cấm tuyệt đối
  if (ABSOLUTE_FORBIDDEN_ACTIONS.has(action)) {
    return decide(false, 'Hành động nằm trong danh sách cấm tuyệt đối của nền tảng, không xét tiếp.');
  }

  // Bước 3 — Vai trò
  const matrix = PERMISSION_MATRIX[action] ?? {};
  let grantLevel: GrantLevel | null = null;
  for (const r of actor.roles ?? []) {
    const lvl = matrix[r.roleId as RoleId];
    if (lvl && (!grantLevel || rankLevel(lvl) > rankLevel(grantLevel))) grantLevel = lvl;
  }

  // Bước 4 (phạm vi tổ chức) + Bước 5 (lĩnh vực) — CHỈ áp cho đường vai trò.
  let grantedVia: 'role' | 'relation' | null = null;
  if (grantLevel) {
    const orgOk = !resource.campusId || inOrgScope(actor, resource);
    const domainOk = inDomainScope(actor, resource);
    if (orgOk && domainOk) grantedVia = 'role';
  }

  // Bước 7 — Quan hệ/thời gian: LUÔN tính `relationalGrant()`, KHÔNG chỉ
  // khi đường vai trò chưa cấp quyền.
  const relational = relationalGrant(actor, action, resource);
  if (!grantedVia && relational.granted) {
    grantedVia = 'relation';
  }

  if (!grantedVia) {
    if (grantLevel) {
      return decide(false, 'Đối tượng không thuộc phạm vi cơ sở/tổ/lớp hoặc lĩnh vực được phân công, và không có quyền tạm thời theo quan hệ/thời gian.');
    }
    return decide(false, 'Không có vai trò nào cho phép thực hiện hành động này, và không có quyền tạm thời theo quan hệ/thời gian.');
  }

  // Bước 6 (mức bí mật) ĐÃ XOÁ — Sin chốt 2026-09-22 bỏ hoàn toàn C1-C4.

  const finalReason = grantedVia === 'role'
    ? 'Được phép theo vai trò trong đúng phạm vi được phân công.'
    : (relational?.reason ?? null);

  // Bước 8 — Yêu cầu bổ sung (chỉ gắn khi cấp qua đúng dòng ma trận vai trò).
  const conditions: AuthzDecision['conditions'] = [];
  if (grantedVia === 'role') {
    if (grantLevel === 'XR') conditions.push('require_reason');
    if (grantLevel === 'D') conditions.push('require_approval');
  }

  return decide(true, finalReason, { conditions });
}
