/**
 * audit.ts — S9 "Nhật ký kiểm toán bất biến", port 1-1 từ `audit.js`. CHỈ
 * ghi thêm — module này CỐ Ý không xuất hàm sửa/xoá bản ghi, kể cả cho vai
 * trò Hiệu trưởng.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { auditLogs } from './audit.schema.js';

export interface AuditRecordInput {
  actorPerId: string;
  onBehalfOfPerId?: string | null;
  roleUsed?: string | null;
  action: string;
  objectId: string;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
  now?: Date;
  ip?: string | null;
  device?: string | null;
}

export interface AuditRecord {
  occurred_at: Date;
  actor_per_id: string;
  on_behalf_of_per_id: string | null;
  role_used: string | null;
  ip: string | null;
  device: string | null;
  action: string;
  object_id: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  request_id: string | null;
  correlation_id: string | null;
}

/** Dựng bản ghi nhật ký đúng cấu trúc bắt buộc. Hàm thuần, không đụng DB. */
export function buildAuditRecord(input: AuditRecordInput): AuditRecord {
  if (!input.actorPerId) throw new Error('audit.buildAuditRecord: thiếu actorPerId — mọi thao tác phải có người thực hiện.');
  if (!input.action) throw new Error('audit.buildAuditRecord: thiếu action.');
  if (!input.objectId) throw new Error('audit.buildAuditRecord: thiếu objectId.');
  return {
    occurred_at: input.now ?? new Date(),
    actor_per_id: input.actorPerId,
    on_behalf_of_per_id: input.onBehalfOfPerId ?? null,
    role_used: input.roleUsed ?? null,
    ip: input.ip ?? null,
    device: input.device ?? null,
    action: input.action,
    object_id: input.objectId,
    before: input.before === undefined ? null : input.before,
    after: input.after === undefined ? null : input.after,
    reason: input.reason ?? null,
    request_id: input.requestId ?? null,
    correlation_id: input.correlationId ?? null
  };
}

/** Các hành động BẮT BUỘC phải có audit log — tự kiểm tra ở tầng gọi (module safety) không quên ghi nhật ký cho hành động nhạy cảm. */
export const MANDATORY_AUDIT_ACTIONS = new Set([
  'auth.login', 'auth.login_failed',
  'incident.view_c3', 'incident.view_c4',
  'incident.priority_changed', 'incident.confidentiality_changed',
  'incident.reassign_commander', 'incident.reopen', 'incident.close',
  'incident.classification_corrected',
  'schedule.event_approved', 'schedule.event_rejected', 'schedule.event_cancelled',
  'data.export', 'data.share',
  'config.catalog_edited', 'config.authz_matrix_edited',
  'privileged_session.action',
  'support_access.granted', 'support_access.action'
]);

export function isMandatoryAuditAction(action: string): boolean {
  return MANDATORY_AUDIT_ACTIONS.has(action);
}

/**
 * Ghi 1 bản ghi — CHỈ insert, không update/delete. `AuditRecord` giữ
 * nguyên field snake_case như bản gốc (khớp `buildAuditRecord`) — chuyển
 * sang camelCase của cột Drizzle ngay tại đây, không đổi shape công khai
 * của `buildAuditRecord`/`AuditRecord` để không phải sửa lại nơi gọi.
 */
export async function writeAuditLog(db: NodePgDatabase<Record<string, never>>, record: AuditRecord): Promise<string> {
  const [row] = await db.insert(auditLogs).values({
    occurredAt: record.occurred_at,
    actorPerId: record.actor_per_id,
    onBehalfOfPerId: record.on_behalf_of_per_id,
    roleUsed: record.role_used,
    ip: record.ip,
    device: record.device,
    action: record.action,
    objectId: record.object_id,
    before: record.before,
    after: record.after,
    reason: record.reason,
    requestId: record.request_id,
    correlationId: record.correlation_id
  }).returning({ logId: auditLogs.logId });
  if (!row) throw new Error('audit.writeAuditLog: ghi nhật ký thất bại, không nhận được log_id.');
  return row.logId;
}
