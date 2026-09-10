/**
 * authz.ts — S5 "Phân quyền và ngữ cảnh truy cập", port 1-1 từ `authz.js`
 * (project An toàn, Firebase). Cài đúng 9 bước đánh giá quyền.
 *
 * Module THUẦN LOGIC (không tự query DB) — nơi gọi (route layer) chịu
 * trách nhiệm nạp `actor` (qua `loadActorContext` ở modules/identity) rồi
 * truyền vào đây.
 *
 * QUAN TRỌNG: đảo thứ tự 9 bước là tạo lỗ hổng — KHÔNG tự ý sắp xếp lại.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/authz.js
 */

import { ROLE, ROLE_DEFAULT_CEILING, confidentialityRank, isValidConfidentiality, type Confidentiality, type RoleId } from './catalog.js';

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
  'incident.view_c1_c2': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X', [ROLE.TEACHER]: 'X' },
  'incident.view_c3': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'XR' },
  'incident.view_c4': { [ROLE.PRINCIPAL]: 'X' },
  // Xem/tải minh chứng (S8) — riêng biệt với xem NỘI DUNG hồ sơ theo mức bí
  // mật, vì minh chứng nhạy cảm hơn văn bản mô tả. Các vai trò khác CHỈ
  // được cấp qua bước 7 (là chỉ huy hồ sơ đó HOẶC được giao nhiệm vụ trên
  // đúng hồ sơ đó) — KHÔNG cấp theo vai trò tĩnh.
  'incident.view_evidence': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'XR' },
  // Chuyển trạng thái thông thường — KHÔNG áp cho đóng P0/P1 hay mở lại (đi
  // qua action riêng vì yêu cầu phê duyệt khác nhau).
  'incident.manage': {
    [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X',
    [ROLE.DEPT_HEAD]: 'X', [ROLE.HEALTH]: 'X', [ROLE.COUNSELOR]: 'X',
    [ROLE.SECURITY]: 'X', [ROLE.FACILITY]: 'X'
  },
  'incident.raise_priority': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X', [ROLE.TEACHER]: 'X' },
  'incident.lower_priority': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'D' },
  'incident.assign_commander': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'X' },
  // Sửa tay lớp/khu vực gợi ý cho 1 hồ sơ ĐÃ TẠO. R.DUTY_OFFICER CỐ TÌNH
  // không xuất hiện -> không có quyền hành động này. `reason` bắt buộc ở
  // tầng hàm gọi (updateIncidentClassification) là ĐIỀU KIỆN RIÊNG áp dụng
  // bất kể vai trò — không trùng với cờ XR ở đây (không kiểm tra 2 lần).
  'incident.correct_classification': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DEPT_HEAD]: 'XR' },
  'incident.activate_p0': {
    [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X',
    [ROLE.DEPT_HEAD]: 'X', [ROLE.OFFICE_ADMIN]: 'X', [ROLE.TEACHER]: 'X'
  },
  'incident.close_p2_p3': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'X', [ROLE.DUTY_OFFICER]: 'X' },
  'incident.close_p0_p1': { [ROLE.PRINCIPAL]: 'X', [ROLE.VICE_PRINCIPAL]: 'D' },
  'incident.reopen': { [ROLE.PRINCIPAL]: 'XR', [ROLE.VICE_PRINCIPAL]: 'D' },
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
  confidentiality?: string;
  assignedTaskPerIds?: string[];
  commanderPerId?: string;
}

export interface AuthzDecision {
  allowed: boolean;
  reason: string | null;
  conditions: Array<'require_reason' | 'require_approval' | 'redacted'>;
}

function decide(allowed: boolean, reason?: string | null, extra?: Partial<AuthzDecision>): AuthzDecision {
  return { allowed: !!allowed, reason: reason ?? null, conditions: [], ...extra };
}

function actorHasRole(actor: Actor, roleId: RoleId): boolean {
  return (actor.roles ?? []).some((r) => r.roleId === roleId);
}

