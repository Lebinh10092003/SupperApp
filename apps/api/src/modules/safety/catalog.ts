/**
 * catalog.ts — hằng số nghiệp vụ cho module Cảnh báo an toàn, port 1-1 từ
 * `catalog.js` (project An toàn, Firebase). KHÔNG hard-code giá trị nghiệp
 * vụ nào khác ngoài file này — module khác trong `modules/safety/` PHẢI
 * import từ đây, đúng nguyên tắc gốc.
 *
 * Nguồn đối chiếu:
 * /Users/macbook/Projects/thcs-giangvo-super-app-lich-cong-tac/App_Canh_bao_an_toan_backend_v0_1/functions/src/catalog.js
 */

// ---------------------------------------------------------------------------
// Mức ưu tiên P0–P3 — P0 khẩn nhất.
// ---------------------------------------------------------------------------
export const PRIORITY = {
  P0: 'P0', // Đỏ — nguy hiểm tức thời tính mạng/sức khỏe
  P1: 'P1', // Cam — nguy cơ nghiêm trọng / leo thang nhanh
  P2: 'P2', // Vàng — cần phối hợp, không nguy hiểm tức thời
  P3: 'P3' // Xanh — nguy cơ thông thường / phòng ngừa
} as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];

export const PRIORITY_ORDER: Priority[] = [PRIORITY.P0, PRIORITY.P1, PRIORITY.P2, PRIORITY.P3];

export const PRIORITY_LABEL: Record<Priority, string> = {
  P0: 'P0 - Đỏ',
  P1: 'P1 - Cam',
  P2: 'P2 - Vàng',
  P3: 'P3 - Xanh'
};

/** SLA đề xuất (phút). P0/P1 tính theo giờ đồng hồ (wall); P2/P3 theo giờ làm việc (business). */
export const PRIORITY_SLA_MINUTES: Record<Priority, { ack: number; assign: number; clockType: 'wall' | 'business' }> = {
  P0: { ack: 1, assign: 1, clockType: 'wall' },
  P1: { ack: 5, assign: 15, clockType: 'wall' },
  P2: { ack: 30, assign: 120, clockType: 'business' },
  P3: { ack: 240, assign: 480, clockType: 'business' }
};

export function isValidPriority(p: unknown): p is Priority {
  return typeof p === 'string' && PRIORITY_ORDER.includes(p as Priority);
}

export function priorityRank(p: string): number {
  const idx = PRIORITY_ORDER.indexOf(p as Priority);
  return idx === -1 ? Infinity : idx;
}

/** rank thấp hơn = khẩn hơn => nâng mức. */
export function isEscalation(fromPriority: string, toPriority: string): boolean {
  return priorityRank(toPriority) < priorityRank(fromPriority);
}

// ---------------------------------------------------------------------------
// Mức bí mật C1–C4.
// ---------------------------------------------------------------------------
export const CONFIDENTIALITY = { C1: 'C1', C2: 'C2', C3: 'C3', C4: 'C4' } as const;
export type Confidentiality = (typeof CONFIDENTIALITY)[keyof typeof CONFIDENTIALITY];
export const CONFIDENTIALITY_ORDER: Confidentiality[] = [
  CONFIDENTIALITY.C1, CONFIDENTIALITY.C2, CONFIDENTIALITY.C3, CONFIDENTIALITY.C4
];

export function isValidConfidentiality(c: unknown): c is Confidentiality {
  return typeof c === 'string' && CONFIDENTIALITY_ORDER.includes(c as Confidentiality);
}

export function confidentialityRank(c: string): number {
  return CONFIDENTIALITY_ORDER.indexOf(c as Confidentiality);
}

// ---------------------------------------------------------------------------
// 20 nhóm sự cố.
// ---------------------------------------------------------------------------
export interface CategoryDef {
  label: string;
  minConfidentiality: Confidentiality;
  suggestedPriority: Priority;
  linkClass: boolean;
  group: string;
}

