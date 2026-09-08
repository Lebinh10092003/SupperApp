import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col, resolveServiceAccount } from '../../core/firebase.js';
import { env } from '../../config/env.js';
import { syncAllCourses } from '../classroom/classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';
import {
  CLASSROOM_SCOPES,
  getEffectiveOAuthConfig,
  refreshGoogleAccessToken
} from './google-token.service.js';

export const connectionsRouter = Router();

// Kiểm tra trạng thái kết nối
connectionsRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    // 1. Kiểm tra Mode A (Google OAuth cá nhân)
    const [userConnDoc, currentConnDoc, oauthCfg] = await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).get(),
      col('googleConnections').doc('current').get(),
      getEffectiveOAuthConfig()
    ]);

    const conn = userConnDoc.exists && userConnDoc.data()?.accessToken
      ? userConnDoc.data()
      : (currentConnDoc.exists && currentConnDoc.data()?.accessToken ? currentConnDoc.data() : null);

    // 2. Kiểm tra Mode B (Google Workspace DWD)
    const sa = resolveServiceAccount();
    const hasDwd = Boolean(sa?.data?.private_key);

    // 3. Đếm số khóa học thực tế đã đồng bộ
    const coursesSnap = await col('courses').get();

    res.json({
      ok: true,
      modeA: {
        connected: Boolean(conn?.accessToken),
        email: conn?.email || null,
        name: conn?.name || null,
        connectedAt: conn?.updatedAt || null,
        expiresAt: conn?.expiresAt || conn?.tokenExpiresAt || null,
        hasRefreshToken: Boolean(conn?.refreshToken),
        scopes: conn?.scopes || []
      },
      modeB: {
        configured: Boolean(hasDwd),
        domain: env.WORKSPACE_DOMAIN || 'thcsgiangvo.edu.vn',
        serviceAccount: sa?.data?.client_email || env.DWD_SERVICE_ACCOUNT_EMAIL || null,
        source: sa ? 'FILE_JSON' : 'ENV'
      },
      oauthConfig: {
        configured: oauthCfg.isConfigured,
        clientId: oauthCfg.isConfigured ? oauthCfg.clientId : '',
        redirectUri: oauthCfg.redirectUri,
        scopes: CLASSROOM_SCOPES
      },
      syncedCoursesCount: coursesSnap.size
    });
  })
);

// Lưu hoặc cập nhật OAuth Client ID & Secret trực tiếp từ giao diện
connectionsRouter.post(
  '/oauth-config',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    const { clientId, clientSecret, redirectUri } = req.body;
    if (!clientId || typeof clientId !== 'string') {
      return res.status(400).json({ ok: false, error: { message: 'Client ID không hợp lệ' } });
    }

    const payload = {
      clientId: clientId.trim(),
      clientSecret: clientSecret ? String(clientSecret).trim() : '',
      redirectUri: redirectUri ? String(redirectUri).trim() : 'http://localhost:8080/api/connections/oauth/callback',
      updatedAt: new Date().toISOString()
    };

    await col('system').doc('oauthConfig').set(payload, { merge: true });

    res.json({
      ok: true,
      message: 'Đã lưu cấu hình Google OAuth thành công!',
      oauthConfig: {
        configured: true,
        clientId: payload.clientId,
        redirectUri: payload.redirectUri
      }
    });
  })
);