/** Trần bí mật hiệu lực cao nhất trong số các vai trò đang có của actor. */
export function actorCeiling(actor: Actor): Confidentiality {
  let best: Confidentiality = 'C1';
  for (const r of actor.roles ?? []) {
    const c = (r.ceiling as Confidentiality) || ROLE_DEFAULT_CEILING[r.roleId as RoleId] || 'C1';
    if (confidentialityRank(c) > confidentialityRank(best)) best = c;
  }
  // Trực ban được nâng C2 -> C3 khi đang trong ca.
  if (actorHasRole(actor, ROLE.DUTY_OFFICER) && actor.onDutyNow) {
    if (confidentialityRank('C3') > confidentialityRank(best)) best = 'C3';
  }
  return best;
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
 * Bước 7 — quyền tạm thời theo quan hệ/thời gian.
 *
 * `bypassCeiling`: chỉ true cho 2 lý do gắn CHẶT với đúng 1 hồ sơ cụ thể
 * (được giao nhiệm vụ / là người chỉ huy vụ việc) — vì khi đó chính người
 * có thẩm quyền tạo hồ sơ đã CHỌN đưa người này vào xử lý hồ sơ ĐÓ. Hai lý
 * do còn lại (đang trực ca / đang được ủy quyền) là quyền RỘNG áp cho
 * nhiều hồ sơ cùng lúc nên vẫn phải qua đúng trần bí mật ở Bước 6.
 */
// Mọi action xem hồ sơ đều có dạng "incident.view_c..." — dùng regex khớp
// "view_" ngay sau dấu chấm hoặc ở đầu chuỗi (không dùng indexOf === 0, vì
// action luôn có tiền tố "incident." nên không bao giờ khớp — lỗi ẩn đã
// gặp ở bản gốc).
const VIEW_ACTION_RE = /(^|\.)view_/;

export interface RelationalGrant {
  granted: boolean;
  reason?: string;
  bypassCeiling?: boolean;
}

export function relationalGrant(actor: Actor, action: string, resource: Resource): RelationalGrant {
  if (actor.onDutyNow && (action === 'incident.activate_p0' || VIEW_ACTION_RE.test(action))) {
    return { granted: true, reason: 'Đang trong ca trực tại cơ sở.', bypassCeiling: false };
  }
  if (actor.activeDelegations?.some((d) => !resource.campusId || d.campusId === resource.campusId)) {
    return { granted: true, reason: 'Đang được ủy quyền còn hiệu lực.', bypassCeiling: false };
  }
  if (resource.assignedTaskPerIds?.includes(actor.perId ?? '')) {
    return { granted: true, reason: 'Được giao nhiệm vụ trong hồ sơ này.', bypassCeiling: true };
  }
  if (resource.commanderPerId && resource.commanderPerId === actor.perId) {
    return { granted: true, reason: 'Là người chỉ huy vụ việc (R.INCIDENT_CMD theo vụ việc).', bypassCeiling: true };
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

  // Bước 7 — Quan hệ/thời gian: CHỈ xét khi đường vai trò CHƯA cho phép.
  let relational: RelationalGrant | null = null;
  if (!grantedVia) {
    relational = relationalGrant(actor, action, resource);
    if (relational.granted) grantedVia = 'relation';
  }

  if (!grantedVia) {
    if (grantLevel) {
      return decide(false, 'Đối tượng không thuộc phạm vi cơ sở/tổ/lớp hoặc lĩnh vực được phân công, và không có quyền tạm thời theo quan hệ/thời gian.');
    }
    return decide(false, 'Không có vai trò nào cho phép thực hiện hành động này, và không có quyền tạm thời theo quan hệ/thời gian.');
  }

  // Bước 6 — Mức bí mật (áp dụng cả 2 đường, TRỪ quan hệ tạm thời bypassCeiling).
  const skipCeiling = grantedVia === 'relation' && relational?.bypassCeiling;
  if (!skipCeiling && resource.confidentiality && isValidConfidentiality(resource.confidentiality)) {
    const ceiling = actorCeiling(actor);
    if (confidentialityRank(ceiling) < confidentialityRank(resource.confidentiality)) {
      return decide(true, 'Trần bí mật thấp hơn mức của hồ sơ — chỉ trả về bản ghi rút gọn (mã và mức), không trả nội dung.', {
        conditions: ['redacted']
      });
    }
  }

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
