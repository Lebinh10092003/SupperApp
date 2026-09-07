import { auth } from '../config/firebase';
import { env } from '../config/env';

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
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