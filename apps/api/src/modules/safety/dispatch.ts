/**
 * dispatch.ts — Gửi THẬT các "yêu cầu thông báo" (NotifyRequest) do
 * `notify.ts` dựng ra, qua đúng kênh mà `channelsFor()` đã quyết định.
 * Port 1-1 từ `dispatch.js`.
 *
 * Nhận `adapters` (đối tượng `{ email, sms, voice_call, push }`, mỗi cái
 * có hàm async `send(...)`) — KHÔNG tự gọi thẳng nhà cung cấp SMS/email ở
 * đây, để test được bằng adapter giả (spy) không cần mạng.
 *
 * Danh bạ liên hệ lấy từ bảng `people_directory` (module identity) —
 * trường phải tự nạp trước, KHÔNG suy đoán/tự sinh.
 */

import { eq, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { peopleDirectory } from '../identity/identity.schema.js';
import { notifyRequests } from './dispatch.schema.js';
import { resolvePushTokens, removeInvalidToken } from './push-notify.js';

export interface Contact {
  perId: string;
  email: string | null;
  phone: string | null;
}

export async function resolveContacts(db: NodePgDatabase<Record<string, never>>, perIds: string[]): Promise<Record<string, Contact>> {
  const uniquePerIds = Array.from(new Set(perIds ?? []));
  if (uniquePerIds.length === 0) return {};
  const rows = await db.select().from(peopleDirectory).where(inArray(peopleDirectory.perId, uniquePerIds));
  const out: Record<string, Contact> = {};
  for (const row of rows) {
    out[row.perId] = { perId: row.perId, email: row.email, phone: row.phone };
  }
  return out;
}

export interface DispatchAdapter {
  send: (msg: Record<string, unknown>) => Promise<{ status?: string; previewUrl?: string; invalidToken?: boolean } | undefined>;
}

export interface RequestData {
  notify_request_id: string;
  object_id: string;
  recipients: string[];
  channels: string[];
  message: string;
  event_type?: string | null;
  urgency?: string;
}

/**
 * Tiêu đề thân thiện cho push/email theo `event_type` — Sin phản hồi
 * 2026-09-24 sau khi test thông báo đẩy thật trên điện thoại: server gửi
 * thành công (`dispatch_log` ghi status "sent") nhưng tiêu đề hiện ra là
 * MÃ NỘI BỘ THÔ (VD "safety.sla.overdue") vì trước đây không có map, rơi
 * thẳng vào fallback `requestData.event_type`. Nội dung chi tiết vẫn nằm ở
 * `message` (đã có sẵn, đủ thông tin) — map này CHỈ đổi dòng tiêu đề.
 */
const EVENT_TYPE_TITLE: Record<string, string> = {
  'safety.incident.acknowledged': 'Đã tiếp nhận xử lý sự vụ',
  'safety.incident.acknowledgment_cancelled': 'Đã huỷ tiếp nhận sự vụ',
  'safety.incident.cancel_acknowledgment_rejected': 'Yêu cầu huỷ tiếp nhận bị từ chối',
  'safety.incident.cancel_acknowledgment_requested': 'Yêu cầu huỷ tiếp nhận cần duyệt',
  'safety.incident.commander_assigned': 'Bạn được chỉ định làm chỉ huy sự vụ',
  'safety.incident.commander_reassigned': 'Đã đổi người chỉ huy sự vụ',
  'incident.reassign_commander': 'Đã đổi người chỉ huy sự vụ',
  'safety.incident.homeroom_notified': 'Có sự vụ liên quan lớp bạn phụ trách',
  'safety.incident.merged_duplicate': 'Sự vụ đã được gộp trùng',
  'safety.incident.p0_activated': 'KHẨN CẤP P0 — cần xử lý ngay',
  'safety.incident.p1_escalation_notified': 'Sự vụ P1 cần xử lý gấp',
  'safety.incident.participant_added': 'Bạn được thêm vào xử lý sự vụ',
  'safety.incident.participant_joined': 'Có người mới tham gia xử lý sự vụ',
  'safety.incident.participant_left': 'Có người rời khỏi sự vụ',
  'safety.incident.priority_changed': 'Sự vụ đã đổi mức ưu tiên',
  'safety.incident.unclaimed_reminder': 'Nhắc: sự vụ chưa ai tiếp nhận',
  'safety.incident.unclaimed_urgent': 'CẢNH BÁO: sự vụ vẫn chưa ai tiếp nhận',
  'safety.sla.overdue': 'Đã quá hạn xử lý theo SLA',
  'safety.report.overdue': 'Tin báo chưa xử lý đã quá hạn',
  'safety.report.urgent_notified': 'Tin báo khẩn cấp mới',
  'reporter.confirm_close_requested': 'Cần bạn xác nhận đóng hồ sơ',
  'reporter.notified.closed': 'Hồ sơ của bạn đã được đóng',
  'reporter.notified.in_progress': 'Hồ sơ của bạn đang được xử lý',
  'reporter.notified.received': 'Đã tiếp nhận tin báo của bạn',
  'work_schedule.event.approval_step': 'Lịch công tác đã duyệt 1 bước',
  'work_schedule.event.cancelled': 'Lịch công tác đã bị huỷ',
  'work_schedule.event.created': 'Lịch công tác mới',
  'work_schedule.event.published': 'Lịch công tác đã được ban hành',
  'work_schedule.event.revision_required': 'Lịch công tác cần sửa lại',
  'work_schedule.event.updated_for_revision': 'Lịch công tác đã được sửa lại',
  'work_schedule.task.created': 'Bạn có công việc mới được giao',
  'work_schedule.task.status_changed': 'Công việc đã đổi trạng thái'
};

function friendlyTitle(eventType: string | null | undefined): string {
  if (eventType && EVENT_TYPE_TITLE[eventType]) return EVENT_TYPE_TITLE[eventType]!;
  return 'Thông báo từ SuperApp';
}

export interface DispatchLogEntry {
  channel: string;
  per_id?: string;
  status: string;
  error?: string;
  invalid_token?: boolean;
  preview_url?: string;
  note?: string;
}

/**
 * Gửi 1 NotifyRequest đã lưu qua toàn bộ kênh của nó. KHÔNG throw ra ngoài
 * khi 1 kênh/1 người lỗi — ghi lại lỗi vào dispatch_log để không làm hỏng
 * luồng nghiệp vụ chính, nhưng KHÔNG nuốt lỗi âm thầm: log đầy đủ.
 */
export async function dispatchRequest(
  db: NodePgDatabase<Record<string, never>>,
  requestData: RequestData,
  adapters: Partial<Record<string, DispatchAdapter>>,
  opts?: { now?: Date }
): Promise<DispatchLogEntry[]> {
  const now = opts?.now ?? new Date();
  if (!requestData?.notify_request_id) {
    throw new Error('dispatch.dispatchRequest: thiếu notify_request_id trên requestData.');
  }
  const contacts = await resolveContacts(db, requestData.recipients);
  // "push" tra danh bạ RIÊNG (token trình duyệt, KHÁC email/phone) — chỉ nạp khi kênh push thực sự có mặt.
  const pushTokensByPerId = requestData.channels?.includes('push')
    ? await resolvePushTokens(db, requestData.recipients)
    : {};
  const log: DispatchLogEntry[] = [];

  for (const channel of requestData.channels ?? []) {
    if (channel === 'in_app') {
      // Kênh "trong ứng dụng" = chính bản ghi notify_requests này, không có hành động gửi thêm.
      log.push({ channel, status: 'stored_in_app' });
      continue;
    }
    const adapter = adapters?.[channel];
    if (channel === 'push') {
      // 1 người có thể có NHIỀU token (nhiều thiết bị) — gửi tới TỪNG token.
      for (const perId of requestData.recipients) {
        const tokens = pushTokensByPerId[perId] ?? [];
        if (!adapter) {
          log.push({ channel, per_id: perId, status: 'no_adapter_configured' });
          continue;
        }
        if (!tokens.length) {
          log.push({ channel, per_id: perId, status: 'skipped_no_contact', note: 'Chưa bật thông báo đẩy trên thiết bị nào' });
          continue;
        }
        for (const token of tokens) {
          try {
            const result = await adapter.send({ to: token, title: friendlyTitle(requestData.event_type), body: requestData.message, objectId: requestData.object_id });
            log.push({ channel, per_id: perId, status: result?.status ?? 'sent', ...(result?.invalidToken ? { invalid_token: true } : {}) });
            if (result?.invalidToken) await removeInvalidToken(db, token);
          } catch (e) {
            log.push({ channel, per_id: perId, status: 'error', error: (e as Error).message });
          }
        }
      }
      continue;
    }
    for (const perId of requestData.recipients) {
      const contact = contacts[perId];
      if (!adapter) {
        log.push({ channel, per_id: perId, status: 'no_adapter_configured' });
        continue;
      }
      if (channel === 'email' && !contact?.email) {
        log.push({ channel, per_id: perId, status: 'skipped_no_contact', note: 'Chưa khai báo email trong people_directory' });
        continue;
      }
      if ((channel === 'sms' || channel === 'voice_call') && !contact?.phone) {
        log.push({ channel, per_id: perId, status: 'skipped_no_contact', note: 'Chưa khai báo số điện thoại trong people_directory' });
        continue;
      }
      try {
        let result;
        if (channel === 'email') {
          result = await adapter.send({ to: contact!.email, subject: `[${requestData.object_id}] ${friendlyTitle(requestData.event_type)}`, text: requestData.message });
        } else {
          result = await adapter.send({ to: contact!.phone, body: requestData.message });
        }
        log.push({ channel, per_id: perId, status: result?.status ?? 'sent', ...(result?.previewUrl ? { preview_url: result.previewUrl } : {}) });
      } catch (e) {
        log.push({ channel, per_id: perId, status: 'error', error: (e as Error).message });
      }
    }
  }

  await db.update(notifyRequests)
    .set({ dispatchLog: log, dispatchedAt: now })
    .where(eq(notifyRequests.notifyRequestId, requestData.notify_request_id));

  return log;
}