export const CATEGORY_CATALOG: Record<string, CategoryDef> = {
  violence_bullying: { label: 'Bạo lực học đường, đánh nhau, bắt nạt', minConfidentiality: 'C3', suggestedPriority: 'P1', linkClass: true, group: 'student_safety' },
  abuse_neglect: { label: 'Nghi ngờ xâm hại, bạo hành, bỏ mặc trẻ em', minConfidentiality: 'C4', suggestedPriority: 'P0', linkClass: true, group: 'student_safety' },
  self_harm_mental: { label: 'Khủng hoảng tâm lý, tự hại, có ý định tự tử', minConfidentiality: 'C4', suggestedPriority: 'P0', linkClass: true, group: 'student_safety' },
  cyberbullying: { label: 'Bắt nạt trực tuyến, quấy rối qua mạng', minConfidentiality: 'C3', suggestedPriority: 'P2', linkClass: true, group: 'student_safety' },
  data_privacy: { label: 'Lộ thông tin, hình ảnh riêng tư học sinh', minConfidentiality: 'C3', suggestedPriority: 'P2', linkClass: true, group: 'student_safety' },
  weapon_drugs: { label: 'Phát hiện vũ khí, hung khí, chất cấm', minConfidentiality: 'C4', suggestedPriority: 'P0', linkClass: false, group: 'student_safety' },
  missing_student: { label: 'Học sinh mất tích, rời trường không rõ lý do', minConfidentiality: 'C3', suggestedPriority: 'P0', linkClass: true, group: 'student_safety' },
  medical_emergency: { label: 'Cấp cứu y tế (ngất, chấn thương nặng, dị ứng nặng)', minConfidentiality: 'C2', suggestedPriority: 'P1', linkClass: false, group: 'health' },
  medical_minor: { label: 'Sức khỏe nhẹ (sốt, đau bụng, cần theo dõi)', minConfidentiality: 'C2', suggestedPriority: 'P2', linkClass: false, group: 'health' },
  food_safety: { label: 'An toàn thực phẩm, bán trú', minConfidentiality: 'C2', suggestedPriority: 'P2', linkClass: false, group: 'health' },
  fire_explosion: { label: 'Cháy, nổ, khói bất thường', minConfidentiality: 'C1', suggestedPriority: 'P0', linkClass: false, group: 'facility' },
  electrical_chemical: { label: 'Điện, hóa chất, rò rỉ khí gas', minConfidentiality: 'C1', suggestedPriority: 'P0', linkClass: false, group: 'facility' },
  structural_hazard: { label: 'Sự cố công trình (sập, nứt, bong tróc trần/tường)', minConfidentiality: 'C1', suggestedPriority: 'P1', linkClass: false, group: 'facility' },
  security_intrusion: { label: 'An ninh, người lạ xâm nhập, nghi trộm cắp', minConfidentiality: 'C2', suggestedPriority: 'P1', linkClass: false, group: 'security_traffic' },
  traffic_gate: { label: 'Giao thông, cổng trường, đưa đón', minConfidentiality: 'C1', suggestedPriority: 'P2', linkClass: false, group: 'security_traffic' },
  transport_bus: { label: 'Xe đưa đón học sinh (sự cố, chậm giờ, an toàn)', minConfidentiality: 'C2', suggestedPriority: 'P2', linkClass: false, group: 'security_traffic' },
  natural_disaster: { label: 'Thiên tai, bão lũ, thời tiết cực đoan', minConfidentiality: 'C1', suggestedPriority: 'P1', linkClass: false, group: 'facility' },
  facility_hygiene: { label: 'Vệ sinh, môi trường (nhà vệ sinh, mùi, rác, côn trùng)', minConfidentiality: 'C1', suggestedPriority: 'P3', linkClass: false, group: 'facility' },
  facility_general: { label: 'Cơ sở vật chất thông thường (bàn ghế, điện, nước, thiết bị)', minConfidentiality: 'C1', suggestedPriority: 'P3', linkClass: false, group: 'facility' },
  other: { label: 'Khác', minConfidentiality: 'C1', suggestedPriority: 'P3', linkClass: false, group: 'other_group' }
};

