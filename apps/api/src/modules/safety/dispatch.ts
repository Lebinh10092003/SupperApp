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
            const result = await adapter.send({ to: token, title: requestData.event_type || requestData.urgency || 'Thông báo', body: requestData.message, objectId: requestData.object_id });
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
          result = await adapter.send({ to: contact!.email, subject: `[${requestData.object_id}] ${requestData.event_type || requestData.urgency || ''}`, text: requestData.message });
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
