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
 * Sin chốt 2026-09-24: đã nối 2 kênh thật — EMAIL qua Ethereal
 * (`email-adapter.ts`, tới hộp thư test, xem qua link preview) và PUSH qua
 * Web Push chuẩn RFC 8030 (`push-adapter.ts`, KHÔNG cần Firebase Cloud
 * Messaging), áp dụng cho MỌI người nhận (participant/chỉ huy/cấp cao qua
 * `dispatchRequest`, và người báo tin qua `notifyReporterFor*` — riêng
 * kênh push của reporter-notify không áp dụng, người báo tin ẩn danh
 * không có push token). SMS/voice_call KHÔNG dùng (Sin chốt: chỉ cần
 * email + push) — `dispatchRequest` đã có sẵn nhánh `no_adapter_configured`
 * cho 2 kênh này, không throw, hệ thống vẫn chạy đúng.
 */

import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { dispatchRequest, type RequestData, type DispatchAdapter } from './dispatch.js';
import { pushAdminNotifications, type PushAdminNotificationsInput } from './admin-notify.js';
import { notifyReporterForReport, notifyReporterForIncident } from './reporter-notify.js';
import { etherealEmailAdapter } from './email-adapter.js';
import { webPushAdapter } from './push-adapter.js';
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

/** "email" (Ethereal) + "push" (Web Push) đã có adapter thật. SMS/voice_call chưa (không cần theo Sin chốt 2026-09-24 — chỉ dùng email + push). */
const ADAPTERS: Partial<Record<string, DispatchAdapter>> = { email: etherealEmailAdapter, push: webPushAdapter };

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

export function makeNotifyReporterHook() {
  return async (db: Db, input: { reportId?: string; incidentId?: string; eventType: string }, opts?: { now?: Date }) => {
    try {
      const now = opts?.now ?? new Date();
      if (input.reportId) {
        return await notifyReporterForReport(db, { reportId: input.reportId, eventType: input.eventType }, { now, emailAdapter: etherealEmailAdapter });
      }
      if (input.incidentId) {
        return await notifyReporterForIncident(db, { incidentId: input.incidentId, eventType: input.eventType }, { now, emailAdapter: etherealEmailAdapter });
      }
      return undefined;
    } catch (e) {
      console.error('[notify-hooks] notifyReporterFor* lỗi (không chặn luồng nghiệp vụ chính):', e);
      return undefined;
    }
  };
}