export const CATEGORY_GROUP_LABELS: Record<string, string> = {
  student_safety: 'An toàn thân thể & tâm lý học sinh',
  health: 'Y tế & sức khỏe',
  facility: 'Cơ sở vật chất & công trình',
  security_traffic: 'An ninh & giao thông',
  other_group: 'Khác'
};

export function groupForCategory(categoryCode: string): string {
  return CATEGORY_CATALOG[categoryCode]?.group ?? 'other_group';
}

export function groupLabelForCategory(categoryCode: string): string {
  return CATEGORY_GROUP_LABELS[groupForCategory(categoryCode)] ?? 'Khác';
}

export function minConfidentialityForCategory(categoryCode: string): Confidentiality {
  return CATEGORY_CATALOG[categoryCode]?.minConfidentiality ?? 'C1';
}

export function suggestedPriorityForCategory(categoryCode: string): Priority {
  return CATEGORY_CATALOG[categoryCode]?.suggestedPriority ?? 'P3';
}

export function categoryLinksClass(categoryCode: string): boolean {
  return Boolean(CATEGORY_CATALOG[categoryCode]?.linkClass);
}

/** Mức bí mật hiệu lực = lớn hơn giữa mức đã gán và sàn theo danh mục (chỉ được nâng, không được hạ). */
export function effectiveConfidentiality(categoryCode: string, requested: unknown): Confidentiality {
  const floor = minConfidentialityForCategory(categoryCode);
  if (!isValidConfidentiality(requested)) return floor;
  return confidentialityRank(requested) >= confidentialityRank(floor) ? requested : floor;
}

// ---------------------------------------------------------------------------
// Vai trò người khiếu nại (cổng công khai) — KHÔNG liên quan 16 vai trò nội bộ.
// ---------------------------------------------------------------------------
export const REPORTER_ROLE = {
  VICTIM: 'victim',
  WITNESS: 'witness',
  PARENT_ON_BEHALF: 'parent_on_behalf',
  STAFF: 'staff',
  OTHER: 'other'
} as const;
export type ReporterRole = (typeof REPORTER_ROLE)[keyof typeof REPORTER_ROLE];

export const REPORTER_ROLE_LABEL: Record<ReporterRole, string> = {
  [REPORTER_ROLE.VICTIM]: 'Người trực tiếp gặp sự cố',
  [REPORTER_ROLE.WITNESS]: 'Người chứng kiến',
  [REPORTER_ROLE.PARENT_ON_BEHALF]: 'Phụ huynh báo giúp con',
  [REPORTER_ROLE.STAFF]: 'Giáo viên/nhân viên trường',
  [REPORTER_ROLE.OTHER]: 'Khác'
};

export function isValidReporterRole(v: unknown): v is ReporterRole {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(REPORTER_ROLE_LABEL, v);
}

// ---------------------------------------------------------------------------
// 12 trạng thái chuẩn của hồ sơ sự cố.
// ---------------------------------------------------------------------------
export const STATE = {
  NEW: 'Mới tiếp nhận',
  CLASSIFYING: 'Đang phân loại',
  EMERGENCY: 'Khẩn cấp đang xử lý',
  ASSIGNED: 'Đã giao',
  IN_PROGRESS: 'Đang xử lý',
  WAITING_EXTERNAL: 'Chờ bên ngoài',
  MONITORING: 'Đang theo dõi',
  CLOSE_REQUESTED: 'Đề nghị đóng',
  CLOSED: 'Đã đóng',
  REOPENED: 'Mở lại',
  DUPLICATE: 'Trùng',
  SPAM: 'Tin rác'
} as const;
export type IncidentState = (typeof STATE)[keyof typeof STATE];

