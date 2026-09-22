import { col } from '../../core/firebase.js';
import { env } from '../../config/env.js';

export const CLASSROOM_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/classroom.courses.readonly',
  'https://www.googleapis.com/auth/classroom.rosters.readonly',
  'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
  'https://www.googleapis.com/auth/classroom.announcements.readonly',
  'https://www.googleapis.com/auth/classroom.topics.readonly',
  'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
  'https://www.googleapis.com/auth/classroom.profile.emails'
];

export interface RefreshResult {
  ok: boolean;
  accessToken?: string;
  expiresIn?: number;
  newRefreshToken?: string;
  source?: 'GOOGLE_OAUTH' | 'OAUTH_PLAYGROUND';
  error?: {
    code: string;
    message: string;
  };
}

export async function getEffectiveOAuthConfig() {
  const cfgDoc = await col('system').doc('oauthConfig').get().catch(() => null);
  const cfg = cfgDoc?.exists ? cfgDoc.data() : null;

  const clientId = cfg?.clientId || env.GOOGLE_OAUTH_CLIENT_ID || '';
  const clientSecret = cfg?.clientSecret || env.GOOGLE_OAUTH_CLIENT_SECRET || '';
  const redirectUri = cfg?.redirectUri || env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:8080/api/connections/oauth/callback';

  const isConfigured = Boolean(
    clientId &&
    !clientId.includes('your-client-id') &&
    clientId.length > 10
  );

  return { clientId, clientSecret, redirectUri, isConfigured };
}

/**
 * Làm mới Access Token từ Google Refresh Token.
 * Hỗ trợ cả 2 cơ chế:
 * 1. Custom Google Cloud OAuth Client (qua https://oauth2.googleapis.com/token)
 * 2. Developer/Playground Refresh Token (qua https://developers.google.com/oauthplayground/refreshAccessToken)
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  credentials?: { clientId?: string | null; clientSecret?: string | null }
): Promise<RefreshResult> {
  const cleanRefreshToken = refreshToken.trim();
  if (!cleanRefreshToken) {
    return {
      ok: false,
      error: {
        code: 'NO_REFRESH_TOKEN',
        message: 'Tài khoản chưa có Refresh Token để làm mới.'
      }
    };
  }

  const oauthCfg = await getEffectiveOAuthConfig();
  const clientId = credentials?.clientId || (oauthCfg.isConfigured ? oauthCfg.clientId : null);
  const clientSecret = credentials?.clientSecret || (oauthCfg.isConfigured ? oauthCfg.clientSecret : null);

  let directErrorText = '';

  // Cách 1: Thử làm mới trực tiếp với Google OAuth Token Endpoint nếu có clientId & clientSecret
  if (clientId && clientSecret && !clientId.includes('your-client-id')) {
    try {
      const directRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: cleanRefreshToken,
          grant_type: 'refresh_token'
        })
      });

      if (directRes.ok) {
        const data = (await directRes.json()) as any;
        return {
          ok: true,
          accessToken: data.access_token,
          expiresIn: Number(data.expires_in) || 3600,
          newRefreshToken: data.refresh_token,
          source: 'GOOGLE_OAUTH'
        };
      }

      directErrorText = await directRes.text();
    } catch (e: any) {
      directErrorText = e.message;
    }
  }

  // Cách 2: Thử làm mới qua Google OAuth Playground endpoint (hỗ trợ refresh token sinh từ Playground)
  try {
    const pgRes = await fetch('https://developers.google.com/oauthplayground/refreshAccessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_uri: 'https://oauth2.googleapis.com/token',
        refresh_token: cleanRefreshToken
      })
    });

    if (pgRes.ok) {
      const data = (await pgRes.json()) as any;
      if (data.access_token) {
        return {
          ok: true,
          accessToken: data.access_token,
          expiresIn: Number(data.expires_in) || 3600,
          newRefreshToken: data.refresh_token,
          source: 'OAUTH_PLAYGROUND'
        };
      }
    }
  } catch (e: any) {
    console.warn('[GoogleToken] OAuth Playground refresh notice:', e.message);
  }

  // Cách 3: Nếu có clientId nhưng không có clientSecret (ví dụ Desktop Client hoặc TokenInfo azp)
  const fallbackClientId = clientId || credentials?.clientId;
  if (fallbackClientId && !fallbackClientId.includes('your-client-id')) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: fallbackClientId,
          refresh_token: cleanRefreshToken,
          grant_type: 'refresh_token'
        })
      });
      if (res.ok) {
        const data = (await res.json()) as any;
        return {
          ok: true,
          accessToken: data.access_token,
          expiresIn: Number(data.expires_in) || 3600,
          newRefreshToken: data.refresh_token,
          source: 'GOOGLE_OAUTH'
        };
      }
      if (!directErrorText) {
        directErrorText = await res.text();
      }
    } catch (_) {}
  }

  // Phân tích thông báo lỗi thân thiện cho người dùng
  let friendlyMsg = 'Không thể làm mới Access Token từ Google.';
  if (directErrorText) {
    try {
      const parsed = JSON.parse(directErrorText);
      if (parsed.error === 'invalid_grant') {
        friendlyMsg = 'Refresh Token đã hết hạn hoặc bị thu hồi. Vui lòng kết nối lại tài khoản Google.';
      } else if (parsed.error === 'invalid_client') {
        friendlyMsg = 'Client ID hoặc Client Secret không khớp với ứng dụng Google OAuth.';
      } else if (parsed.error_description) {
        friendlyMsg = `Lỗi từ Google: ${parsed.error_description}`;
      }
    } catch {
      friendlyMsg = `Lỗi từ Google: ${directErrorText}`;
    }
  }

  return {
    ok: false,
    error: {
      code: 'REFRESH_FAILED',
      message: friendlyMsg
    }
  };
}

/**
 * Lấy Access Token còn hiệu lực cho tài khoản Google đã kết nối.
 * Tự động gia hạn token nếu đã hết hạn hoặc sắp hết hạn (dưới 60 giây).
 */
