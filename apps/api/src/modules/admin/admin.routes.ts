import { Router } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { firebaseAuth, requireCapability } from '../../auth/middleware.js';
import { asyncRoute, HttpError } from '../../core/http.js';
import { db } from '../../core/db/client.js';
import { safeId } from '../../core/ids.js';
import { adminAuth } from '../../core/firebase.js';
import { syncDirectory, teacherEmails } from '../directory/directory.service.js';
import { syncAllCourses } from '../classroom/classroom.service.js';
import { rebuildDashboard } from '../dashboard/dashboard.service.js';
import { users, accessAllowlist } from '../session/session.schema.js';
import { generalAuditLogs } from '../audit/audit.schema.js';
import { accounts, assignments, peopleDirectory } from '../identity/identity.schema.js';
import { ROLE } from '../safety/catalog.js';
import { loadActorContext } from '../identity/actor-context.js';
import {
  listHomeroomAssignments,
  listGradeSupervisorAssignments,
  upsertHomeroomAssignment,
  upsertGradeSupervisorAssignment,
  deleteHomeroomAssignment,
  deleteGradeSupervisorAssignment
} from '../safety/directory-assignments.js';

const roles = [
  'SYSTEM_SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'VICE_PRINCIPAL',
  'DEPARTMENT_HEAD',
  'DATA_VIEWER',
  'TEACHER',
  'SYSTEM_ADMIN',
  'PRINCIPAL',
  'HOMEROOM',
  'VIEWER'
] as const;

export const adminRouter = Router();

adminRouter.post(
  '/full-sync',
  firebaseAuth,
  requireCapability('RUN_SYNC'),
  asyncRoute(async (_q, r) => {
    const directory = await syncDirectory();
    const classroom = await syncAllCourses(await teacherEmails());
    const dashboard = await rebuildDashboard();
    r.json({ ok: true, directory, classroom, dashboardUpdated: !!dashboard });
  })
);

adminRouter.get(
  '/access',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (_q, r) => {
    const [u, a] = await Promise.all([db.select().from(users), db.select().from(accessAllowlist)]);
    r.json({ users: u, allowlist: a });
  })
);

adminRouter.post(
  '/access',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const b = z
      .object({
        email: z.string().email(),
        role: z.enum(roles),
        active: z.boolean().default(true),
        scope: z
          .object({
            grades: z.array(z.number()).optional(),
            classIds: z.array(z.string()).optional(),
            subjectIds: z.array(z.string()).optional(),
            courseIds: z.array(z.string()).optional()
          })
          .optional()
      })
      .parse(q.body);

    const email = b.email.toLowerCase();

    // Chỉ SYSTEM_SUPER_ADMIN mới được gán vai trò SYSTEM_SUPER_ADMIN
    if (b.role === 'SYSTEM_SUPER_ADMIN' && q.appUser?.role !== 'SYSTEM_SUPER_ADMIN' && q.appUser?.role !== 'SYSTEM_ADMIN') {
      throw new HttpError(403, 'Chỉ Quản trị viên cấp cao nhất mới có quyền cấp quyền SYSTEM_SUPER_ADMIN', 'PERMISSION_ERROR');
    }

    const allowlistId = safeId(email);
    await db
      .insert(accessAllowlist)
      .values({ id: allowlistId, email, role: b.role, active: b.active })
      .onConflictDoUpdate({ target: accessAllowlist.id, set: { role: b.role, active: b.active } });

    await db
      .update(users)
      .set({ role: b.role, active: b.active, scope: b.scope || null, updatedAt: new Date() })
      .where(eq(users.email, email));

    // Ghi nhận Audit Log hệ thống (dùng chung general_audit_logs, không tạo
    // thêm bảng riêng — systemAuditLogs bản Firestore cũ trùng mục đích).
    await db.insert(generalAuditLogs).values({
      action: 'UPDATE_USER_ACCESS',
      actor: q.appUser!.email,
      entityType: 'user',
      entityId: email,
      message: `role=${b.role} active=${b.active}${b.scope ? ' scope=' + JSON.stringify(b.scope) : ''}`
    });

    r.json({ ok: true });
  })
);

