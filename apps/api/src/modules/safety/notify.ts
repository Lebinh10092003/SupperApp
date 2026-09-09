/**
 * notify.ts — S7 "Thông báo đa kênh và chuyển cấp", port 1-1 từ `notify.js`
 * (project An toàn, Firebase). Phân hệ KHÔNG tự gửi thông báo — chỉ tạo
 * "yêu cầu thông báo"; việc gửi thật qua từng kênh là `dispatch.ts`.
 *
 * Hai ràng buộc quan trọng nhất phải giữ đúng:
 *  - Nội dung thông báo CHỈ được chứa mã đối tượng, mức độ, hành động cần
 *    làm và liên kết mở trong ứng dụng — cấm tuyệt đối danh tính người bị
 *    ảnh hưởng, mô tả C3/C4, hình ảnh/tệp.
 *  - Đường P0 không được phụ thuộc một kênh/dịch vụ có hạn mức theo ngày.
 */

import crypto from 'node:crypto';
import type { Priority } from './catalog.js';

export const URGENCY = { NORMAL: 'normal', HIGH: 'high', P1: 'p1', P0: 'p0' } as const;
export type Urgency = (typeof URGENCY)[keyof typeof URGENCY];

/**
 * Bậc thang kênh. "push" (FCM) là kênh THẬT MIỄN PHÍ duy nhất đánh thức
 * được màn hình khi app đang đóng.
 *
 * SMS + gọi thoại đã BỎ HẲN khỏi bậc thang cho giai đoạn 1 (trường không
 * chi trả 2 dịch vụ này) — thêm lại 'sms'/'voice_call' vào mảng channels
 * dưới đây là bật lại được ngay khi trường quyết định trả phí, không cần
 * viết lại gì. Đường P0 chỉ còn dựa vào in_app + push — cả 2 đều KHÔNG có
 * hạn mức theo ngày, vẫn đúng ràng buộc gốc.
 */
export const CHANNEL_LADDER: Record<Urgency, { channels: string[]; batch: boolean; queue: boolean; simultaneous?: boolean }> = {
  [URGENCY.NORMAL]: { channels: ['in_app'], batch: true, queue: true },
  [URGENCY.HIGH]: { channels: ['in_app', 'email', 'push'], batch: false, queue: true },
  [URGENCY.P1]: { channels: ['in_app', 'email', 'push'], batch: false, queue: false },
  [URGENCY.P0]: { channels: ['in_app', 'push'], batch: false, queue: false, simultaneous: true }
};

export function urgencyForPriority(priority: Priority | string): Urgency {
  if (priority === 'P0') return URGENCY.P0;
  if (priority === 'P1') return URGENCY.P1;
  return URGENCY.NORMAL;
}

export function channelsFor(urgency: Urgency): string[] {
  const spec = CHANNEL_LADDER[urgency];
  if (!spec) throw new Error('notify.channelsFor: mức khẩn không hợp lệ: ' + urgency);
  return [...spec.channels];
}

export function requiresAckEscalation(urgency: Urgency): boolean {
  return urgency === URGENCY.P0 || urgency === URGENCY.P1;
}

/** Dựng nội dung thông báo — CỐ Ý chỉ nhận 4 trường an toàn (đúng "Ràng buộc nội dung"). */
export function renderMessage(input: { objectCode: string; levelLabel?: string | null; actionNeeded: string; deepLink?: string | null }): string {
  if (!input.objectCode || !input.actionNeeded) {
    throw new Error('notify.renderMessage: thiếu objectCode hoặc actionNeeded.');
  }
  const parts = [input.objectCode];
  if (input.levelLabel) parts.push(input.levelLabel);
  parts.push(input.actionNeeded);
  if (input.deepLink) parts.push(input.deepLink);
  return parts.join(' — ');
}

export const FORBIDDEN_PARAM_KEYS = new Set([
  'victimName', 'reporterName', 'description', 'note', 'photoUrl', 'fileUrl', 'address', 'personName'
]);

