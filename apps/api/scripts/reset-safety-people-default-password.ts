/**
 * reset-safety-people-default-password.ts — một số tài khoản THẬT (danh
 * sách 13/09/2026) đã tồn tại sẵn trong Firebase Auth TRƯỚC khi
 * import-safety-people-real.ts chạy lần đầu (VD do đã từng đăng nhập
 * Google trước đó) — script import chỉ đặt DEFAULT_PASSWORD cho tài khoản
 * MỚI TẠO (nhánh createUser), tài khoản đã tồn tại bị bỏ qua (nhánh
 * getUserByEmail) nên mật khẩu thật của họ KHÁC với mật khẩu mặc định đã
 * thông báo cho trường -> gây lỗi "Email hoặc mật khẩu không đúng." khi họ
 * đăng nhập lần đầu bằng mật khẩu mặc định.
 *
 * Fix: ép đặt lại DEFAULT_PASSWORD cho TOÀN BỘ tài khoản trong danh sách
 * thật (idempotent, an toàn chạy lại nhiều lần) để khớp đúng mật khẩu mặc
 * định đã/sẽ thông báo cho giáo viên trước khi bàn giao.
 *
 * Chạy: cd apps/api && npx tsx scripts/reset-safety-people-default-password.ts
 */
import 'dotenv/config';
import fs from 'node:fs';
import { adminAuth } from '../src/core/firebase.js';

const INPUT_JSON = '/Users/macbook/.claude/jobs/4e122268/tmp/import_safety_people/cleaned.json';
const DEFAULT_PASSWORD = 'GiangVo@2026';

interface StaffRecord {
  name: string;
  email: string;
}
interface CleanedData {
  staff: StaffRecord[];
}

async function main() {
  const data: CleanedData = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf-8'));
  let ok = 0;
  const errors: { email: string; error: string }[] = [];

  for (const person of data.staff) {
    try {
      const user = await adminAuth.getUserByEmail(person.email).catch(() => null);
      if (!user) {
        errors.push({ email: person.email, error: 'not found in Firebase Auth' });
        continue;
      }
      await adminAuth.updateUser(user.uid, { password: DEFAULT_PASSWORD });
      ok++;
    } catch (e: any) {
      errors.push({ email: person.email, error: e?.message || String(e) });
    }
  }

  console.log(`Đã đặt lại mật khẩu mặc định cho ${ok}/${data.staff.length} tài khoản.`);
  if (errors.length) {
    console.log(`Lỗi (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e.email}: ${e.error}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
