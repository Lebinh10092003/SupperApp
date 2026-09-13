import { env, studentOUs, teacherOUs } from '../../config/env.js';
import { db } from '../../core/db/client.js';
import { googleJson } from '../../integrations/dwd.js';
import { isTeacher } from '../people/people.shared.js';
import { people } from '../people/people.schema.js';

const scope = ['https://www.googleapis.com/auth/admin.directory.user.readonly'];

type DUser = { id: string; primaryEmail: string; name?: { fullName?: string }; orgUnitPath?: string; suspended?: boolean };

const kind = (p = '') => (teacherOUs.some((x) => p.startsWith(x)) ? 'TEACHER' : studentOUs.some((x) => p.startsWith(x)) ? 'STUDENT' : 'OTHER');

export async function syncDirectory() {
  let token = '';
  let count = 0;
  do {
    const u = new URL('https://admin.googleapis.com/admin/directory/v1/users');
    u.searchParams.set('customer', 'my_customer');
    u.searchParams.set('maxResults', '500');
    if (token) u.searchParams.set('pageToken', token);
    const d = await googleJson<{ users?: DUser[]; nextPageToken?: string }>(u.toString(), env.WORKSPACE_ADMIN_SUBJECT, scope);

    for (const x of d.users || []) {
      const row = {
        personId: x.id,
        email: x.primaryEmail.toLowerCase(),
        displayName: x.name?.fullName || x.primaryEmail,
        orgUnitPath: x.orgUnitPath || '',
        personType: kind(x.orgUnitPath)
      };
      await db
        .insert(people)
        .values(row)
        .onConflictDoUpdate({ target: people.personId, set: { ...row, updatedAt: new Date() } });
      count++;
    }
    token = d.nextPageToken || '';
  } while (token);
  return { count };
}

export async function teacherEmails() {
  const rows = await db.select().from(people);
  return rows.filter(isTeacher).map((r) => String(r.email));
}