adminRouter.delete(
  '/access/:email',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const email = decodeURIComponent(String(q.params.email || '')).toLowerCase();
    if (q.appUser?.email === email) {
      throw new HttpError(400, 'Không thể tự thu hồi quyền của chính mình', 'INVALID_OPERATION');
    }

    await db.delete(accessAllowlist).where(eq(accessAllowlist.id, safeId(email)));
    await db.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.email, email));

    await db.insert(generalAuditLogs).values({
      action: 'REVOKE_USER_ACCESS',
      actor: q.appUser!.email,
      entityType: 'user',
      entityId: email
    });

    r.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Quản lý người dùng — port lại tính năng "Quản lý người dùng" từng có ở
// Hub cũ (public/hub/index.html, functions adminListUsers/adminCreateUser/
// adminUpdateUser/adminResetUserPassword) — bị thiếu khi migrate sang
// SuperApp. Route này ghi CẢ HAI: accounts/assignments/people_directory
// (identity — MỘT vai trò R.* dùng CHUNG cho cả module An toàn lẫn Lịch
// công tác, xem identity.schema.ts) VÀ access_allowlist (session, gác cửa
// đăng nhập /api/session/bootstrap) — thiếu 1 trong 2 là tài khoản tạo
// xong không đăng nhập được hoặc đăng nhập được nhưng không có quyền gì
// (bug thật gặp khi nạp 249 tài khoản thật 13/09/2026, xem
// SUPERAPP_MIGRATION_COORDINATION).
//
// QUAN TRỌNG (Sin làm rõ 13/09/2026): KHÔNG có khái niệm "vai trò module An
// toàn" tách biệt "vai trò hệ thống" — chỉ có DUY NHẤT 1 vai trò R.* mỗi
// người, mỗi module (nav-level app, An toàn, Lịch công tác...) tự diễn giải
// vai trò đó theo đúng phân cấp của module mình (xem
// work-schedule.authz.ts đọc thẳng cùng bảng `assignments`). `/access` ở
// trên (access_allowlist) giờ CHỈ còn là giá trị PHÁI SINH tự động qua
// mapRoleToAppRole() bên dưới để nav cấp app hiển thị đúng, KHÔNG phải nơi
// admin tự chọn 1 vai trò khác — UI (AdminPage.tsx) chỉ còn đúng 1 form
// Thêm/Sửa dùng route /safety-users.
//
// R.HOMEROOM/R.INCIDENT_CMD/R.REPORTER CỐ Ý không cho gán ở đây: HOMEROOM
// suy tự động qua homeroom_assignments (lớp -> perId, xem
// directory-assignments.ts), INCIDENT_CMD gán theo đúng 1 hồ sơ (không
// phải chức danh cố định), REPORTER không phải nhân sự nội bộ.
// ---------------------------------------------------------------------------

const ASSIGNABLE_SAFETY_ROLES = [
  ROLE.PRINCIPAL,
  ROLE.VICE_PRINCIPAL,
  ROLE.DUTY_OFFICER,
  ROLE.DEPT_HEAD,
  ROLE.OFFICE_ADMIN,
  ROLE.TEACHER,
  ROLE.HEALTH,
  ROLE.COUNSELOR,
  ROLE.SECURITY,
  ROLE.FACILITY,
  ROLE.SYS_ADMIN,
  ROLE.AUDITOR,
  ROLE.EXTERNAL
] as const;

const CAMPUS_IDS = ['MAIN_CAMPUS', 'CAMPUS_1', 'CAMPUS_2'] as const;