export const TERMINAL_STATES: IncidentState[] = [STATE.CLOSED, STATE.DUPLICATE, STATE.SPAM];

/** "Mở lại" luôn quay lại "Đang xử lý" (không quay thẳng về "Mới tiếp nhận"). */
export const ALLOWED_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  [STATE.NEW]: [STATE.CLASSIFYING, STATE.EMERGENCY, STATE.DUPLICATE, STATE.SPAM],
  [STATE.CLASSIFYING]: [STATE.EMERGENCY, STATE.ASSIGNED, STATE.DUPLICATE, STATE.SPAM],
  [STATE.EMERGENCY]: [STATE.ASSIGNED, STATE.IN_PROGRESS, STATE.MONITORING],
  [STATE.ASSIGNED]: [STATE.IN_PROGRESS, STATE.WAITING_EXTERNAL],
  [STATE.IN_PROGRESS]: [STATE.WAITING_EXTERNAL, STATE.MONITORING, STATE.CLOSE_REQUESTED],
  [STATE.WAITING_EXTERNAL]: [STATE.IN_PROGRESS, STATE.MONITORING],
  [STATE.MONITORING]: [STATE.IN_PROGRESS, STATE.CLOSE_REQUESTED],
  [STATE.CLOSE_REQUESTED]: [STATE.CLOSED, STATE.IN_PROGRESS],
  [STATE.CLOSED]: [STATE.REOPENED],
  [STATE.REOPENED]: [STATE.IN_PROGRESS, STATE.MONITORING],
  [STATE.DUPLICATE]: [], // khôi phục xử lý riêng, không đi qua updateIncidentStatus thường
  [STATE.SPAM]: []
};

