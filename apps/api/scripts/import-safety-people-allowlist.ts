/**
 * import-safety-people-allowlist.ts — bổ sung bước bị thiếu ở
 * import-safety-people-real.ts: ghi 249 người vào `access_allowlist`
 * (session module) — đây là bảng thật sự gác cửa `/api/session/bootstrap`
 * (xem session.routes.ts), TÁCH BIỆT với `accounts`/`assignments`
 * (identity module) mà script trước đã ghi — ghi accounts/assignments
 * không đủ để đăng nhập được, phải có accessAllowlist nữa.
 *
 * role ở đây là role "cấp app" (roleOptions trong admin.routes.ts:
 * SYSTEM_SUPER_ADMIN/SCHOOL_ADMIN/VICE_PRINCIPAL/DEPARTMENT_HEAD/
 * DATA_VIEWER/TEACHER/SYSTEM_ADMIN/PRINCIPAL/HOMEROOM/VIEWER) — KHÁC với
 * role R.* của module An toàn (ghi ở assignments). Ánh xạ tối giản:
 * PRINCIPAL/VICE_PRINCIPAL/DEPARTMENT_HEAD giữ nguyên nghĩa, GVCN (khớp
 * email trong homeroom_assignments) -> HOMEROOM, còn lại -> TEACHER.
 *
 * Idempotent theo id=safeId(email) (onConflictDoUpdate).
 *
 * Chạy: cd apps/api && npx tsx scripts/import-safety-people-allowlist.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { safeId } from '../src/core/ids.js';
import { accessAllowlist } from '../src/modules/session/session.schema.js';

const INPUT_JSON = '/Users/macbook/.claude/jobs/4e122268/tmp/import_safety_people/cleaned.json';

interface StaffRecord { name: string; email: string; role_id: string }
interface ClassRecord { class_name: string; teacher_name: string; email: string }
interface CleanedData { staff: StaffRecord[]; classes: ClassRecord[] }

function mapAppRole(roleId: string, isHomeroom: boolean): string {
  if (roleId === 'R.PRINCIPAL') return 'PRINCIPAL';
  if (roleId === 'R.VICE_PRINCIPAL') return 'VICE_PRINCIPAL';
  if (roleId === 'R.DEPT_HEAD') return 'DEPARTMENT_HEAD';
  if (isHomeroom) return 'HOMEROOM';
  return 'TEACHER';
}

async function main() {
  const data: CleanedData = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  const homeroomEmails = new Set(data.classes.map((c) => c.email));

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  let count = 0;
  for (const person of data.staff) {
    const role = mapAppRole(person.role_id, homeroomEmails.has(person.email));
    const id = safeId(person.email);
    await db
      .insert(accessAllowlist)
      .values({ id, email: person.email, role, active: true })
      .onConflictDoUpdate({ target: accessAllowlist.id, set: { role, active: true } });
    count++;
  }

  console.log(`Đã cấp accessAllowlist cho ${count} người.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
