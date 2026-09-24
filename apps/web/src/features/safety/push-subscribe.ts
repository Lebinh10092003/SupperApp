/**
 * push-subscribe.ts — đăng ký/huỷ đăng ký thông báo đẩy trình duyệt (Web
 * Push, RFC 8030), bổ sung 2026-09-24. Đăng ký service worker (public/sw.js),
 * xin quyền Notification, subscribe qua PushManager với đúng
 * VITE_VAPID_PUBLIC_KEY, rồi gửi subscription lên
 * `POST /api/safety/push-tokens` (route đã có sẵn, `token` lưu nguyên
 * subscription dạng JSON — xem apps/api/src/modules/safety/push-adapter.ts).
 */
import { api } from '../../services/api';
import { env } from '../../config/env';

export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission;
}

/** VAPID public key (base64url, không padding) -> Uint8Array cần cho `applicationServerKey`. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: 'unsupported' };
  if (!env.VITE_VAPID_PUBLIC_KEY) return { ok: false, reason: 'no_vapid_key' };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return { ok: false, reason: 'permission_denied' };

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(env.VITE_VAPID_PUBLIC_KEY)
    });
  }

  await api.post('/api/safety/push-tokens', { token: JSON.stringify(subscription.toJSON()), userAgent: navigator.userAgent });
  return { ok: true };
}

export async function disablePushNotifications(): Promise<{ ok: boolean }> {
  if (!isPushSupported()) return { ok: false };
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    const token = JSON.stringify(subscription.toJSON());
    await subscription.unsubscribe();
    await api.delete('/api/safety/push-tokens', { body: JSON.stringify({ token }) }).catch(() => {});
  }
  return { ok: true };
}

/** Đã đăng ký push trên CHÍNH thiết bị/trình duyệt này chưa (không phải trên thiết bị khác). */
export async function isPushSubscribedOnThisDevice(): Promise<boolean> {
  if (!isPushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration('/sw.js');
  const subscription = await registration?.pushManager.getSubscription();
  return !!subscription;
}
