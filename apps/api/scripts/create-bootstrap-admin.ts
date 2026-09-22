/**
 * create-bootstrap-admin.ts — tạo (hoặc đặt lại mật khẩu) 1 tài khoản
 * Firebase Auth thật cho người đã có trong BOOTSTRAP_SUPER_ADMIN_EMAILS
 * (.env) — được cấp SYSTEM_SUPER_ADMIN tự động ngay lần đăng nhập đầu
 * (middleware.ts), không cần accessAllowlist.
 *
 * Chạy: cd apps/api && npx tsx scripts/create-bootstrap-admin.ts <email> <password>
 */
import 'dotenv/config';
import { adminAuth } from '../src/core/firebase.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Cách dùng: npx tsx scripts/create-bootstrap-admin.ts <email> <password>');
    process.exit(1);
  }

  const existing = await adminAuth.getUserByEmail(email).catch(() => null);
  if (existing) {
    await adminAuth.updateUser(existing.uid, { password, disabled: false });
    console.log(`Đã cập nhật mật khẩu cho tài khoản có sẵn: ${email} (uid=${existing.uid})`);
  } else {
    const created = await adminAuth.createUser({ email, password, displayName: email, disabled: false });
    console.log(`Đã tạo tài khoản mới: ${email} (uid=${created.uid})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