export function canTransition(from: IncidentState, to: IncidentState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(state: IncidentState): boolean {
  return TERMINAL_STATES.includes(state);
}

/**
 * Đóng hồ sơ P0/P1 cần đi qua action `incident.close_p0_p1` (chỉ Hiệu
 * trưởng X, Phó HT cần phê duyệt D) — P2/P3 đi qua `incident.close_p2_p3`
 * (nhẹ hơn). Bị BỎ SÓT khi port `catalog.ts` lần đầu (chỉ dùng ở
 * `transitionIncidentStatus`, phần K6 mới port tới) — bổ sung ngay khi
 * phát hiện, port 1-1 từ `catalog.js:240-242`.
 */
export function closeRequiresPrincipalApproval(priority: Priority): boolean {
  return priority === PRIORITY.P0 || priority === PRIORITY.P1;
}

/**
 * Quyết định họp 07/09/2026: người GỬI TIN BÁO (không phải Hiệu trưởng/Phó
 * HT) xác nhận đã xử lý xong để đóng hồ sơ, áp dụng MỌI mức ưu tiên. Dự
 * phòng: nhân viên có quyền vẫn tự đóng được sau đủ số ngày này kể từ lúc
 * chuyển "Đề nghị đóng" nếu người báo tin không phản hồi.
 */
export const REPORTER_CONFIRM_CLOSE_FALLBACK_DAYS = 3;

// ---------------------------------------------------------------------------
// 16 vai trò — GIỮ Ở ĐÂY (không import từ modules/identity/roles.ts) vì đây
// là bản port catalog.js NGUYÊN VẸN cho module safety; modules/identity đã
// có bản riêng cho mục đích authz chung. 2 bản PHẢI khớp giá trị nhau (cùng
// nguồn catalog.js gốc) — nếu catalog.js gốc đổi, sửa CẢ 2 nơi.
// ---------------------------------------------------------------------------
export const ROLE = {
  PRINCIPAL: 'R.PRINCIPAL',
  VICE_PRINCIPAL: 'R.VICE_PRINCIPAL',
  DUTY_OFFICER: 'R.DUTY_OFFICER',
  DEPT_HEAD: 'R.DEPT_HEAD',
  OFFICE_ADMIN: 'R.OFFICE_ADMIN',
  TEACHER: 'R.TEACHER',
  HOMEROOM: 'R.HOMEROOM',
  HEALTH: 'R.HEALTH',
  COUNSELOR: 'R.COUNSELOR',
  SECURITY: 'R.SECURITY',
  FACILITY: 'R.FACILITY',
  INCIDENT_CMD: 'R.INCIDENT_CMD',
  SYS_ADMIN: 'R.SYS_ADMIN',
  AUDITOR: 'R.AUDITOR',
  EXTERNAL: 'R.EXTERNAL',
  REPORTER: 'R.REPORTER'
} as const;
export type RoleId = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_DEFAULT_CEILING: Record<RoleId, Confidentiality> = {
  [ROLE.PRINCIPAL]: 'C4',
  [ROLE.VICE_PRINCIPAL]: 'C3',
  [ROLE.DUTY_OFFICER]: 'C2',
  [ROLE.DEPT_HEAD]: 'C2',
  [ROLE.OFFICE_ADMIN]: 'C2',
  [ROLE.TEACHER]: 'C1',
  [ROLE.HOMEROOM]: 'C2',
  [ROLE.HEALTH]: 'C3',
  [ROLE.COUNSELOR]: 'C3',
  [ROLE.SECURITY]: 'C2',
  [ROLE.FACILITY]: 'C1',
  [ROLE.INCIDENT_CMD]: 'C4', // theo mức của đúng hồ sơ được giao — xử lý ở authz.ts
  [ROLE.SYS_ADMIN]: 'C1', // không có quyền nội dung mặc định
  [ROLE.AUDITOR]: 'C2',
  [ROLE.EXTERNAL]: 'C1',
  [ROLE.REPORTER]: 'C1'
};

// ---------------------------------------------------------------------------
// Tiền tố mã định danh (S3).
// ---------------------------------------------------------------------------
export const ID_PREFIX = {
  CAMPUS: 'CS',
  PERSON: 'PER',
  REPORT: 'TB',
  INCIDENT: 'SC',
  TASK: 'NV',
  EVIDENCE: 'MC',
  PUBLIC_CODE: 'GV'
} as const;

/** Suy "khối" (VD "8") từ tên lớp (VD "8A2") — trả về null nếu không đoán được, KHÔNG chặn nghiệp vụ. */
export function extractGradeFromClassName(className: string | null | undefined): string | null {
  if (!className) return null;
  const m = String(className).trim().match(/^(\d{1,2})/);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Ngưỡng thống kê/cảnh báo xu hướng.
// ---------------------------------------------------------------------------
export const MIN_ZONE_COUNT_FOR_BREAKDOWN = 5;

export const TREND_ALERT_THRESHOLDS = {
  HIGH_SEVERITY: { priorities: ['P0', 'P1'] as Priority[], count: 2, windowDays: 5 },
  LOW_SEVERITY: { priorities: ['P2', 'P3'] as Priority[], count: 4, windowDays: 7 }
};

// ---------------------------------------------------------------------------
// Kho minh chứng (S8).
// ---------------------------------------------------------------------------
export const EVIDENCE_FILE_TYPE = { IMAGE: 'image', AUDIO: 'audio', VIDEO: 'video' } as const;

export const EVIDENCE_SCAN_STATUS = {
  PENDING_SCAN: 'pending_scan',
  REJECTED: 'rejected',
  CLEAR: 'clear',
  INFECTED: 'infected'
} as const;

export const EVIDENCE_LIMITS = {
  MAX_SIZE_BYTES: { image: 8 * 1024 * 1024, audio: 15 * 1024 * 1024, video: 50 * 1024 * 1024 },
  MAX_FILES_PER_SUBMISSION: 5,
  MAX_TOTAL_BYTES_PER_SUBMISSION: 80 * 1024 * 1024
};

export const EVIDENCE_ORPHAN_TTL_MS = 2 * 60 * 60 * 1000;
