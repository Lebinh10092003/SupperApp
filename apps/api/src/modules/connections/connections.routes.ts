import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute } from '../../core/http.js';
import { col, resolveServiceAccount } from '../../core/firebase.js';
import { env } from '../../config/env.js';
import { syncAllCourses } from '../classroom/classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';

export const connectionsRouter = Router();

connectionsRouter.get(
  '/status',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    // 1. Kiểm tra Mode A (Google OAuth cá nhân)
    const [userConnDoc, currentConnDoc] = await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).get(),
      col('googleConnections').doc('current').get()
    ]);
    const conn = userConnDoc.exists && userConnDoc.data()?.accessToken
      ? userConnDoc.data()
      : (currentConnDoc.exists && currentConnDoc.data()?.accessToken ? currentConnDoc.data() : null);

    // 2. Kiểm tra Mode B (Google Workspace DWD)
    const sa = resolveServiceAccount();
    const hasDwd = Boolean(sa?.data?.private_key || (env.WORKSPACE_DOMAIN && env.DWD_SERVICE_ACCOUNT_EMAIL));

    // 3. Đếm số khóa học thực tế đã đồng bộ
    const coursesSnap = await col('courses').get();

    res.json({
      ok: true,
      modeA: {
        connected: Boolean(conn?.accessToken),
        email: conn?.email || null,
        connectedAt: conn?.updatedAt || null
      },
      modeB: {
        configured: Boolean(hasDwd),
        domain: env.WORKSPACE_DOMAIN || 'thcsgiangvo.edu.vn',
        serviceAccount: sa?.data?.client_email || env.DWD_SERVICE_ACCOUNT_EMAIL || null,
        source: sa ? 'FILE_JSON' : 'ENV'
      },
      syncedCoursesCount: coursesSnap.size
    });
  })
);

connectionsRouter.get(
  '/oauth/url',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (_req, res) => {
    if (!env.GOOGLE_OAUTH_CLIENT_ID || env.GOOGLE_OAUTH_CLIENT_ID.includes('your-client-id')) {
      return res.status(400).json({
        ok: false,
        message: 'Chưa cấu hình GOOGLE_OAUTH_CLIENT_ID trong file apps/api/.env (hiện tại là placeholder your-client-id). Vui lòng dán Client ID thật từ Google Cloud Console hoặc dùng Access Token trực tiếp bên dưới.'
      });
    }

    const scopes = [
      'https://www.googleapis.com/auth/classroom.courses.readonly',
      'https://www.googleapis.com/auth/classroom.rosters.readonly',
      'https://www.googleapis.com/auth/classroom.coursework.students.readonly',
      'https://www.googleapis.com/auth/classroom.announcements.readonly',
      'https://www.googleapis.com/auth/classroom.topics.readonly',
      'https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly',
      'https://www.googleapis.com/auth/classroom.profile.emails'
    ];
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      env.GOOGLE_OAUTH_CLIENT_ID || ''
    )}&redirect_uri=${encodeURIComponent(
      env.GOOGLE_OAUTH_REDIRECT_URI || ''
    )}&response_type=code&scope=${encodeURIComponent(
      scopes.join(' ')
    )}&access_type=offline&prompt=consent`;

    res.json({ ok: true, url });
  })
);

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
      // 1. Đổi code lấy Access Token từ Google
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: env.GOOGLE_OAUTH_CLIENT_ID || '',
          client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET || '',
          redirect_uri: env.GOOGLE_OAUTH_REDIRECT_URI || '',
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
      const email = userInfo?.email || 'google_user@thcsgiangvo.edu.vn';
      const uid = userInfo?.id || `user_${Date.now()}`;

      const connData = {
        uid,
        email,
        name: userInfo?.name || email,
        accessToken,
        refreshToken: refreshToken || null,
        expiresAt: Date.now() + (tokens.expires_in || 3600) * 1000,
        updatedAt: new Date().toISOString()
      };

      await col('googleConnections').doc('current').set(connData, { merge: true });
      await col('googleConnections').doc(uid).set(connData, { merge: true });

      // 3. Tự động kéo dữ liệu thật từ Google Classroom ngay lập tức!
      console.log(`[Google Classroom] Đang tự động kéo dữ liệu thật cho tài khoản: ${email}...`);
      const syncResult = await syncAllCourses([], accessToken, email);
      await rebuildDashboard().catch(() => null);
      console.log(`[Google Classroom] Đồng bộ thành công: ${syncResult.success} khóa học.`);

      return res.redirect(`${env.WEB_ORIGIN}/classroom?oauth_success=1&count=${syncResult.success}`);
    } catch (err: any) {
      console.error('Lỗi xử lý callback OAuth:', err);
      return res.redirect(`${env.WEB_ORIGIN}/connections?oauth_error=${encodeURIComponent(err.message)}`);
    }
  })
);

// Nhập trực tiếp Google Access Token (cho trường hợp developer / tester test token thực)
connectionsRouter.post(
  '/token',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (req, res) => {
    const { token, email } = req.body;
    if (!token) {
      return res.status(400).json({ ok: false, error: { message: 'Thiếu Google Access Token' } });
    }

    const connData = {
      uid: req.appUser!.uid,
      email: email || req.appUser!.email,
      accessToken: token,
      updatedAt: new Date().toISOString()
    };

    await col('googleConnections').doc(req.appUser!.uid).set(connData, { merge: true });
    await col('googleConnections').doc('current').set(connData, { merge: true });

    // Đồng bộ ngay lập tức
    const syncResult = await syncAllCourses([], token, connData.email);
    await rebuildDashboard().catch(() => null);

    res.json({
      ok: true,
      message: `Đã kết nối và đồng bộ thành công ${syncResult.success} khóa học từ Google Classroom!`,
      ...syncResult
    });
  })
);

// Lưu file Service Account JSON trực tiếp
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