export async function getValidGoogleAccessToken(userId?: string): Promise<{
  ok: boolean;
  accessToken?: string;
  email?: string;
  name?: string;
  refreshed?: boolean;
  error?: string;
}> {
  const [userConnDoc, currentConnDoc] = await Promise.all([
    userId ? col('googleConnections').doc(userId).get().catch(() => null) : null,
    col('googleConnections').doc('current').get().catch(() => null)
  ]);

  const conn = (userConnDoc?.exists && userConnDoc.data()?.accessToken)
    ? userConnDoc.data()
    : (currentConnDoc?.exists && currentConnDoc.data()?.accessToken ? currentConnDoc.data() : null);

  if (!conn || !conn.accessToken) {
    return { ok: false, error: 'NO_CONNECTION' };
  }

  const isExpired = conn.expiresAt && Date.now() > Number(conn.expiresAt) - 60_000;
  if (!isExpired) {
    return {
      ok: true,
      accessToken: conn.accessToken,
      email: conn.email,
      name: conn.name,
      refreshed: false
    };
  }

  // Token đã hết hạn, cần làm mới qua refreshToken
  if (!conn.refreshToken) {
    return { ok: false, error: 'TOKEN_EXPIRED_NO_REFRESH' };
  }

  const refreshResult = await refreshGoogleAccessToken(conn.refreshToken, {
    clientId: conn.clientId,
    clientSecret: conn.clientSecret
  });

  if (!refreshResult.ok || !refreshResult.accessToken) {
    return { ok: false, error: refreshResult.error?.message || 'TOKEN_REFRESH_FAILED' };
  }

  const expiresIn = refreshResult.expiresIn || 3600;
  const updateData: any = {
    accessToken: refreshResult.accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    tokenExpiresAt: Date.now() + expiresIn * 1000,
    updatedAt: new Date().toISOString()
  };
  if (refreshResult.newRefreshToken) {
    updateData.refreshToken = refreshResult.newRefreshToken;
  }

  await Promise.all([
    userId ? col('googleConnections').doc(userId).set(updateData, { merge: true }).catch(() => null) : null,
    col('googleConnections').doc('current').set(updateData, { merge: true }).catch(() => null)
  ]);

  return {
    ok: true,
    accessToken: refreshResult.accessToken,
    email: conn.email,
    name: conn.name,
    refreshed: true
  };
}
