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

const CLASSROOM_SCOPES = [
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

async function getEffectiveOAuthConfig() {
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
    const hasDwd = Boolean(sa?.data?.private_key || (env.WORKSPACE_DOMAIN && env.DWD_SERVICE_ACCOUNT_EMAIL));

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

// Nạp dữ liệu mẫu Google Classroom thực tế của THCS Giảng Võ (khi tài khoản Google chưa tạo lớp)
connectionsRouter.post(
  '/demo-seed',
  firebaseAuth,
  requireCapability('MANAGE_CONNECTIONS'),
  asyncRoute(async (_req, res) => {
    const demoCourses = [
      {
        id: 'gv-demo-toan-6a1',
        name: 'Toán Học 6A1 — THCS Giảng Võ',
        section: 'Năm học 2024 - 2025',
        descriptionHeading: 'Môn Toán lớp 6A1 — Thầy Nguyễn Văn A phụ trách',
        room: 'Phòng 201',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/gv-demo-toan-6a1',
        classId: '6A1',
        className: 'Lớp 6A1',
        grade: 6,
        subjectId: 'TOAN',
        subjectName: 'Toán Học',
        creationTime: new Date(Date.now() - 30 * 86400000).toISOString(),
        updateTime: new Date().toISOString(),
        roster: { status: 'COMPLETE', teacherCount: 1, studentCount: 42 },
        content: {
          courseWorkCount: 12,
          materialsCount: 15,
          announcementsCount: 8,
          submissionsTotal: 504,
          submissionsTurnedIn: 480,
          completionRate: 95.2
        }
      },
      {
        id: 'gv-demo-van-7a2',
        name: 'Ngữ Văn 7A2 — THCS Giảng Võ',
        section: 'Năm học 2024 - 2025',
        descriptionHeading: 'Môn Ngữ Văn lớp 7A2 — Cô Trần Thị B',
        room: 'Phòng 204',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/gv-demo-van-7a2',
        classId: '7A2',
        className: 'Lớp 7A2',
        grade: 7,
        subjectId: 'VAN',
        subjectName: 'Ngữ Văn',
        creationTime: new Date(Date.now() - 28 * 86400000).toISOString(),
        updateTime: new Date().toISOString(),
        roster: { status: 'COMPLETE', teacherCount: 1, studentCount: 40 },
        content: {
          courseWorkCount: 10,
          materialsCount: 12,
          announcementsCount: 6,
          submissionsTotal: 400,
          submissionsTurnedIn: 376,
          completionRate: 94.0
        }
      },
      {
        id: 'gv-demo-anh-8a3',
        name: 'Tiếng Anh 8A3 — THCS Giảng Võ',
        section: 'Năm học 2024 - 2025',
        descriptionHeading: 'Môn Tiếng Anh lớp 8A3 — Thầy Lê Văn C',
        room: 'Phòng Lab 1',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/gv-demo-anh-8a3',
        classId: '8A3',
        className: 'Lớp 8A3',
        grade: 8,
        subjectId: 'ANH',
        subjectName: 'Tiếng Anh',
        creationTime: new Date(Date.now() - 25 * 86400000).toISOString(),
        updateTime: new Date().toISOString(),
        roster: { status: 'COMPLETE', teacherCount: 1, studentCount: 41 },
        content: {
          courseWorkCount: 14,
          materialsCount: 20,
          announcementsCount: 10,
          submissionsTotal: 574,
          submissionsTurnedIn: 540,
          completionRate: 94.1
        }
      },
      {
        id: 'gv-demo-tin-6a2',
        name: 'Tin Học 6A2 — THCS Giảng Võ',
        section: 'Năm học 2024 - 2025',
        descriptionHeading: 'Môn Tin học ứng dụng & Lập trình Scratch',
        room: 'Phòng Máy 2',
        courseState: 'ACTIVE',
        alternateLink: 'https://classroom.google.com/c/gv-demo-tin-6a2',
        classId: '6A2',
        className: 'Lớp 6A2',
        grade: 6,
        subjectId: 'TIN',
        subjectName: 'Tin Học',
        creationTime: new Date(Date.now() - 20 * 86400000).toISOString(),
        updateTime: new Date().toISOString(),
        roster: { status: 'COMPLETE', teacherCount: 1, studentCount: 39 },
        content: {
          courseWorkCount: 8,
          materialsCount: 10,
          announcementsCount: 5,
          submissionsTotal: 312,
          submissionsTurnedIn: 298,
          completionRate: 95.5
        }
      }
    ];

    for (const c of demoCourses) {
      await col('courses').doc(c.id).set(c, { merge: true });
    }

    // --- Mở rộng demo-seed (10/09/2026): trước đây CHỈ nạp `courses`, mọi
    // trang khác (Học sinh/Giáo viên/Lớp/Điểm danh/TKB/Cảnh báo/Chuẩn hóa
    // dữ liệu/Audit) vẫn trống vì không có collection nào khác được nạp.
    // Firestore ở dev local là `localStore.ts` — mock IN-MEMORY THUẦN TÚY,
    // không ghi file — nên PHẢI nạp qua chính route này (chạy trong tiến
    // trình server đang sống), không thể nạp bằng script `tsx` riêng (sẽ
    // ghi vào 1 instance bộ nhớ khác, biến mất ngay khi script thoát).
    const classDefs = [
      { classId: '6A1', className: 'Lớp 6A1', grade: 6, subjectId: 'TOAN', subjectName: 'Toán Học', courseId: 'gv-demo-toan-6a1', teacher: { name: 'Nguyễn Văn A', email: 'nguyenvana@thcsgiangvo.edu.vn' } },
      { classId: '7A2', className: 'Lớp 7A2', grade: 7, subjectId: 'VAN', subjectName: 'Ngữ Văn', courseId: 'gv-demo-van-7a2', teacher: { name: 'Trần Thị B', email: 'tranthib@thcsgiangvo.edu.vn' } },
      { classId: '8A3', className: 'Lớp 8A3', grade: 8, subjectId: 'ANH', subjectName: 'Tiếng Anh', courseId: 'gv-demo-anh-8a3', teacher: { name: 'Lê Văn C', email: 'levanc@thcsgiangvo.edu.vn' } },
      { classId: '6A2', className: 'Lớp 6A2', grade: 6, subjectId: 'TIN', subjectName: 'Tin Học', courseId: 'gv-demo-tin-6a2', teacher: { name: 'Phạm Thị D', email: 'phamthid@thcsgiangvo.edu.vn' } }
    ];
    const studentFirstNames = ['An', 'Bình', 'Chi', 'Dũng', 'Giang', 'Hà', 'Khôi', 'Linh', 'Minh', 'Nam'];
    const studentLastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi'];
    const now = new Date();
    const nowIso = now.toISOString();
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);

    let peopleCount = 0;
    for (const cd of classDefs) {
      const teacherId = `demo-teacher-${cd.classId.toLowerCase()}`;
      await col('people').doc(teacherId).set({
        personType: 'TEACHER',
        displayName: cd.teacher.name,
        name: cd.teacher.name,
        email: cd.teacher.email,
        personId: teacherId,
        photoUrl: null,
        orgUnitPath: '/Giáo viên',
        className: cd.className,
        classId: cd.classId,
        courses: [cd.courseId],
        updatedAt: nowIso
      }, { merge: true });
      peopleCount++;

      await col('classes').doc(cd.classId).set({
        classId: cd.classId,
        className: cd.className,
        grade: cd.grade,
        active: true,
        homeroomTeacher: cd.teacher.name,
        courseCount: 1,
        courses: [cd.courseId],
        subjects: [cd.subjectName],
        studentCount: 8,
        totalCoursework: 10,
        submissionsTotal: 80,
        submissionsTurnedIn: 74,
        completionRate: 92.5,
        onTimeRate: 88,
        averageScore: 8.1,
        expectedStudents: 8,
        updatedAt: nowIso
      }, { merge: true });

      for (let i = 0; i < 8; i++) {
        const sid = `demo-student-${cd.classId.toLowerCase()}-${i + 1}`;
        const last = studentLastNames[(i + classDefs.indexOf(cd)) % studentLastNames.length];
        const first = studentFirstNames[i % studentFirstNames.length];
        await col('people').doc(sid).set({
          personType: 'STUDENT',
          displayName: `${last} ${first}`,
          name: `${last} ${first}`,
          email: `${sid}@thcsgiangvo.edu.vn`,
          personId: sid,
          photoUrl: null,
          orgUnitPath: '/Học sinh',
          className: cd.className,
          classId: cd.classId,
          courses: [cd.courseId],
          updatedAt: nowIso
        }, { merge: true });
        peopleCount++;
      }

      // Thời khóa biểu: 1 tiết/lớp vào thứ 2 (dayOfWeek=2, theo đúng quy
      // ước SchedulesPage.tsx: 2=Thứ 2 ... 7=Thứ 7).
      const periodIdx = classDefs.indexOf(cd);
      const startHour = 7 + periodIdx;
      await col('schedules').doc(`demo-sched-${cd.classId.toLowerCase()}`).set({
        dayOfWeek: 2,
        period: periodIdx + 1,
        startTime: `${String(startHour).padStart(2, '0')}:00`,
        endTime: `${String(startHour).padStart(2, '0')}:45`,
        classId: cd.classId,
        className: cd.className,
        subject: cd.subjectName,
        teacherEmail: cd.teacher.email,
        courseId: cd.courseId,
        meetingCode: null,
        spaceName: `spaces/demo-${cd.classId.toLowerCase()}`,
        schoolYear: '2025-2026',
        semester: 'HK1',
        expectedStudents: 8,
        lateMinutes: 10,
        source: 'MANUAL',
        createdAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });

      // Buổi học hôm nay đã kết thúc, có điểm danh đầy đủ.
      const present = 6, late = 1, absent = 1;
      await col('meetSessions').doc(`demo-meet-${cd.classId.toLowerCase()}-${today}`).set({
        date: today,
        conferenceName: `spaces/demo-${cd.classId.toLowerCase()}/conferenceRecords/demo`,
        scheduleId: `demo-sched-${cd.classId.toLowerCase()}`,
        classId: cd.classId,
        className: cd.className,
        subject: cd.subjectName,
        teacherEmail: cd.teacher.email,
        onlineStudents: present + late,
        joinedStudents: present + late,
        status: 'FINISHED',
        dataStatus: 'COMPLETE',
        attendanceStatus: 'COMPLETE',
        present,
        late,
        absent,
        rosterSize: present + late + absent,
        attendanceRate: Math.round(((present + late) / (present + late + absent)) * 1000) / 10,
        lateRate: Math.round((late / (present + late + absent)) * 1000) / 10,
        updatedAt: nowIso
      }, { merge: true });
    }

    // 1 buổi đang diễn ra trực tiếp (cho badge LIVE ở "Hoạt động hôm nay").
    await col('liveSessions').doc('demo-live-6a1').set({
      date: today,
      conferenceName: 'spaces/demo-6a1/conferenceRecords/live-now',
      classId: '6A1',
      className: 'Lớp 6A1',
      subject: 'Toán Học',
      teacherEmail: 'nguyenvana@thcsgiangvo.edu.vn',
      onlineStudents: 7,
      joinedStudents: 7,
      status: 'LIVE',
      dataStatus: 'COMPLETE',
      updatedAt: nowIso
    }, { merge: true });

    // Cảnh báo mẫu — đa dạng mức độ/loại quy tắc, để trung tâm cảnh báo
    // không trống khi test.
    const demoAlerts = [
      { id: 'demo-alert-inactive-6a2', ruleId: 'RULE_INACTIVE_CLASS', title: 'Lớp 6A2 ít hoạt động gần đây', severity: 'WARNING', category: 'CLASSROOM', targetId: '6A2', targetName: 'Lớp 6A2', classId: '6A2', message: 'Không có bài tập/thông báo mới trong 14 ngày qua.', action: 'Liên hệ giáo viên phụ trách để kiểm tra.' },
      { id: 'demo-alert-late-7a2', ruleId: 'RULE_SUBMISSION_LATE', title: 'Tỷ lệ nộp bài trễ cao ở 7A2', severity: 'HIGH', category: 'CLASSROOM', targetId: '7A2', targetName: 'Lớp 7A2', classId: '7A2', message: '24/400 bài nộp trễ hạn trong tháng.', action: 'Nhắc nhở học sinh qua GVCN.' },
      { id: 'demo-alert-absence-8a3', ruleId: 'RULE_ABSENCE_HIGH', title: 'Tỷ lệ vắng mặt bất thường ở 8A3', severity: 'CRITICAL', category: 'CLASSROOM', targetId: '8A3', targetName: 'Lớp 8A3', classId: '8A3', message: 'Vắng mặt vượt ngưỡng cảnh báo trong buổi học hôm nay.', action: 'Xác minh với GVCN và phụ huynh.' }
    ];
    for (const a of demoAlerts) {
      await col('alerts').doc(a.id).set({
        ...a,
        resolved: false,
        status: 'NEW',
        createdAt: nowIso,
        updatedAt: nowIso
      }, { merge: true });
    }

    // Danh mục chuẩn hóa dữ liệu mẫu.
    const demoMappings = [
      { id: 'demo-map-6a1', rawName: '6A1 - Toán', normalizedName: '6A1', type: 'CLASS', grade: 6, subject: 'Toán Học' },
      { id: 'demo-map-7a2', rawName: '7A2-Van', normalizedName: '7A2', type: 'CLASS', grade: 7, subject: 'Ngữ Văn' }
    ];
    for (const m of demoMappings) {
      await col('catalogMappings').doc(m.id).set({ ...m, updatedAt: nowIso }, { merge: true });
    }

    // Nhật ký kiểm toán chung mẫu (module Classroom Audit).
    const demoAudit = [
      { id: 'demo-audit-1', action: 'classroom.sync_run', actor: 'admin@thcsgiangvo.edu.vn', status: 'SUCCESS', entityType: 'sync', entityId: 'demo-sync-1', message: 'Đồng bộ dữ liệu mẫu (DEMO_SEED)', timestamp: nowIso },
      { id: 'demo-audit-2', action: 'alert.created', actor: 'SYSTEM', status: 'SUCCESS', entityType: 'alert', entityId: 'demo-alert-absence-8a3', message: 'Cảnh báo vắng mặt bất thường được tạo tự động.', timestamp: nowIso }
    ];
    for (const a of demoAudit) {
      await col('auditLogs').doc(a.id).set(a, { merge: true });
    }

    await col('system').doc('syncStatus').set({
      lastSyncAt: nowIso,
      mode: 'DEMO_SEED',
      totalCourses: demoCourses.length
    }, { merge: true });

    await rebuildDashboard().catch(() => null);

    res.json({
      ok: true,
      message: `Đã nạp dữ liệu mẫu đầy đủ: ${demoCourses.length} khóa học, ${peopleCount} người (giáo viên+học sinh), ${classDefs.length} lớp, thời khóa biểu, điểm danh hôm nay, ${demoAlerts.length} cảnh báo, chuẩn hóa danh mục, nhật ký kiểm toán.`,
      count: demoCourses.length
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

    const oauthCfg = await getEffectiveOAuthConfig();
    const clientId = conn.clientId || oauthCfg.clientId;
    const clientSecret = conn.clientSecret || oauthCfg.clientSecret;

    const refreshBody: Record<string, string> = {
      refresh_token: conn.refreshToken,
      grant_type: 'refresh_token'
    };
    if (clientId && !clientId.includes('your-client-id')) refreshBody.client_id = clientId;
    if (clientSecret && !clientSecret.includes('your-client-secret')) refreshBody.client_secret = clientSecret;

    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(refreshBody)
    });

    if (!refreshRes.ok) {
      const errText = await refreshRes.text();
      return res.status(400).json({
        ok: false,
        error: {
          code: 'REFRESH_FAILED',
          message: `Lỗi làm mới token từ Google: ${errText}`
        }
      });
    }

    const refreshData = (await refreshRes.json()) as any;
    const newAccessToken = refreshData.access_token;
    const expiresIn = Number(refreshData.expires_in) || 3600;

    const updateData = {
      accessToken: newAccessToken,
      expiresAt: Date.now() + expiresIn * 1000,
      tokenExpiresAt: Date.now() + expiresIn * 1000,
      updatedAt: new Date().toISOString()
    };

    await Promise.all([
      col('googleConnections').doc(req.appUser!.uid).set(updateData, { merge: true }),
      col('googleConnections').doc('current').set(updateData, { merge: true })
    ]);

    res.json({
      ok: true,
      message: `Đã làm mới thành công Access Token Google! Token mới có hiệu lực thêm ${Math.round(expiresIn / 60)} phút.`,
      expiresAt: updateData.expiresAt
    });
  })
);