/** Vai trò R.* (1 vai trò dùng chung toàn hệ thống) -> vai trò cấp app (access_allowlist/users), chỉ để nav/route-gate hiển thị đúng — KHÔNG ảnh hưởng authz 9 bước thật (luôn đọc từ assignments), giá trị này PHÁI SINH tự động, admin không tự chọn riêng. */
function mapSafetyRoleToAppRole(roleId: string, isHomeroomTeacher: boolean): (typeof roles)[number] {
  if (roleId === ROLE.PRINCIPAL) return 'PRINCIPAL';
  if (roleId === ROLE.VICE_PRINCIPAL) return 'VICE_PRINCIPAL';
  if (roleId === ROLE.DEPT_HEAD) return 'DEPARTMENT_HEAD';
  if (roleId === ROLE.SYS_ADMIN) return 'SYSTEM_ADMIN';
  if (roleId === ROLE.EXTERNAL) return 'VIEWER';
  if (isHomeroomTeacher) return 'HOMEROOM';
  return 'TEACHER';
}

function genPerId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `PER_${s}`;
}

adminRouter.get(
  '/safety-users',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (_q, r) => {
    // Nguồn DANH SÁCH GỐC đổi từ `accounts` (chỉ có người ĐÃ đăng nhập ít
    // nhất 1 lần) sang `access_allowlist` (toàn bộ người trường cấp quyền,
    // kể cả CHƯA từng đăng nhập) — để admin xem/gán vai trò trước cho cả
    // người chưa đăng nhập (xem README + auto-link.ts). `accounts`/
    // `assignments`/`people_directory` giờ chỉ là dữ liệu LEFT JOIN thêm
    // vào, không còn là gốc.
    const [allowlistRows, accountRows, assignmentRows, directoryRows] = await Promise.all([
      db.select().from(accessAllowlist),
      db.select().from(accounts),
      db.select().from(assignments),
      db.select().from(peopleDirectory)
    ]);
    const assignmentByPerId = new Map(assignmentRows.map((a) => [a.perId, a]));
    const directoryByPerId = new Map(directoryRows.map((d) => [d.perId, d]));
    const directoryByEmail = new Map(directoryRows.map((d) => [(d.email || '').toLowerCase(), d]));
    const accountByEmail = new Map(accountRows.map((a) => [a.email.toLowerCase(), a]));

    // Trạng thái khoá đọc thẳng từ Firebase Auth (KHÔNG lưu lại ở Postgres
    // — tránh 2 nguồn sự thật lệch nhau). listUsers phân trang 1000/lần,
    // quy mô trường hiện tại (<1000 tài khoản) chỉ cần 1 lần gọi.
    //
    // Best-effort: môi trường CHƯA có Firebase service account thật (VPS
    // này) khiến lệnh này LUÔN lỗi app/invalid-credential — trước đây lỗi
    // này ném thẳng ra ngoài, sập NGUYÊN route (kể cả phần dữ liệu Postgres
    // đọc thành công ở trên cũng mất theo). Giờ bọc try/catch, fallback
    // disabled=false cho mọi người khi không đọc được, không chặn hiển thị
    // danh sách vì đây chỉ là 1 trường bổ sung, không phải dữ liệu gốc.
    const disabledByUid = new Map<string, boolean>();
    try {
      let pageToken: string | undefined;
      do {
        const page = await adminAuth.listUsers(1000, pageToken);
        for (const u of page.users) disabledByUid.set(u.uid, u.disabled);
        pageToken = page.pageToken;
      } while (pageToken);
    } catch (e) {
      console.error('[admin/safety-users] adminAuth.listUsers() lỗi, bỏ qua trạng thái khoá:', e);
    }

    const result = allowlistRows.map((al) => {
      const email = al.email.toLowerCase();
      const acc = accountByEmail.get(email);
      const dir = acc ? directoryByPerId.get(acc.perId) : directoryByEmail.get(email);
      const perId = acc?.perId ?? dir?.perId ?? null;
      const a = perId ? assignmentByPerId.get(perId) : undefined;
      return {
        // uid null = CHƯA từng đăng nhập — FE phải tự xử lý (không có các
        // hành động cần Firebase Auth thật: đổi mật khẩu/khoá tài khoản).
        uid: acc?.uid ?? null,
        perId,
        displayName: acc?.displayName || dir?.displayName || al.email,
        email: al.email,
        phone: dir?.phone ?? null,
        roleId: a?.roleId ?? null,
        campusId: a?.campusId ?? null,
        domain: a?.domain ?? null,
        disabled: acc ? (disabledByUid.get(acc.uid) ?? false) : false,
        loggedInBefore: !!acc
      };
    });

    r.json({ users: result });
  })
);

