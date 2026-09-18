import { eq } from 'drizzle-orm';
import { env, studentOUs, teacherOUs } from '../../config/env.js';
import { db } from '../../core/db/client.js';
import { safeId } from '../../core/ids.js';
import { googleJson } from '../../integrations/dwd.js';
import { isTeacher } from '../people/people.shared.js';
import { people } from '../people/people.schema.js';
import { users, accessAllowlist } from '../session/session.schema.js';

const scope = ['https://www.googleapis.com/auth/admin.directory.user.readonly'];

type DUser = { id: string; primaryEmail: string; name?: { fullName?: string }; orgUnitPath?: string; suspended?: boolean };

const kind = (p = '') => (teacherOUs.some((x) => p.startsWith(x)) ? 'TEACHER' : studentOUs.some((x) => p.startsWith(x)) ? 'STUDENT' : 'OTHER');

export async function syncDirectory() {
  let token = '';
  let count = 0;
  let suspendedCount = 0;
  do {
    const u = new URL('https://admin.googleapis.com/admin/directory/v1/users');
    u.searchParams.set('customer', 'my_customer');
    u.searchParams.set('maxResults', '500');
    if (token) u.searchParams.set('pageToken', token);
    const d = await googleJson<{ users?: DUser[]; nextPageToken?: string }>(u.toString(), env.WORKSPACE_ADMIN_SUBJECT, scope);

    for (const x of d.users || []) {
      const email = x.primaryEmail.toLowerCase();
      const suspended = x.suspended === true;
      const row = {
        personId: x.id,
        email,
        displayName: x.name?.fullName || x.primaryEmail,
        orgUnitPath: x.orgUnitPath || '',
        personType: kind(x.orgUnitPath),
        suspended
      };
      await db
        .insert(people)
        .values(row)
        .onConflictDoUpdate({ target: people.personId, set: { ...row, updatedAt: new Date() } });
      count++;

      // Tài khoản Google bị khoá (nghỉ việc/chuyển trường) → khoá luôn quyền
      // truy cập hệ thống. CHỈ khoá, không bao giờ tự mở lại ở đây — mở lại
      // là quyết định thủ công của người có quyền (Quản trị viên), đúng yêu
      // cầu của Sin, tránh việc sync tự động cấp lại quyền ngoài ý muốn.
      if (suspended) {
        suspendedCount++;
        await db.update(accessAllowlist).set({ active: false }).where(eq(accessAllowlist.id, safeId(email)));
        await db.update(users).set({ active: false, updatedAt: new Date() }).where(eq(users.email, email));
      }
    }
    token = d.nextPageToken || '';
  } while (token);
  return { count, suspendedCount };
}

export async function teacherEmails() {
  const rows = await db.select().from(people);
  return rows.filter(isTeacher).map((r) => String(r.email));
}
