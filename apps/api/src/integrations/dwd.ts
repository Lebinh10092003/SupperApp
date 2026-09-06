import { GoogleAuth, JWT } from 'google-auth-library';
import { env } from '../config/env.js';
import { resolveServiceAccount } from '../core/firebase.js';

const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
const cache = new Map<string, { token: string; exp: number }>();

export async function dwdToken(subject: string, scopes: string[]): Promise<string> {
  const key = subject + '|' + scopes.slice().sort().join(' ');
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now() + 120000) return hit.token;

  const sa = resolveServiceAccount();
  const serviceAccountEmail = sa?.data?.client_email || env.DWD_SERVICE_ACCOUNT_EMAIL;
  if (!serviceAccountEmail) {
    throw new Error('DWD_SERVICE_ACCOUNT_EMAIL hoặc Service Account JSON chưa được cấu hình');
  }

  // 1. Nếu có file Service Account JSON (chứa private_key), dùng JWT Client ký cục bộ trực tiếp (Local/Dev/VPS/Production)
  if (sa?.data?.private_key) {
    const jwtClient = new JWT({
      email: sa.data.client_email,
      key: sa.data.private_key,
      scopes: scopes,
      subject: subject
    });
    const res = await jwtClient.getAccessToken();
    if (!res.token) throw new Error('Không thể lấy access token từ Service Account JWT');
    cache.set(key, { token: res.token, exp: Date.now() + 3500 * 1000 });
    return res.token;
  }

  // 2. Nếu chạy trên Cloud Run (Keyless ADC) sử dụng IAM signJwt
  const now = Math.floor(Date.now() / 1000);
  const payload = JSON.stringify({
    iss: serviceAccountEmail,
    sub: subject,
    scope: scopes.join(' '),
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });

  const c = await auth.getClient();
  const at = await c.getAccessToken();
  const sr = await fetch(
    `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:signJwt`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${at.token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ payload })
    }
  );
  if (!sr.ok) throw new Error(await sr.text());
  const { signedJwt } = (await sr.json()) as { signedJwt: string };
  const tr = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt
    })
  });
  if (!tr.ok) throw new Error(await tr.text());
  const data = (await tr.json()) as { access_token: string; expires_in: number };
  cache.set(key, { token: data.access_token, exp: Date.now() + data.expires_in * 1000 });
  return data.access_token;
}

export async function googleJson<T>(
  url: string,
  subject: string,
  scopes: string[],
  init: RequestInit = {}
): Promise<T> {
  const token = await dwdToken(subject, scopes);
  const r = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return (await r.json()) as T;
}