adminRouter.post(
  '/safety-users',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const b = z
      .object({
        displayName: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(6),
        roleId: z.enum(ASSIGNABLE_SAFETY_ROLES),
        campusId: z.enum(CAMPUS_IDS).nullable().optional(),
        domain: z.string().nullable().optional()
      })
      .parse(q.body);

    if (b.roleId === ROLE.DEPT_HEAD && !b.domain?.trim()) {
      throw new HttpError(400, 'Vai trò Tổ trưởng bắt buộc nhập Lĩnh vực/Tổ', 'INVALID_INPUT');
    }

    const email = b.email.toLowerCase();
    const existingByEmail = await adminAuth.getUserByEmail(email).catch(() => null);
    if (existingByEmail) {
      throw new HttpError(409, 'Email này đã có tài khoản trong hệ thống', 'INVALID_OPERATION');
    }

    // Cần Firebase Admin credentials thật (service account) để tạo tài
    // khoản trực tiếp — môi trường CHƯA có (xem README bàn giao). Với
    // người đã có trong danh sách trường cấp quyền (access_allowlist),
    // dùng route PATCH /safety-users/pending/:email thay vì route này —
    // không cần tạo tài khoản Firebase mới, chỉ gán vai trò trước, tài
    // khoản thật tự sinh khi chính người đó đăng nhập bằng Google.
    const created = await adminAuth.createUser({ email, password: b.password, displayName: b.displayName, disabled: false }).catch((e) => {
      throw new HttpError(
        503,
        'Chưa thể tạo tài khoản mới trực tiếp — hệ thống thiếu cấu hình Firebase Admin (service account) thật. Nếu người này đã có trong danh sách trường cấp quyền, hãy gán vai trò trước qua mục "Chưa đăng nhập" thay vì tạo mới ở đây.',
        'FIREBASE_ADMIN_UNAVAILABLE',
        e instanceof Error ? e.message : String(e)
      );
    });
    const perId = genPerId();
    const campusId = b.campusId ?? null;
    const domain = b.roleId === ROLE.DEPT_HEAD ? b.domain!.trim() : null;

    await db.insert(accounts).values({ uid: created.uid, perId, displayName: b.displayName, email, createdByUid: q.appUser!.uid });
    await db.insert(peopleDirectory).values({ perId, email, phone: null }).onConflictDoUpdate({ target: peopleDirectory.perId, set: { email } });
    await db.insert(assignments).values({ perId, roleId: b.roleId, campusId, domain, createdByUid: q.appUser!.uid });

    const appRole = mapSafetyRoleToAppRole(b.roleId, false);
    await db
      .insert(accessAllowlist)
      .values({ id: safeId(email), email, role: appRole, active: true })
      .onConflictDoUpdate({ target: accessAllowlist.id, set: { role: appRole, active: true } });

    await db.insert(generalAuditLogs).values({
      action: 'CREATE_SAFETY_USER',
      actor: q.appUser!.email,
      entityType: 'safety_user',
      entityId: email,
      message: `roleId=${b.roleId} campusId=${campusId ?? ''} domain=${domain ?? ''}`
    });

    r.json({ ok: true, uid: created.uid, perId });
  })
);