/** Chặn sớm nếu ai đó cố nhét trường nhạy cảm vào tham số thông báo. */
export function assertSafeParams(params?: Record<string, unknown>): void {
  for (const k of Object.keys(params ?? {})) {
    if (FORBIDDEN_PARAM_KEYS.has(k)) {
      throw new Error(`notify.assertSafeParams: tham số "${k}" có thể chứa dữ liệu nhạy cảm, KHÔNG được đưa vào yêu cầu thông báo.`);
    }
  }
}

/** Khóa chống gửi lặp: 1 người + 1 sự kiện chỉ nhận đúng 1 lần trong cửa sổ gộp. */
export function dedupeKey(recipientId: string, objectId: string, eventType?: string | null): string {
  return crypto.createHash('sha1').update([recipientId, objectId, eventType].join('|')).digest('hex');
}

export interface NotifyRequest {
  recipients: string[];
  urgency: Urgency;
  channels: string[];
  simultaneous: boolean;
  message: string;
  object_id: string;
  event_type: string | null;
  require_ack: boolean;
  status: string;
  attempts: number;
  dedupe_keys: string[];
  created_at: Date | null;
  ack_by: string[];
  last_escalated_at?: Date;
  last_escalated_to?: string;
  acknowledged_at?: Date;
}

/** Tạo NotifyRequest (đưa vào DB ở tầng gọi). objectCode/levelLabel/actionNeeded/deepLink là NỘI DUNG DUY NHẤT được phép hiển thị ra ngoài. */
export function buildNotifyRequest(input: {
  recipients: string[]; priority: Priority | string; objectId: string; objectCode: string;
  levelLabel?: string | null; actionNeeded: string; deepLink?: string | null; eventType?: string | null;
  extraParams?: Record<string, unknown>;
}): NotifyRequest {
  if (!Array.isArray(input.recipients) || input.recipients.length === 0) {
    throw new Error('notify.buildNotifyRequest: thiếu danh sách người nhận.');
  }
  assertSafeParams(input.extraParams);
  const urgency = urgencyForPriority(input.priority);
  const message = renderMessage(input);
  return {
    recipients: input.recipients,
    urgency,
    channels: channelsFor(urgency),
    simultaneous: !!CHANNEL_LADDER[urgency].simultaneous,
    message,
    object_id: input.objectId,
    event_type: input.eventType ?? null,
    require_ack: requiresAckEscalation(urgency),
    status: 'pending',
    attempts: 0,
    dedupe_keys: input.recipients.map((r) => dedupeKey(r, input.objectId, input.eventType)),
    created_at: null, // gắn Date thật ở tầng gọi (tránh phụ thuộc đồng hồ trong module thuần)
    ack_by: []
  };
}

export interface EscalateResult {
  escalated: boolean;
  request: NotifyRequest;
  reason?: string;
  escalatedTo?: string;
}

/** Chuyển cấp khi không có xác nhận trong ngưỡng. `ladder` là mảng perId theo đúng bậc thang đã được Hiệu trưởng phê duyệt trước. */
export function escalate(request: NotifyRequest, input: { ladder: string[]; now?: Date }): EscalateResult {
  if (!request.require_ack) return { escalated: false, request };
  const alreadyNotified = new Set(request.recipients);
  const next = (input.ladder ?? []).find((perId) => !alreadyNotified.has(perId));
  if (!next) {
    return { escalated: false, request, reason: 'Đã hết bậc thang chuyển cấp — cần báo động thủ công (danh bạ khẩn cấp giấy).' };
  }
  const updated: NotifyRequest = {
    ...request,
    recipients: [...request.recipients, next],
    dedupe_keys: [...request.dedupe_keys, dedupeKey(next, request.object_id, request.event_type)],
    attempts: request.attempts + 1,
    last_escalated_at: input.now ?? new Date(),
    last_escalated_to: next
  };
  return { escalated: true, request: updated, escalatedTo: next };
}

/** Ghi nhận một người đã xác nhận + nhận trách nhiệm — dừng chuyển cấp cho request này. */
export function acknowledge(request: NotifyRequest, input: { perId: string; now?: Date }): NotifyRequest {
  if (request.ack_by.includes(input.perId)) return request;
  return {
    ...request,
    ack_by: [...request.ack_by, input.perId],
    status: 'acknowledged',
    acknowledged_at: input.now ?? new Date()
  };
}
