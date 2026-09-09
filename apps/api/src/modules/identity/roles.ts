/**
 * Danh mục 16 vai trò + trần bí mật mặc định — port 1-1 từ `catalog.js`
 * (project An toàn trường học, Firebase). Đây là HẰNG SỐ NGHIỆP VỤ, không
 * phải bảng DB — module khác import trực tiếp từ đây, KHÔNG hard-code lại
 * mã vai trò ở nơi khác (đúng quy ước gốc: "mọi hằng số nghiệp vụ PHẢI
 * khớp catalog, không tự suy diễn thêm").
 *
 * Nguồn đối chiếu: catalog.js:257-295 (project An toàn Firebase).
 */

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

/**
 * Trần bí mật mặc định theo vai trò (C1-C4). `DUTY_OFFICER` được NÂNG từ C2
 * lên C3 khi đang trong ca trực — xử lý ở tầng logic (`onDutyNow`), KHÔNG
 * đổi giá trị mặc định ở đây.
 */
export const ROLE_DEFAULT_CEILING: Record<RoleId, 'C1' | 'C2' | 'C3' | 'C4'> = {
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
  [ROLE.INCIDENT_CMD]: 'C4', // theo ĐÚNG hồ sơ được giao, không phải toàn trường
  [ROLE.SYS_ADMIN]: 'C1',
  [ROLE.AUDITOR]: 'C2',
  [ROLE.EXTERNAL]: 'C1',
  [ROLE.REPORTER]: 'C1'
};

/** Vai trò có phạm vi toàn trường, bỏ qua bước lọc theo cơ sở (authz.js:159). */
export const WHOLE_SCHOOL_ROLES = new Set<RoleId>([ROLE.PRINCIPAL]);

export const CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const;
export type CampusId = (typeof CAMPUS_IDS)[number];