adminRouter.patch(
  '/safety-users/:uid',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const uid = String(q.params.uid);
    const b = z
      .object({
        displayName: z.string().min(1).optional(),
        roleId: z.enum(ASSIGNABLE_SAFETY_ROLES),
        oldRoleId: z.string().nullable().optional(),
        campusId: z.enum(CAMPUS_IDS).nullable().optional(),
        domain: z.string().nullable().optional()
      })
      .parse(q.body);

    if (b.roleId === ROLE.DEPT_HEAD && !b.domain?.trim()) {
      throw new HttpError(400, 'Vai trò Tổ trưởng bắt buộc nhập Lĩnh vực/Tổ', 'INVALID_INPUT');
    }

    const [account] = await db.select().from(accounts).where(eq(accounts.uid, uid)).limit(1);
    if (!account) throw new HttpError(404, 'Không tìm thấy tài khoản', 'NOT_FOUND');

    if (b.displayName) {
      await db.update(accounts).set({ displayName: b.displayName }).where(eq(accounts.uid, uid));
      await adminAuth.updateUser(uid, { displayName: b.displayName }).catch(() => {});
    }

    const campusId = b.campusId ?? null;
    const domain = b.roleId === ROLE.DEPT_HEAD ? b.domain!.trim() : null;

    if (b.oldRoleId && b.oldRoleId !== b.roleId) {
      await db.delete(assignments).where(and(eq(assignments.perId, account.perId), eq(assignments.roleId, b.oldRoleId)));
    }
    await db
      .insert(assignments)
      .values({ perId: account.perId, roleId: b.roleId, campusId, domain, updatedByUid: q.appUser!.uid, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [assignments.perId, assignments.roleId], set: { campusId, domain, updatedByUid: q.appUser!.uid, updatedAt: new Date() } });

    const appRole = mapSafetyRoleToAppRole(b.roleId, false);
    await db
      .insert(accessAllowlist)
      .values({ id: safeId(account.email), email: account.email, role: appRole, active: true })
      .onConflictDoUpdate({ target: accessAllowlist.id, set: { role: appRole } });

    await db.insert(generalAuditLogs).values({
      action: 'UPDATE_SAFETY_USER',
      actor: q.appUser!.email,
      entityType: 'safety_user',
      entityId: account.email,
      message: `roleId=${b.roleId} campusId=${campusId ?? ''} domain=${domain ?? ''}`
    });

    r.json({ ok: true });
  })
);

/**
 * Gán/sửa vai trò An toàn cho người CHƯA TỪNG đăng nhập — không có uid
 * Firebase để định danh (khác route PATCH /safety-users/:uid ở trên,
 * dành cho người đã có `accounts`). Định danh bằng EMAIL (đã có sẵn từ
 * access_allowlist, biết trước không cần đăng nhập). Tự tạo
 * `people_directory` nếu người này lần đầu được gán vai trò. KHÔNG đụng
 * `accounts`/Firebase Auth — tài khoản Firebase thật chỉ sinh ra khi
 * chính người đó đăng nhập, lúc đó `auto-link.ts` tự nối uid vào đúng
 * `perId` đã gán sẵn ở đây.
 */
