/**
 * notify-hooks.ts — dựng CÁC HÀM THẬT cho `opts.dispatch`/`opts.pushBell`/
 * `opts.notifyReporter` mà report-flow.ts/incident-lifecycle.ts gọi, port
 * đúng tinh thần `makeDispatchHook`/`makeBellHook`/`makeNotifyReporterHook`
 * ở `index.js` gốc: KHÔNG BAO GIỜ để lỗi gửi kênh ngoài/chuông/email làm
 * hỏng luồng nghiệp vụ chính — bắt lỗi, log lại, trả về giá trị rỗng/false
 * thay vì throw ra ngoài.
 *
 * LƯU Ý QUAN TRỌNG đã tự phát hiện khi nối route thật: `dispatch.ts::
 * dispatchRequest` đọc field snake_case (`notify_request_id`, `object_id`,
 * `event_type`) — ĐÚNG hệt Firestore gốc — nhưng bản ghi `notify_requests`
 * đọc/tạo qua Drizzle lại là camelCase (`notifyRequestId`, `objectId`,
 * `eventType`). report-flow.ts/incident-lifecycle.ts trước giờ chỉ được
 * test bằng `dispatch: async () => {}` (mock rỗng) nên KHÔNG hề lộ ra lệch
 * field này — nếu nối thẳng `db.insert(...).returning()` vào
 * `dispatchRequest` mà không qua `toDispatchRequestData()` bên dưới,
 * `dispatchRequest` sẽ throw "thiếu notify_request_id" ngay lập tức.
 *
 * `adapters` truyền vào ĐANG RỖNG (`{}`) — chưa có SMTP/SMS/voice/FCM thật
 * nào được cấu hình trong repo này (khác bản Firebase gốc dùng Ethereal +
 * admin.messaging()). `dispatchRequest` đã có sẵn nhánh `no_adapter_
 * configured` cho từng kênh/người khi thiếu adapter — KHÔNG throw, chỉ ghi
 * log — nên hệ thống vẫn chạy đúng, chỉ là chưa gửi được ra ngoài thật.
 * Nối SMTP/SMS thật là việc hạ tầng/vận hành riêng, chưa nằm trong phạm vi
 * port logic của Hestia/Killshot.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { dispatchRequest, type RequestData, type DispatchAdapter } from './dispatch.js';
import { pushAdminNotifications, type PushAdminNotificationsInput } from './admin-notify.js';
import { notifyReporterForReport, notifyReporterForIncident } from './reporter-notify.js';
import type { notifyRequests } from './dispatch.schema.js';

type Db = NodePgDatabase<Record<string, never>>;
type NotifyRequestRow = typeof notifyRequests.$inferSelect;

/** Chuyển bản ghi `notify_requests` (camelCase, Drizzle) sang đúng shape snake_case mà `dispatchRequest` đọc. */
function toDispatchRequestData(row: NotifyRequestRow): RequestData {
  return {
    notify_request_id: row.notifyRequestId,
    object_id: row.objectId,
    recipients: row.recipients,
    channels: row.channels,
    message: row.message,
    event_type: row.eventType,
    urgency: row.urgency
  };
}

/** Chưa có adapter thật nào (SMTP/SMS/voice/FCM) — `dispatchRequest` tự xử lý đúng nhánh "no_adapter_configured" cho từng kênh, không throw. */
const ADAPTERS: Partial<Record<string, DispatchAdapter>> = {};

export function makeDispatchHook() {
  return async (db: Db, request: unknown, opts?: { now?: Date }) => {
    try {
      return await dispatchRequest(db, toDispatchRequestData(request as NotifyRequestRow), ADAPTERS, opts);
    } catch (e) {
      console.error('[notify-hooks] dispatchRequest lỗi (không chặn luồng nghiệp vụ chính):', e);
      return null;
    }
  };
}

export function makeBellHook() {
  return async (db: Db, payload: unknown, opts?: { now?: Date }) => {
    try {
      return await pushAdminNotifications(db, payload as PushAdminNotificationsInput, opts);
    } catch (e) {
      console.error('[notify-hooks] pushAdminNotifications lỗi (không chặn luồng nghiệp vụ chính):', e);
      return null;
    }
  };
}

/**
 * Chưa có adapter email thật (SMTP/Ethereal) — `notifyReporterFor*` tự trả
 * `{ sent: false, reason: 'no_adapter_configured' }` khi thiếu, không throw.
 */
export function makeNotifyReporterHook() {
  return async (db: Db, input: { reportId?: string; incidentId?: string; eventType: string }, opts?: { now?: Date }) => {
    try {
      const now = opts?.now ?? new Date();
      if (input.reportId) {
        return await notifyReporterForReport(db, { reportId: input.reportId, eventType: input.eventType }, { now });
      }
      if (input.incidentId) {
        return await notifyReporterForIncident(db, { incidentId: input.incidentId, eventType: input.eventType }, { now });
      }
      return undefined;
    } catch (e) {
      console.error('[notify-hooks] notifyReporterFor* lỗi (không chặn luồng nghiệp vụ chính):', e);
      return undefined;
    }
  };
}
