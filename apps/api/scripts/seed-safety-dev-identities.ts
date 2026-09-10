/**
 * seed-safety-dev-identities.ts — nạp 1 bộ tài khoản/vai trò TEST cố định
 * vào `accounts`/`assignments` (Postgres, module identity) để dev/QA đăng
 * nhập thử bằng bearer token `dev:<email>:<role_cũ>` (xem
 * `apps/api/src/auth/middleware.ts`) và thấy đúng quyền THẬT của module An
 * toàn (16 role `R.*`, đọc qua `loadActorContext`) — KHÔNG liên quan gì
 * tới role_cũ trong token (`SYSTEM_SUPER_ADMIN`/`TEACHER`.../xem
 * `auth/roles.ts`), 2 hệ thống hoàn toàn tách biệt.
 *
 * CHỈ dùng cho môi trường dev/local — script này KHÔNG được chạy nhắm vào
 * DB production (không có bảo vệ gì ngăn việc đó ngoài việc bạn tự set
 * đúng DATABASE_URL trỏ tới DB dev/local).
 *
 * Chạy: `cd apps/api && npx tsx scripts/seed-safety-dev-identities.ts`
 * (đọc DATABASE_URL từ .env như mọi lệnh khác trong dự án).
 *
 * Idempotent — chạy lại nhiều lần không tạo trùng (upsert theo uid/theo
 * cặp perId+roleId).
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { accounts, assignments } from '../src/modules/identity/identity.schema.js';
import { ROLE } from '../src/modules/safety/catalog.js';

/** uid PHẢI khớp đúng công thức trong `auth/middleware.ts` để dev-token đăng nhập ra đúng account này. */
function devUid(email: string): string {
  return `dev-user-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

interface SeedIdentity {
  email: string;
  displayName: string;
  perId: string;
  roleId: string;
  campusId: string | null;
}

// Tối thiểu đủ để test bộ hành động Phase 1 (đổi trạng thái/ưu tiên, mở
// lại, chỉ định chỉ huy) theo đúng PERMISSION_MATRIX ở authz.ts — thêm
// role khác vào đây khi cần test thêm, không cần xin phép ai.
const SEED_IDENTITIES: SeedIdentity[] = [
  { email: 'seed.principal@thcsgiangvo.edu.vn', displayName: 'Hiệu trưởng (seed)', perId: 'PER.SEED_PRINCIPAL', roleId: ROLE.PRINCIPAL, campusId: null },
  { email: 'seed.vice-principal@thcsgiangvo.edu.vn', displayName: 'Phó Hiệu trưởng (seed)', perId: 'PER.SEED_VICE_PRINCIPAL', roleId: ROLE.VICE_PRINCIPAL, campusId: 'MAIN_CAMPUS' },
  { email: 'seed.duty-officer@thcsgiangvo.edu.vn', displayName: 'Trực ban (seed)', perId: 'PER.SEED_DUTY_OFFICER', roleId: ROLE.DUTY_OFFICER, campusId: 'MAIN_CAMPUS' },
  { email: 'seed.teacher@thcsgiangvo.edu.vn', displayName: 'Giáo viên (seed)', perId: 'PER.SEED_TEACHER', roleId: ROLE.TEACHER, campusId: 'MAIN_CAMPUS' },
  // 10/09/2026 — 4 nút "trải nghiệm nhanh theo vai trò" ở LoginPage.tsx
  // (loginDemo) dùng CÁC EMAIL KHÁC HẲN 4 dòng seed.* ở trên (xem
  // apps/web/src/features/login/LoginPage.tsx) — actor-context.ts tra
  // theo email/uid thật của token dev, nên đăng nhập bằng 4 nút đó vào
  // app An toàn trước đây LUÔN báo "tài khoản chưa được phân vai trò" vì
  // không có dòng assignments nào khớp uid của chúng. Thêm đúng 4 email
  // đó vào đây, map role App-level (SUPER_ADMIN/Hiệu trưởng/Tổ trưởng/
  // Giáo viên) sang role R.* gần nghĩa nhất để bất kỳ nút demo nào ở
  // LoginPage cũng dùng được ngay app An toàn, không cần biết email
  // seed.* riêng.
  { email: '09.levanbinh2003@gmail.com', displayName: 'Lê Văn Bình (Super Admin)', perId: 'PER.DEMO_SUPER_ADMIN', roleId: ROLE.SYS_ADMIN, campusId: null },
  { email: 'hieutruong@thcs-giangvo.edu.vn', displayName: 'Thầy Hiệu Trưởng — THCS Giảng Võ', perId: 'PER.DEMO_PRINCIPAL', roleId: ROLE.PRINCIPAL, campusId: null },
  { email: 'totruong.toan@thcs-giangvo.edu.vn', displayName: 'Cô Tổ Trưởng Chuyên Môn Toán - Tin', perId: 'PER.DEMO_DEPT_HEAD', roleId: ROLE.DEPT_HEAD, campusId: 'MAIN_CAMPUS' },
  { email: 'giaovien.toan@thcs-giangvo.edu.vn', displayName: 'Thầy Giáo Viên Toán (6A1, 6A2)', perId: 'PER.DEMO_TEACHER', roleId: ROLE.TEACHER, campusId: 'MAIN_CAMPUS' }
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  for (const identity of SEED_IDENTITIES) {
    const uid = devUid(identity.email);
    await db
      .insert(accounts)
      .values({ uid, perId: identity.perId, displayName: identity.displayName, email: identity.email })
      .onConflictDoUpdate({ target: accounts.uid, set: { perId: identity.perId, displayName: identity.displayName, email: identity.email } });

    await db
      .insert(assignments)
      .values({ perId: identity.perId, roleId: identity.roleId, campusId: identity.campusId })
      .onConflictDoUpdate({ target: [assignments.perId, assignments.roleId], set: { campusId: identity.campusId } });

    console.log(`Seeded: ${identity.email} -> uid=${uid} perId=${identity.perId} role=${identity.roleId}`);
  }

  // Trực ban CẦN 1 ca trực đang diễn ra để `onDutyNow`/escalation-recipients
  // tính đúng — cửa sổ RỘNG, cố định (không phụ thuộc đồng hồ máy chạy).
  const dutyOfficerPerId = SEED_IDENTITIES.find((i) => i.roleId === ROLE.DUTY_OFFICER)!.perId;
  const { dutyShifts } = await import('../src/modules/identity/identity.schema.js');
  await db
    .insert(dutyShifts)
    .values({ id: 'SHIFT_SEED_DUTY_OFFICER', perId: dutyOfficerPerId, fromAt: new Date('2020-01-01T00:00:00Z'), toAt: new Date('2035-01-01T00:00:00Z') })
    .onConflictDoUpdate({ target: dutyShifts.id, set: { fromAt: new Date('2020-01-01T00:00:00Z'), toAt: new Date('2035-01-01T00:00:00Z') } });
  console.log(`Seeded duty shift for ${dutyOfficerPerId} (2020-2035, luôn đang trực).`);

  await pool.end();
  console.log('\nĐăng nhập thử: LoginPage (apps/web) -> nhập đúng email seed ở trên, chọn role_cũ bất kỳ (không ảnh hưởng quyền module An toàn).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