adminRouter.patch(
  '/safety-users/pending/:email',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const email = String(q.params.email).toLowerCase();
    const b = z
      .object({
        displayName: z.string().min(1).optional(),
        roleId: z.enum(ASSIGNABLE_SAFETY_ROLES),
        oldRoleId: z.string().nullable().optional(),
        campusId: z.enum(CAMPUS_IDS).nullable().optional(),
        domain: z.string().nullable().optional()
      })
      .parse(q.body);

    if (b.roleId === ROLE.DEPT_HEAD && !b.domain?.trim()) {
      throw new HttpError(400, 'Vai trò Tổ trưởng bắt buộc nhập Lĩnh vực/Tổ', 'INVALID_INPUT');
    }

    const [allowlistEntry] = await db.select().from(accessAllowlist).where(eq(accessAllowlist.id, safeId(email))).limit(1);
    if (!allowlistEntry) {
      throw new HttpError(404, 'Email này chưa có trong danh sách được cấp quyền (access allowlist)', 'NOT_FOUND');
    }

    const [existingAccount] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (existingAccount) {
      throw new HttpError(409, 'Người này đã đăng nhập rồi — sửa qua route quản lý theo tài khoản, không phải route này', 'INVALID_OPERATION');
    }

    let [dir] = await db.select().from(peopleDirectory).where(eq(peopleDirectory.email, email)).limit(1);
    if (!dir) {
      const perId = genPerId();
      await db.insert(peopleDirectory).values({ perId, email, phone: null, displayName: b.displayName || email });
      dir = { perId, email, phone: null, displayName: b.displayName || email };
    } else if (b.displayName && b.displayName !== dir.displayName) {
      await db.update(peopleDirectory).set({ displayName: b.displayName }).where(eq(peopleDirectory.perId, dir.perId));
    }

    const campusId = b.campusId ?? null;
    const domain = b.roleId === ROLE.DEPT_HEAD ? b.domain!.trim() : null;

    if (b.oldRoleId && b.oldRoleId !== b.roleId) {
      await db.delete(assignments).where(and(eq(assignments.perId, dir.perId), eq(assignments.roleId, b.oldRoleId)));
    }
    await db
      .insert(assignments)
      .values({ perId: dir.perId, roleId: b.roleId, campusId, domain, createdByUid: q.appUser!.uid, updatedByUid: q.appUser!.uid, updatedAt: new Date() })
      .onConflictDoUpdate({ target: [assignments.perId, assignments.roleId], set: { campusId, domain, updatedByUid: q.appUser!.uid, updatedAt: new Date() } });

    const appRole = mapSafetyRoleToAppRole(b.roleId, false);
    await db
      .insert(accessAllowlist)
      .values({ id: safeId(email), email, role: appRole, active: true })
      .onConflictDoUpdate({ target: accessAllowlist.id, set: { role: appRole } });

    await db.insert(generalAuditLogs).values({
      action: 'UPDATE_SAFETY_USER_PENDING',
      actor: q.appUser!.email,
      entityType: 'safety_user',
      entityId: email,
      message: `roleId=${b.roleId} campusId=${campusId ?? ''} domain=${domain ?? ''} (chưa đăng nhập)`
    });

    r.json({ ok: true, perId: dir.perId });
  })
);

adminRouter.post(
  '/safety-users/:uid/reset-password',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const uid = String(q.params.uid);
    const b = z.object({ newPassword: z.string().min(6) }).parse(q.body);

    const [account] = await db.select().from(accounts).where(eq(accounts.uid, uid)).limit(1);
    if (!account) throw new HttpError(404, 'Không tìm thấy tài khoản', 'NOT_FOUND');

    await adminAuth.updateUser(uid, { password: b.newPassword });

    await db.insert(generalAuditLogs).values({
      action: 'RESET_SAFETY_USER_PASSWORD',
      actor: q.appUser!.email,
      entityType: 'safety_user',
      entityId: account.email
    });

    r.json({ ok: true });
  })
);

adminRouter.post(
  '/safety-users/:uid/toggle-disable',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const uid = String(q.params.uid);
    const b = z.object({ disabled: z.boolean() }).parse(q.body);

    const [account] = await db.select().from(accounts).where(eq(accounts.uid, uid)).limit(1);
    if (!account) throw new HttpError(404, 'Không tìm thấy tài khoản', 'NOT_FOUND');
    if (account.uid === q.appUser!.uid) {
      throw new HttpError(400, 'Không thể tự khoá tài khoản của chính mình', 'INVALID_OPERATION');
    }

    await adminAuth.updateUser(uid, { disabled: b.disabled });
    await db
      .update(accessAllowlist)
      .set({ active: !b.disabled })
      .where(eq(accessAllowlist.id, safeId(account.email)));
    await db.update(users).set({ active: !b.disabled, updatedAt: new Date() }).where(eq(users.email, account.email));

    await db.insert(generalAuditLogs).values({
      action: b.disabled ? 'DISABLE_SAFETY_USER' : 'ENABLE_SAFETY_USER',
      actor: q.appUser!.email,
      entityType: 'safety_user',
      entityId: account.email
    });

    r.json({ ok: true });
  })
);

