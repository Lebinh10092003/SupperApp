/**
 * push-adapter.ts — Adapter "push" THẬT đầu tiên (Sin chốt 2026-09-24, sau
 * email — người dùng chỉ cần email + push, KHÔNG cần SMS). Dùng chuẩn Web
 * Push (RFC 8030, thư viện `web-push`) — hoạt động trên mọi trình duyệt hỗ
 * trợ Push API (Chrome/Edge/Firefox...) qua Service Worker, KHÔNG cần
 * Firebase Cloud Messaging hay bất kỳ tài khoản dịch vụ trả phí nào.
 *
 * `push_tokens.token` (dispatch.schema.ts) vốn thiết kế cho 1 chuỗi FCM
 * token đơn — Web Push subscription là 1 OBJECT {endpoint, keys:{p256dh,
 * auth}}, không phải chuỗi đơn. Không đổi schema (cột vẫn `text`) — lưu
 * NGUYÊN subscription dạng JSON.stringify() vào đúng cột đó, parse lại khi
 * gửi. `token` vẫn là khoá chính hợp lệ (chuỗi JSON của 1 subscription là
 * duy nhất theo thiết bị/trình duyệt, đúng tinh thần cũ).
 */

import webpush from 'web-push';
import { env } from '../../config/env.js';
import type { DispatchAdapter } from './dispatch.js';

let configured = false;
function ensureConfigured() {
  if (configured) return;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    throw new Error('push-adapter: thiếu VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY trong .env — chạy `npx web-push generate-vapid-keys` để tạo.');
  }
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
}

export const webPushAdapter: DispatchAdapter = {
  async send(msg) {
    ensureConfigured();
    const { to, title, body, objectId } = msg as { to?: string; title?: string; body?: string; objectId?: string };
    if (!to) throw new Error('push-adapter: thiếu "to" (subscription JSON).');
    let subscription: webpush.PushSubscription;
    try {
      subscription = JSON.parse(to);
    } catch {
      throw new Error('push-adapter: "to" không phải JSON subscription hợp lệ.');
    }
    try {
      await webpush.sendNotification(
        subscription,
        JSON.stringify({ title: title || 'Thông báo', body: body || '', objectId: objectId || null, deepLink: objectId ? '/safety/incidents/' + objectId : undefined })
      );
      return { status: 'sent' };
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode;
      // 404/410 = subscription hết hạn/trình duyệt huỷ đăng ký — dispatch.ts
      // tự xoá token khỏi DB khi thấy invalidToken:true (không throw ở
      // đây, coi như 1 kết quả gửi bình thường, không phải lỗi hệ thống).
      if (statusCode === 404 || statusCode === 410) {
        return { status: 'invalid', invalidToken: true };
      }
      throw e;
    }
  }
};
