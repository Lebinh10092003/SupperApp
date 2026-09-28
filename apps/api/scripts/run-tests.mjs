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
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// CHẶN CỨNG chạy test nhắm vào DB không phải DB test (2026-09-28, sau sự
// cố thật: chạy `npm test` trên VPS production đã xoá sạch bảng
// `incidents` thật, vì `campus-comparison-stats.test.ts::resetTables()`
// gọi `db.delete(incidents)` không có transaction/rollback, và VPS đó chỉ
// có 1 DATABASE_URL cấu hình sẵn — đúng DB production, không có DB test
// riêng. Quy ước AN TOÀN: tên database (phần cuối DATABASE_URL) BẮT BUỘC
// chứa "test" (VD `superapp_test` ở .env local) — không đúng quy ước này
// thì DỪNG NGAY, không chạy file test nào cả, kể cả file không đụng DB.
// Đây là chốt chặn DUY NHẤT áp dụng cho MỌI file test hiện tại lẫn sau
// này — không dựa vào việc từng file test tự cẩn thận.
const dbUrl = process.env.DATABASE_URL;
if (dbUrl) {
  let dbName = '';
  try {
    dbName = new URL(dbUrl).pathname.replace(/^\//, '');
  } catch {
    dbName = dbUrl.split('/').pop() ?? '';
  }
  if (!dbName.toLowerCase().includes('test')) {
    console.error(
      `\n[run-tests] TỪ CHỐI chạy test: DATABASE_URL đang trỏ tới database "${dbName}", tên không chứa "test".\n` +
      `Test suite có xoá/ghi dữ liệu thật (VD campus-comparison-stats.test.ts::resetTables()) — CHỈ được chạy nhắm vào DB test riêng (tên phải chứa "test", VD "superapp_test").\n` +
      `Nếu đây thực sự là máy dev với DB test đặt tên khác, đổi tên DB cho có "test" trong đó — KHÔNG bỏ qua chốt chặn này.\n`
    );
    process.exit(1);
  }
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

const files = findTestFiles(srcDir);
console.log(`[run-tests] Tìm thấy ${files.length} file test.`);

const child = spawn(process.execPath, ['--import', 'tsx', '--test', ...files], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