// ---------------------------------------------------------------------------
// Lớp chủ nhiệm (GVCN) / GV phụ trách khối — thêm 2026-09-21 (Sin yêu cầu
// gộp thẳng vào trang Quản trị hiện có, không tạo trang riêng). Dùng lại
// đúng 4 hàm CRUD có sẵn từ đầu ở `safety/directory-assignments.ts` nhưng
// trước đây CHƯA từng được nối route nào — bảng `homeroom_assignments`/
// `grade_supervisor_assignments` gần như trống trên production vì vậy.
// Quyền hạn: route chỉ chặn ở mức MANAGE_USERS (giống các route /safety-users*
// khác), quyền CHẶT hơn (`catalog.edit` — chỉ Hiệu trưởng/Văn phòng được
// không cần duyệt, Phó HT/Quản trị hệ thống cần phê duyệt) do CHÍNH
// `upsertHomeroomAssignment`/`upsertGradeSupervisorAssignment` tự kiểm tra
// bên trong — KHÔNG nới lỏng ở đây.
// ---------------------------------------------------------------------------

adminRouter.get(
  '/homeroom-assignments',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (_q, r) => {
    r.json({ items: await listHomeroomAssignments(db) });
  })
);

adminRouter.get(
  '/grade-supervisor-assignments',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (_q, r) => {
    r.json({ items: await listGradeSupervisorAssignments(db) });
  })
);

// Giả định nghiệp vụ: 1 giáo viên chỉ chủ nhiệm ĐÚNG 1 lớp tại 1 thời
// điểm — vì vậy trước khi gán lớp mới cho :perId, xoá sạch mọi dòng cũ
// đang trỏ tới đúng người này (nếu có), tránh 1 người dính 2 lớp do gán
// nhầm/gán lại nhiều lần. `className` rỗng/null = chỉ xoá, không gán mới
// (nghĩa là "bỏ chủ nhiệm").
adminRouter.patch(
  '/homeroom-assignments/:perId',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const perId = String(q.params.perId);
    const b = z.object({ className: z.string().nullable().optional(), name: z.string().nullable().optional() }).parse(q.body);
    const actor = await loadActorContext(db, q.appUser!.uid);

    const existing = await listHomeroomAssignments(db);
    for (const row of existing) {
      if (row.perId === perId) {
        await deleteHomeroomAssignment(db, { actor, className: row.className });
      }
    }

    if (b.className) {
      await upsertHomeroomAssignment(db, { actor, className: b.className, perId, name: b.name ?? null });
    }

    r.json({ ok: true });
  })
);

adminRouter.patch(
  '/grade-supervisor-assignments/:perId',
  firebaseAuth,
  requireCapability('MANAGE_USERS'),
  asyncRoute(async (q, r) => {
    const perId = String(q.params.perId);
    const b = z.object({ grade: z.string().nullable().optional(), name: z.string().nullable().optional() }).parse(q.body);
    const actor = await loadActorContext(db, q.appUser!.uid);

    const existing = await listGradeSupervisorAssignments(db);
    for (const row of existing) {
      if (row.perId === perId) {
        await deleteGradeSupervisorAssignment(db, { actor, grade: row.grade });
      }
    }

    if (b.grade) {
      await upsertGradeSupervisorAssignment(db, { actor, grade: b.grade, perId, name: b.name ?? null });
    }

    r.json({ ok: true });
  })
);
