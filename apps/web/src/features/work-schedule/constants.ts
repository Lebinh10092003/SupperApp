/**
 * Hằng số module Lịch công tác — khớp đúng
 * apps/api/src/modules/work-schedule/work-schedule.schema.ts
 * (VALID_EVENT_STATUSES/VALID_TASK_STATUSES/VALID_CAMPUS_IDS/VALID_EVENT_SCOPES).
 * Không tự thêm giá trị ngoài danh sách đó.
 */
import { CAMPUS_LABEL, CAMPUS_IDS } from '../safety/constants';

export { CAMPUS_LABEL, CAMPUS_IDS };

export const EVENT_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Dự thảo',
  PENDING_APPROVAL: 'Chờ duyệt',
  PUBLISHED: 'Đã ban hành',
  REVISION_REQUIRED: 'Cần sửa lại',
  CANCELLED: 'Đã hủy'
};

export const EVENT_STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  DRAFT: { bg: '#f1f5f9', fg: '#475569', border: '#e2e8f0' },
  PENDING_APPROVAL: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  PUBLISHED: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  REVISION_REQUIRED: { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' }
};

export const TASK_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Đã giao',
  ACCEPTED: 'Đã nhận',
  IN_PROGRESS: 'Đang thực hiện',
  PENDING_ACCEPTANCE: 'Chờ nghiệm thu',
  COMPLETED: 'Hoàn thành',
  RETURNED: 'Bị trả lại',
  CANCELLED: 'Đã hủy'
};

export const TASK_STATUS_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  ASSIGNED: { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe' },
  ACCEPTED: { bg: '#f5f3ff', fg: '#6d28d9', border: '#ddd6fe' },
  IN_PROGRESS: { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' },
  PENDING_ACCEPTANCE: { bg: '#fff7ed', fg: '#c2410c', border: '#fed7aa' },
  COMPLETED: { bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  RETURNED: { bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  CANCELLED: { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0' }
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Thấp',
  NORMAL: 'Bình thường',
  HIGH: 'Cao',
  URGENT: 'Khẩn cấp'
};

export const EVENT_SCOPE_LABEL: Record<string, string> = {
  CAMPUS: 'Trong cơ sở',
  SCHOOL_WIDE: 'Toàn trường'
};

export const EVENT_STATUS_STEPS = ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED'] as const;
