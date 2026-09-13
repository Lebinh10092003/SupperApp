/**
 * import-safety-people-real.ts — nạp dữ liệu THẬT của THCS Giảng Võ (file
 * Excel "2026.09.07 Danh sách tài khoản và thông tin App cảnh báo an toàn
 * THCS Giảng Võ.xlsx", do Sơn cung cấp 13/09/2026) vào module An toàn:
 * tạo tài khoản Firebase Auth THẬT (mật khẩu mặc định dùng chung, xem
 * DEFAULT_PASSWORD — mọi người PHẢI đổi mật khẩu sau lần đăng nhập đầu,
 * app hiện CHƯA có tính năng bắt buộc đổi, cần làm sau) + accounts/
 * assignments/people_directory/homeroom_assignments (Postgres).
 *
 * Nguồn dữ liệu trung gian: cleaned.json do script Python dọn từ file gốc
 * (chuẩn hoá email, ánh xạ vai trò sang đúng 16 mã R.*, loại trùng lặp) —
 * xem đường dẫn INPUT_JSON bên dưới. KHÔNG chỉnh sửa logic ánh xạ ở đây,
 * sửa ở clean.py rồi chạy lại nếu cần đổi quy tắc.
 *
 * Idempotent theo email: nếu tài khoản Firebase đã tồn tại thì lấy lại uid
 * cũ (không tạo trùng); nếu accounts/assignments đã có thì upsert.
 *
 * Chạy: cd apps/api && npx tsx scripts/import-safety-people-real.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../src/core/firebase.js';
import { accounts, assignments, peopleDirectory, homeroomAssignments } from '../src/modules/identity/identity.schema.js';

const INPUT_JSON = '/Users/macbook/.claude/jobs/4e122268/tmp/import_safety_people/cleaned.json';
const DEFAULT_PASSWORD = 'GiangVo@2026';

interface StaffRecord {
  name: string;
  email: string;
  phone: string | null;
  role_id: string;
  campus_id: string | null;
  domain: string | null;
}
interface ClassRecord {
  class_name: string;
  teacher_name: string;
  email: string;
}
interface CleanedData {
  staff: StaffRecord[];
  classes: ClassRecord[];
}

function genPerId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `PER_${s}`;
}

async function main() {
  const data: CleanedData = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  const emailToPerId = new Map<string, string>();
  let createdAuth = 0;
  let reusedAuth = 0;
  const authErrors: { email: string; error: string }[] = [];

  for (const person of data.staff) {
    let uid: string;
    try {
      const existing = await adminAuth.getUserByEmail(person.email).catch(() => null);
      if (existing) {
        uid = existing.uid;
        reusedAuth++;
      } else {
        const created = await adminAuth.createUser({
          email: person.email,
          password: DEFAULT_PASSWORD,
          displayName: person.name,
          disabled: false
        });
        uid = created.uid;
        createdAuth++;
      }
    } catch (e: any) {
      authErrors.push({ email: person.email, error: e?.message || String(e) });
      continue;
    }

    // Giữ perId cũ nếu account Postgres đã tồn tại (tránh sinh perId mới mỗi lần chạy lại)
    const existingAccount = await db.select().from(accounts).where(eq(accounts.uid, uid)).limit(1);
    const perId = existingAccount[0]?.perId ?? genPerId();
    emailToPerId.set(person.email, perId);

    await db
      .insert(accounts)
      .values({ uid, perId, displayName: person.name, email: person.email })
      .onConflictDoUpdate({ target: accounts.uid, set: { perId, displayName: person.name, email: person.email } });

    await db
      .insert(peopleDirectory)
      .values({ perId, email: person.email, phone: person.phone })
      .onConflictDoUpdate({ target: peopleDirectory.perId, set: { email: person.email, phone: person.phone } });

    await db
      .insert(assignments)
      .values({ perId, roleId: person.role_id, campusId: person.campus_id, domain: person.domain })
      .onConflictDoUpdate({
        target: [assignments.perId, assignments.roleId],
        set: { campusId: person.campus_id, domain: person.domain }
      });
  }

  console.log(`Tài khoản Firebase Auth: tạo mới ${createdAuth}, tái dùng ${reusedAuth}, lỗi ${authErrors.length}`);
  if (authErrors.length) console.log('Lỗi tạo tài khoản:', authErrors);

  let homeroomOk = 0;
  const homeroomUnresolved: ClassRecord[] = [];
  for (const cls of data.classes) {
    const perId = emailToPerId.get(cls.email);
    if (!perId) {
      homeroomUnresolved.push(cls);
      continue;
    }
    await db
      .insert(homeroomAssignments)
      .values({ className: cls.class_name, perId, name: cls.teacher_name })
      .onConflictDoUpdate({ target: homeroomAssignments.className, set: { perId, name: cls.teacher_name } });
    homeroomOk++;
  }

  console.log(`Lớp/GVCN: gán được ${homeroomOk}/${data.classes.length}, không tìm được GVCN trong danh sách nhân sự ${homeroomUnresolved.length}`);
  if (homeroomUnresolved.length) {
    console.log('Lớp chưa gán được GVCN (email GVCN không khớp email nào trong danh sách nhân sự hợp lệ):');
    for (const c of homeroomUnresolved) console.log(`  - ${c.class_name}: ${c.teacher_name} <${c.email}>`);
  }

  await pool.end();
  console.log('\nHoàn tất. Mật khẩu mặc định cho toàn bộ tài khoản mới tạo:', DEFAULT_PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
