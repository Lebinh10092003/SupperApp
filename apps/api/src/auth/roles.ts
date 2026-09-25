export type Role =
  | 'SYSTEM_SUPER_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'SYSTEM_ADMIN' // alias for SYSTEM_SUPER_ADMIN/Admin
  | 'PRINCIPAL' // alias for SCHOOL_ADMIN
  | 'VICE_PRINCIPAL'
  | 'DEPARTMENT_HEAD'
  | 'HOMEROOM'
  | 'DATA_VIEWER'
  | 'VIEWER' // alias for DATA_VIEWER
  | 'TEACHER';

export type Capability =
  | 'VIEW_DASHBOARD'
  | 'VIEW_STUDENT_DATA'
  | 'MANAGE_SCHEDULES'
  | 'RESOLVE_ALERTS'
  | 'MANAGE_USERS'
  | 'MANAGE_INFRASTRUCTURE'
  | 'RUN_SYNC'
  | 'MANAGE_CONNECTIONS'
  | 'MANAGE_CATALOG'
  | 'VIEW_EXECUTIVE_BI'
  | 'VIEW_AUDIT_LOGS';

export interface UserScope {
  grades?: number[]; // [6, 7, 8, 9]
  classIds?: string[]; // ['6A1', '6A2']
  subjectIds?: string[]; // ['math', 'literature']
  courseIds?: string[]; // specific Google Classroom IDs
}

const grants: Record<Role, Capability[]> = {
  SYSTEM_SUPER_ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'MANAGE_SCHEDULES',
    'RESOLVE_ALERTS',
    'MANAGE_USERS',
    'MANAGE_INFRASTRUCTURE',
    'RUN_SYNC',
    'MANAGE_CONNECTIONS',
    'MANAGE_CATALOG',
    'VIEW_EXECUTIVE_BI',
    'VIEW_AUDIT_LOGS'
  ],
  SYSTEM_ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'MANAGE_SCHEDULES',
    'RESOLVE_ALERTS',
    'MANAGE_USERS',
    'MANAGE_INFRASTRUCTURE',
    'RUN_SYNC',
    'MANAGE_CONNECTIONS',
    'MANAGE_CATALOG',
    'VIEW_EXECUTIVE_BI',
    'VIEW_AUDIT_LOGS'
  ],
  SCHOOL_ADMIN: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'MANAGE_SCHEDULES',
    'RESOLVE_ALERTS',
    'MANAGE_USERS',
    'RUN_SYNC',
    'MANAGE_CONNECTIONS',
    'MANAGE_CATALOG',
    'VIEW_EXECUTIVE_BI',
    'VIEW_AUDIT_LOGS'
  ],
  PRINCIPAL: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'MANAGE_SCHEDULES',
    'RESOLVE_ALERTS',
    'MANAGE_USERS',
    'RUN_SYNC',
    'MANAGE_CONNECTIONS',
    'MANAGE_CATALOG',
    'VIEW_EXECUTIVE_BI',
    'VIEW_AUDIT_LOGS'
  ],
  VICE_PRINCIPAL: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'MANAGE_SCHEDULES',
    'RESOLVE_ALERTS',
    // Sin chốt 2026-09-25: "thêm tk phó hiệu trưởng quản lý, thêm người
    // cho phân hiệu của mình được. Nhưng chỉ quản lý được người trong
    // phân hiệu của mình thôi" — capability này chỉ MỞ ĐƯỜNG vào route
    // (middleware requireCapability), việc GIỚI HẠN theo đúng cơ sở phụ
    // trách nằm ở logic trong admin.routes.ts (KHÔNG được suy diễn quyền
    // toàn trường từ capability này).
    'MANAGE_USERS',
    'RUN_SYNC',
    'VIEW_EXECUTIVE_BI',
    'VIEW_AUDIT_LOGS'
  ],
  DEPARTMENT_HEAD: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'RESOLVE_ALERTS',
    'VIEW_EXECUTIVE_BI'
  ],
  HOMEROOM: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA',
    'RESOLVE_ALERTS'
  ],
  DATA_VIEWER: [
    'VIEW_DASHBOARD'
  ],
  VIEWER: [
    'VIEW_DASHBOARD'
  ],
  TEACHER: [
    'VIEW_DASHBOARD',
    'VIEW_STUDENT_DATA'
  ]
};

export const can = (r: Role, c: Capability) => grants[r]?.includes(c) ?? false;

