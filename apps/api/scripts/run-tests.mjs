// Tự tìm đệ quy mọi file *.test.ts trong src/ rồi truyền thẳng cho Node
// test runner — thay cho `--test src/**/*.test.ts` cũ.
//
// Lý do cần script này: `npm run test` gọi lệnh qua `sh` (POSIX shell,
// không phải shell tương tác đang gõ lệnh), và `sh` KHÔNG hỗ trợ `**` đệ
// quy — chỉ khớp đúng 2 cấp thư mục (`src/*/*.test.ts`), khiến 27/28 file
// test bị BỎ SÓT ÂM THẦM (chỉ `src/auth/roles.test.ts` chạy, các file
// nằm sâu hơn như `src/modules/safety/*.test.ts` không bao giờ chạy) dù
// `npm run test` vẫn báo "pass" — phát hiện thật lúc audit 2026-09-16,
// verify bằng cách tự liệt kê rồi chạy tay so với kết quả `npm run test`.
// Dùng `node:fs` tự duyệt cây thư mục thay vì dựa vào glob của shell/Node
// runtime (glob pattern của `node --test` cần Node bản mới, môi trường
// này đang chạy Node 20.10 không hỗ trợ) — cách này chắc chắn đúng trên
// mọi hệ điều hành/phiên bản Node >= 18.
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDisposableTestDatabase } from './database-test-guard.mjs';

// CHẶN CỨNG chạy test nhắm vào DB không phải DB test (2026-09-28, sau sự
// cố thật: chạy `npm test` trên VPS production đã xoá sạch bảng
// `incidents` thật, vì `campus-comparison-stats.test.ts::resetTables()`
// gọi `db.delete(incidents)` không có transaction/rollback, và VPS đó chỉ
// có 1 DATABASE_URL cấu hình sẵn — đúng DB production, không có DB test
// riêng. Quy ước AN TOÀN: tên database (phần cuối DATABASE_URL) BẮT BUỘC
// có "test" như một thành phần riêng (VD `superapp_test`) VÀ người chạy
// phải xác nhận rõ ALLOW_DESTRUCTIVE_DATABASE_TESTS=true. Thiếu một trong
// hai điều kiện thì DỪNG NGAY, không chạy file test nào cả.
// Đây là chốt chặn DUY NHẤT áp dụng cho MỌI file test hiện tại lẫn sau
// này — không dựa vào việc từng file test tự cẩn thận.
//
// SỰ CỐ LẦN 2 (2026-09-28, cùng ngày): guard này đã CÓ SẴN nhưng vẫn để
// lọt — vì lúc viết ban đầu KHÔNG `import 'dotenv/config'` ở file này, chỉ
// đọc thẳng `process.env.DATABASE_URL`. Khi gọi qua `npm test` KHÔNG
// pre-source `.env` vào shell (đúng cách destructive run xảy ra cả 2 lần),
// biến này UNDEFINED tại thời điểm check -> nhánh `if (dbUrl)` bị bỏ qua
// hoàn toàn -> lọt qua. Chỉ SAU ĐÓ, khi từng file test import
// `config/env.ts` (file đó mới có `import 'dotenv/config'`), DATABASE_URL
// thật (production) mới được nạp — nhưng guard đã cho qua từ trước rồi.
// Fix: tự `import 'dotenv/config'` NGAY Ở ĐẦU file này, sau đó kiểm tra
// fail-closed cả URL, tên DB và cờ xác nhận trước khi tìm/chạy test.
try {
  assertDisposableTestDatabase(
    process.env.DATABASE_URL,
    process.env.ALLOW_DESTRUCTIVE_DATABASE_TESTS
  );
} catch (error) {
  console.error(`\n${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}

const srcDir = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

function findTestFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...findTestFiles(full));
    } else if (entry.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

const files = [
  ...findTestFiles(srcDir),
  fileURLToPath(new URL('./database-test-guard.test.mjs', import.meta.url)),
  fileURLToPath(new URL('./schema-fingerprint.test.mjs', import.meta.url))
];
console.log(`[run-tests] Tìm thấy ${files.length} file test.`);

// Database test files share and clean tables, so parallel files can delete
// each other's fixtures and produce false failures.
const child = spawn(
  process.execPath,
  ['--import', 'tsx', '--test', '--test-concurrency=1', ...files],
  { stdio: 'inherit' }
);
child.on('exit', (code) => process.exit(code ?? 1));
