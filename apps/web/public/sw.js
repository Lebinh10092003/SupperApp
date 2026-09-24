// sw.js — Service Worker cho thông báo đẩy (Web Push, RFC 8030), bổ sung
// 2026-09-24. CHỈ xử lý 2 việc: nhận sự kiện "push" từ server (qua
// web-push, xem apps/api/src/modules/safety/push-adapter.ts) rồi hiện
// notification hệ điều hành, và điều hướng đúng trang khi người dùng bấm
// vào notification đó. KHÔNG cache tài nguyên gì (không phải PWA offline).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Thông báo', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Thông báo';
  const options = {
    body: data.body || '',
    icon: '/logo-truong-favicon.png',
    badge: '/logo-truong-favicon.png',
    data: { deepLink: data.deepLink || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const deepLink = (event.notification.data && event.notification.data.deepLink) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(deepLink);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(deepLink);
    })
  );
});
