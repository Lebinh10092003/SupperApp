import { auth } from '../config/firebase';
import { env } from '../config/env';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  // `authStateReady()` — chờ Firebase khôi phục xong phiên đã lưu (persisted
  // session) TRƯỚC KHI đọc `auth.currentUser`. Thiếu bước này, một request
  // bắn ra ngay lúc trang vừa tải (VD `useEffect` gọi API ngay khi mount)
  // có thể chạy TRƯỚC khi Firebase kịp khôi phục `currentUser`, khiến
  // `auth.currentUser` vẫn null dù người dùng ĐÃ đăng nhập thật — request
  // đi ra KHÔNG có token, server trả "Chưa đăng nhập" dù tài khoản hợp lệ
  // (Sin phát hiện 21/09/2026: trang "Tin báo chờ xử lý" hiện banner "Chưa
  // đăng nhập" dù đã đăng nhập bằng tài khoản giáo viên thật).
  await auth.authStateReady().catch(() => undefined);
  const token =
    (await auth.currentUser?.getIdToken().catch(() => undefined)) ||
    localStorage.getItem('gv_dev_token') ||
    undefined;
  const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const url = `${baseUrl}${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  if (!r.ok) {
    const d = await r.json().catch(() => ({ error: { message: r.statusText } }));
    throw new Error(d.error?.message || d.message || r.statusText);
  }
  return (await r.json()) as T;
}

api.get = <T = any>(path: string, init?: RequestInit) => api<T>(path, { ...init, method: 'GET' });
api.post = <T = any>(path: string, body?: any, init?: RequestInit) =>
  api<T>(path, { ...init, method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
api.patch = <T = any>(path: string, body?: any, init?: RequestInit) =>
  api<T>(path, { ...init, method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
api.delete = <T = any>(path: string, init?: RequestInit) => api<T>(path, { ...init, method: 'DELETE' });

export async function download(path: string, name: string) {
  // `authStateReady()` — chờ Firebase khôi phục xong phiên đã lưu (persisted
  // session) TRƯỚC KHI đọc `auth.currentUser`. Thiếu bước này, một request
  // bắn ra ngay lúc trang vừa tải (VD `useEffect` gọi API ngay khi mount)
  // có thể chạy TRƯỚC khi Firebase kịp khôi phục `currentUser`, khiến
  // `auth.currentUser` vẫn null dù người dùng ĐÃ đăng nhập thật — request
  // đi ra KHÔNG có token, server trả "Chưa đăng nhập" dù tài khoản hợp lệ
  // (Sin phát hiện 21/09/2026: trang "Tin báo chờ xử lý" hiện banner "Chưa
  // đăng nhập" dù đã đăng nhập bằng tài khoản giáo viên thật).
  await auth.authStateReady().catch(() => undefined);
  const token =
    (await auth.currentUser?.getIdToken().catch(() => undefined)) ||
    localStorage.getItem('gv_dev_token') ||
    undefined;
  const baseUrl = (env.VITE_API_BASE_URL || '').replace(/\/+$/, '');
  const url = `${baseUrl}${path}`;
  const r = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
  if (!r.ok) throw new Error(await r.text());
  const u = URL.createObjectURL(await r.blob()),
    a = document.createElement('a');
  a.href = u;
  a.download = name;
  a.click();
  URL.revokeObjectURL(u);
}