// Lấy URL chuyển hướng tới Google OAuth
connectionsRouter.get(
  '/oauth/url',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (_req, res) => {
    const oauthCfg = await getEffectiveOAuthConfig();

    if (!oauthCfg.isConfigured) {
      return res.status(400).json({
        ok: false,
        configured: false,
        error: {
          code: 'OAUTH_NOT_CONFIGURED',
          message:
            'Chưa cấu hình GOOGLE_OAUTH_CLIENT_ID. Bạn có thể cấu hình Client ID từ Google Cloud Console ở mục "Cấu hình Google OAuth 2.0 Credentials" bên dưới, hoặc Dán Access Token trực tiếp qua Google OAuth Playground.'
        },
        message:
          'Chưa cấu hình GOOGLE_OAUTH_CLIENT_ID. Bạn có thể cấu hình Client ID từ Google Cloud Console ở mục "Cấu hình Google OAuth 2.0 Credentials" bên dưới, hoặc Dán Access Token trực tiếp qua Google OAuth Playground.'
      });
    }

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      oauthCfg.clientId
    )}&redirect_uri=${encodeURIComponent(
      oauthCfg.redirectUri
    )}&response_type=code&scope=${encodeURIComponent(
      CLASSROOM_SCOPES.join(' ')
    )}&access_type=offline&prompt=consent&include_granted_scopes=true`;

    res.json({ ok: true, url, configured: true });
  })
);

// Xử lý callback OAuth trả về từ Google
connectionsRouter.get(
  '/oauth/callback',
  asyncRoute(async (req, res) => {
    const { code, error } = req.query;
    if (error) {
      return res.redirect(`${env.WEB_ORIGIN}/connections?oauth_error=${encodeURIComponent(String(error))}`);
    }
    if (!code) {
      return res.status(400).send('Thiếu mã xác thực OAuth từ Google');
    }

    try {
      const oauthCfg = await getEffectiveOAuthConfig();

      // 1. Đổi code lấy Access Token từ Google
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: oauthCfg.clientId,
          client_secret: oauthCfg.clientSecret,
          redirect_uri: oauthCfg.redirectUri,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        console.error('Google OAuth token error:', err);
        return res.redirect(`${env.WEB_ORIGIN}/connections?oauth_error=${encodeURIComponent(err)}`);
      }

      const tokens = (await tokenRes.json()) as any;
      const accessToken = tokens.access_token;
      const refreshToken = tokens.refresh_token;

      // 2. Lấy email và tên tài khoản Google
      const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const userInfo = userInfoRes.ok ? await userInfoRes.json() : null;
      const email = userInfo?.email || '09.levanbinh2003@gmail.com';
      const uid = userInfo?.id || `user_${Date.now()}`;

      const connData = {
        uid,
        email,
        name: userInfo?.name || email,
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        scopes: tokens.scope ? String(tokens.scope).split(' ') : CLASSROOM_SCOPES,
        updatedAt: new Date().toISOString()
      };

      await col('googleConnections').doc('current').set(connData, { merge: true });
      await col('googleConnections').doc(uid).set(connData, { merge: true });

      // 3. Tự động kéo dữ liệu thật từ Google Classroom ngay lập tức
      console.log(`[Google Classroom] Đang tự động kéo dữ liệu thật cho tài khoản: ${email}...`);
      const syncResult = await syncAllCourses([], accessToken, email);
      await rebuildDashboard().catch(() => null);
      console.log(`[Google Classroom] Đồng bộ thành công: ${syncResult.success} khóa học.`);

      return res.redirect(
        `${env.WEB_ORIGIN}/connections?oauth_success=1&count=${syncResult.success}&email=${encodeURIComponent(email)}`
      );
    } catch (err: any) {
      console.error('Lỗi xử lý callback OAuth:', err);
      return res.redirect(`${env.WEB_ORIGIN}/connections?oauth_error=${encodeURIComponent(err.message)}`);
    }
  })
);

// Nhập trực tiếp Google Access Token (cho trường hợp developer / tester test token thực qua OAuth Playground)
connectionsRouter.post(
  '/token',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    const { token, refreshToken, email } = req.body;
    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({ ok: false, error: { message: 'Vui lòng cung cấp chuỗi Google Access Token hợp lệ (bắt đầu bằng ya29...)' } });
    }

    const cleanToken = token.trim();
    const cleanRefreshToken = refreshToken && typeof refreshToken === 'string' ? refreshToken.trim() : null;

    // 1. Xác thực token trực tiếp với Google API (tokeninfo & userinfo)
    let tokenInfo: any = null;
    let userInfo: any = null;

    try {
      const [tokenInfoRes, userInfoRes] = await Promise.all([
        fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(cleanToken)}`),
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${cleanToken}` }
        })
      ]);

      if (tokenInfoRes.ok) {
        tokenInfo = await tokenInfoRes.json();
      }
      if (userInfoRes.ok) {
        userInfo = await userInfoRes.json();
      }
    } catch (e: any) {
      console.warn('Google token verification notice:', e.message);
    }

    // Nếu cả 2 đều báo lỗi không hợp lệ (thường là 400 Invalid Value hoặc 401 Unauthorized)
    if (!tokenInfo?.email && !userInfo?.email && tokenInfo?.error) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'INVALID_OR_EXPIRED_TOKEN',
          message:
            'Google Access Token không hợp lệ hoặc đã hết hạn. Vui lòng lấy Token mới từ Google OAuth Playground (https://developers.google.com/oauthplayground) với tài khoản của bạn.'
        }
      });
    }

    const resolvedEmail =
      userInfo?.email ||
      tokenInfo?.email ||
      email?.trim() ||
      req.appUser!.email ||
      '09.levanbinh2003@gmail.com';

    const expiresIn = Number(tokenInfo?.expires_in) || 3600;
    const scopes = tokenInfo?.scope ? String(tokenInfo.scope).split(' ') : [];

    const connData: any = {
      uid: req.appUser!.uid,
      email: resolvedEmail,
      name: userInfo?.name || resolvedEmail,
      accessToken: cleanToken,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenExpiresAt: Date.now() + expiresIn * 1000,
      scopes,
      clientId: tokenInfo?.azp || tokenInfo?.aud || null,
      updatedAt: new Date().toISOString()
    };
    if (cleanRefreshToken) {
      connData.refreshToken = cleanRefreshToken;
    }

    await col('googleConnections').doc(req.appUser!.uid).set(connData, { merge: true });
    await col('googleConnections').doc('current').set(connData, { merge: true });

    // 2. Đồng bộ các khóa học thực tế từ Google Classroom
    let syncResult: any = { success: 0, courses: 0, errors: [] };
    try {
      syncResult = await syncAllCourses([], cleanToken, connData.email);
      await rebuildDashboard().catch(() => null);
    } catch (err: any) {
      console.error('Lỗi khi đồng bộ qua token:', err.message);
      return res.status(400).json({
        ok: false,
        error: {
          code: 'CLASSROOM_SYNC_ERROR',
          message: `Kết nối thành công nhưng đồng bộ Google Classroom gặp sự cố: ${err.message}`
        }
      });
    }

    res.json({
      ok: true,
      email: connData.email,
      name: connData.name,
      expiresIn,
      message:
        syncResult.success > 0
          ? `Đã kết nối tài khoản Google (${connData.email}) và đồng bộ thành công ${syncResult.success} khóa học từ Google Classroom!`
          : `Đã kết nối tài khoản Google (${connData.email}) thành công! (Hiện tại tài khoản chưa có khóa học nào trên Google Classroom).`,
      ...syncResult
    });
  })
);

// Xóa sạch toàn bộ dữ liệu mẫu / demo nếu từng được nạp thử nghiệm
connectionsRouter.post(
  '/purge-demo',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (_req, res) => {
    const coursesSnap = await col('courses').get();
    let deletedCount = 0;

    for (const doc of coursesSnap.docs) {
      if (doc.id.startsWith('gv-demo-') || doc.id.includes('demo')) {
        await col('courses').doc(doc.id).delete();
        deletedCount++;
      }
    }

    const syncStatusDoc = await col('system').doc('syncStatus').get();
    if (syncStatusDoc.exists && syncStatusDoc.data()?.mode === 'DEMO_SEED') {
      await col('system').doc('syncStatus').delete();
    }

    const { rebuildDashboard } = await import('../dashboard/dashboard.service.js');
    await rebuildDashboard().catch(() => null);

    res.json({
      ok: true,
      message: `Đã dọn dẹp sạch sẽ ${deletedCount} khóa học mẫu thử nghiệm khỏi hệ thống!`,
      deletedCount
    });
  })
);

// Lưu file Service Account JSON trực tiếp (Mode B)
connectionsRouter.post(
  '/service-account',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    const { jsonContent } = req.body;
    if (!jsonContent) {
      return res.status(400).json({ ok: false, error: { message: 'Thiếu nội dung JSON Service Account' } });
    }

    let parsed: any;
    try {
      parsed = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
      if (!parsed.private_key || !parsed.client_email) {
        throw new Error('File JSON phải chứa private_key và client_email');
      }
    } catch (e: any) {
      return res.status(400).json({ ok: false, error: { message: `JSON không hợp lệ: ${e.message}` } });
    }

    const targetPath = path.resolve(process.cwd(), 'service-account.json');
    fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf-8');

    // Thử đồng bộ toàn trường qua Mode B DWD
    let syncResult: { success: number; courses: number; errors?: any[]; runId?: string } = { success: 0, courses: 0 };
    if (env.WORKSPACE_ADMIN_SUBJECT) {
      try {
        syncResult = await syncAllCourses([env.WORKSPACE_ADMIN_SUBJECT], undefined, 'DWD_SERVICE_ACCOUNT');
        await rebuildDashboard().catch(() => null);
      } catch (err: any) {
        console.warn('DWD sync notice:', err.message);
      }
    }

    res.json({
      ok: true,
      message: `Đã lưu Service Account cho ${parsed.client_email}. Đã đồng bộ ${syncResult.success} khóa học.`,
      clientEmail: parsed.client_email,
      ...syncResult
    });
  })
);

// Ngắt kết nối tài khoản Google
connectionsRouter.post(
  '/disconnect',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).delete(),
      col('googleConnections').doc('current').delete()
    ]);
    res.json({ ok: true, message: 'Đã ngắt kết nối tài khoản Google thành công' });
  })
);

// Làm mới Access Token thủ công hoặc kiểm tra tính năng tự gia hạn của Refresh Token
connectionsRouter.post(
  '/refresh',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    const [userConnDoc, currentConnDoc] = await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).get(),
      col('googleConnections').doc('current').get()
    ]);
    const conn = userConnDoc.exists && userConnDoc.data()?.refreshToken
      ? userConnDoc.data()
      : (currentConnDoc.exists && currentConnDoc.data()?.refreshToken ? currentConnDoc.data() : null);

    if (!conn || !conn.refreshToken) {
      return res.status(400).json({
        ok: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Tài khoản chưa lưu Refresh Token. Bạn hãy dán mã Refresh Token vào mục Chế độ A để kích hoạt tự động gia hạn vĩnh viễn.'
        }
      });
    }

    const refreshResult = await refreshGoogleAccessToken(conn.refreshToken, {
      clientId: conn.clientId,
      clientSecret: conn.clientSecret
    });

    if (!refreshResult.ok || !refreshResult.accessToken) {
      return res.status(400).json({
        ok: false,
        error: refreshResult.error || {
          code: 'REFRESH_FAILED',
          message: 'Không thể làm mới token từ Google.'
        }
      });
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
      col('googleConnections').doc(req.appUser!.uid).set(updateData, { merge: true }),
      col('googleConnections').doc('current').set(updateData, { merge: true })
    ]);

    res.json({
      ok: true,
      message: `Đã làm mới thành công Access Token Google! Token mới có hiệu lực thêm ${Math.round(expiresIn / 60)} phút.`,
      expiresAt: updateData.expiresAt,
      source: refreshResult.source
    });
  })
);

